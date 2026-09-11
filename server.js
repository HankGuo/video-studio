'use strict';

// TokenDance 视频接入助手 —— 本地 Web 服务器
// 零依赖：仅使用 Node.js 标准库（需要 Node 18+，用了全局 fetch）
// 职责：托管 renderer/ 静态页面 + 提供 JSON API（替代原 Electron IPC）
//       + SSE 任务状态推送 + 本地媒体文件流式输出

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');

const { SettingsStore } = require('./main/settings');
const { TaskManager } = require('./main/tasks');
const { testConnection } = require('./main/protocols');
const { listModels, setRemoteCache } = require('./main/models');
const { startAuthorization } = require('./main/oauth');

const ROOT = __dirname;
const RENDERER_DIR = path.join(ROOT, 'renderer');
const DEFAULT_PORT = 8970;
// 上传只用于本地参考图：8MB 足够大多数视频截帧场景，
// 同时把 _buildItems 里 base64 编码后的体积压在 ~10MB 以内，避免大文件长时间阻塞主线程
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/* ---------------- 数据目录（沿用各平台惯例，macOS 与 Electron 版同路径） ---------------- */

function dataDir() {
  if (process.env.VIDEO_STUDIO_USER_DATA) return process.env.VIDEO_STUDIO_USER_DATA;
  const home = os.homedir();
  switch (process.platform) {
    case 'darwin':
      return path.join(home, 'Library', 'Application Support', 'video-studio');
    case 'win32':
      return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'video-studio');
    default:
      return path.join(process.env.XDG_CONFIG_HOME || path.join(home, '.config'), 'video-studio');
  }
}

/* ---------------- 跨平台打开浏览器 / 文件管理器 ---------------- */

function openExternal(target) {
  return new Promise((resolve) => {
    let child;
    if (process.platform === 'darwin') {
      child = spawn('open', [target]);
    } else if (process.platform === 'win32') {
      child = spawn('cmd', ['/c', 'start', '""', target]);
    } else {
      child = spawn('xdg-open', [target]);
    }
    child.on('error', () => resolve(false));
    child.on('exit', (code) => resolve(code === 0));
    child.unref();
  });
}

function revealPath(filePath) {
  if (process.platform === 'darwin') return spawn('open', ['-R', filePath]).unref();
  if (process.platform === 'win32') return spawn('explorer', [`/select,${filePath}`]).unref();
  return spawn('xdg-open', [path.dirname(filePath)]).unref();
}

/* ---------------- 静态文件与媒体 MIME ---------------- */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.m4v': 'video/x-m4v',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
};

const UPLOAD_EXT = {
  image: ['.png', '.jpg', '.jpeg', '.webp', '.gif'],
  video: ['.mp4', '.mov', '.webm', '.m4v'],
  audio: ['.mp3', '.wav', '.m4a', '.aac'],
};

/* ---------------- 小工具 ---------------- */

function ok(data) {
  return { ok: true, data };
}

function fail(err) {
  return { ok: false, error: err && err.message ? err.message : String(err) };
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (limit && size > limit) {
        reject(new Error('请求体过大'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJson(req) {
  const buf = await readBody(req, 4 * 1024 * 1024);
  if (!buf.length) return {};
  return JSON.parse(buf.toString('utf8'));
}

/* ---------------- 服务器组装 ---------------- */

function createStudio({ port = DEFAULT_PORT, openBrowser = true, reuseExisting = false } = {}) {
  const store = dataDir();
  fs.mkdirSync(store, { recursive: true });

  const settings = new SettingsStore(path.join(store, 'settings.json'));
  const tasks = new TaskManager({
    storeFile: path.join(store, 'tasks.json'),
    videoDir: path.join(store, 'videos'),
    getSettings: () => settings.get(),
  });
  const uploadDir = path.join(store, 'uploads');
  fs.mkdirSync(uploadDir, { recursive: true });
  tasks.start();

  /* ---- SSE：任务变化推送给所有打开的页面 ---- */
  const sseClients = new Set();
  tasks.on('changed', (list) => {
    const payload = `data: ${JSON.stringify(list)}\n\n`;
    for (const res of sseClients) {
      try { res.write(payload); } catch { sseClients.delete(res); }
    }
  });
  const heartbeat = setInterval(() => {
    for (const res of sseClients) {
      try { res.write(': ping\n\n'); } catch { sseClients.delete(res); }
    }
  }, 25000);
  heartbeat.unref?.();

  /* ---- 模型目录在线同步（公开接口，匿名访问） ---- */
  const modelsCacheFile = path.join(store, 'models-cache.json');
  const state = { modelSync: { source: 'builtin', syncedAt: 0 } };
  try {
    const cached = JSON.parse(fs.readFileSync(modelsCacheFile, 'utf8'));
    if (Array.isArray(cached.models)) {
      setRemoteCache(cached.models);
      state.modelSync = { source: 'cache', syncedAt: cached.syncedAt || 0 };
    }
  } catch { /* 无缓存，使用内置目录 */ }

  async function syncModels() {
    const endpoint = settings.get().endpoint;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(endpoint.replace(/\/+$/, '') + '/gateway/v1/models', { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data || !Array.isArray(data.data)) throw new Error('模型列表格式异常');
      setRemoteCache(data.data);
      const syncedAt = Date.now();
      state.modelSync = { source: 'remote', syncedAt };
      fs.writeFileSync(modelsCacheFile, JSON.stringify({ syncedAt, models: data.data }));
      return { models: listModels(), syncedAt, source: 'remote' };
    } catch (err) {
      const hasCache = !!fs.existsSync(modelsCacheFile);
      const source = hasCache ? 'cache' : 'builtin';
      state.modelSync = { source, syncedAt: 0 };
      return { models: listModels(), syncedAt: 0, source, error: err.message };
    }
  }

  /* ---- OAuth 一键授权：拉起系统浏览器 → loopback 回调 → 交换 Key ---- */
  let pendingAuth = null;

  async function connectTokenDance() {
    if (pendingAuth) pendingAuth.cancel();
    const flow = startAuthorization({
      endpoint: settings.get().endpoint,
      openBrowser: (url) => openExternal(url),
    });
    pendingAuth = flow;
    try {
      const { key } = await flow.promise;
      settings.save({ apiKey: key });
      return { connected: true };
    } finally {
      pendingAuth = null;
    }
  }

  /* ---- 本地媒体文件流式输出（支持 Range，视频可拖动进度） ---- */
  // 只允许输出数据目录内（videos/ 与 uploads/）的文件，防止任意文件读取
  const mediaRoots = [path.join(store, 'videos') + path.sep, uploadDir + path.sep];

  function isUnderStore(p) {
    const resolved = path.resolve(String(p));
    return resolved.startsWith(store + path.sep);
  }

  function serveMedia(req, res, url) {
    const filePath = url.searchParams.get('path');
    if (!filePath || !path.isAbsolute(filePath)) {
      res.writeHead(400).end('bad path');
      return;
    }
    if (!mediaRoots.some((root) => path.resolve(filePath).startsWith(root))) {
      res.writeHead(403).end('forbidden');
      return;
    }
    let stat;
    try {
      stat = fs.statSync(filePath);
      if (!stat.isFile()) throw new Error('not a file');
    } catch {
      res.writeHead(404).end('not found');
      return;
    }
    const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    const range = req.headers.range;
    if (range) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(range);
      let start = m && m[1] ? parseInt(m[1], 10) : 0;
      let end = m && m[2] ? Math.min(parseInt(m[2], 10), stat.size - 1) : stat.size - 1;
      if (m && !m[1] && m[2]) { // 后缀范围 bytes=-500
        start = Math.max(0, stat.size - parseInt(m[2], 10));
        end = stat.size - 1;
      }
      if (Number.isNaN(start) || start > end || start >= stat.size) {
        res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }).end();
        return;
      }
      res.writeHead(206, {
        'Content-Type': type,
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1,
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
      return;
    }
    res.writeHead(200, {
      'Content-Type': type,
      'Accept-Ranges': 'bytes',
      'Content-Length': stat.size,
    });
    fs.createReadStream(filePath).pipe(res);
  }

  /* ---- 静态页面（仅限 renderer/ 目录内） ---- */
  function serveStatic(req, res, url) {
    let rel = decodeURIComponent(url.pathname);
    if (rel === '/') rel = '/index.html';
    if (rel === '/favicon.png') {
      const icon = path.join(ROOT, 'assets', 'icon.png');
      if (fs.existsSync(icon)) {
        res.writeHead(200, { 'Content-Type': 'image/png' });
        fs.createReadStream(icon).pipe(res);
        return;
      }
      res.writeHead(404).end('not found');
      return;
    }
    const file = path.normalize(path.join(RENDERER_DIR, rel));
    if (!file.startsWith(RENDERER_DIR + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(file).pipe(res);
  }

  /* ---- 检查更新（GitHub Releases） ----
     仅做"有没有新版本 + 拿对应平台的下载链接"两件事，不下载不安装不重启。
     不动文件、不写后台，调用一次就一次的网络往返。
     失败/超时都通过 fail() 返回给前端做提示，绝不抛 5xx。 */
  const UPDATE_REPO = { owner: 'HankGuo', name: 'video-studio' };
  const UPDATE_API_URL = `https://api.github.com/repos/${UPDATE_REPO.owner}/${UPDATE_REPO.name}/releases/latest`;

  // 当前包版本（在 server.js 旁边，require 一份即可）
  const CURRENT_VERSION = require(path.join(ROOT, 'package.json')).version;
  const IS_ELECTRON = !!process.versions.electron;

  function parseSemver(tag) {
    const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(String(tag || '').trim());
    return m ? [+m[1], +m[2], +m[3]] : null;
  }
  function isNewer(latest, current) {
    if (!latest || !current) return false;
    for (let i = 0; i < 3; i++) {
      if (latest[i] > current[i]) return true;
      if (latest[i] < current[i]) return false;
    }
    return false;
  }
  // 按当前平台/架构从 assets 里挑一个最匹配的文件名后缀
  // 命名约定见 electron-builder.yml 的 artifactName：VideoStudio-${version}-${os}-${arch}.${ext}
  // win 多了一种 setup（NSIS 安装向导），优先选它
  function pickAsset(assets) {
    const platform = process.platform;   // 'darwin' | 'win32' | 'linux'
    const arch = process.arch;           // 'arm64' | 'x64' | ...
    const keys = [];
    if (platform === 'darwin') keys.push(arch === 'arm64' ? 'mac-arm64' : 'mac-x64');
    else if (platform === 'win32') { keys.push('win-setup'); keys.push('win-x64'); }
    else if (platform === 'linux') keys.push(arch === 'arm64' ? 'linux-arm64' : 'linux-x86_64');
    for (const key of keys) {
      const a = (assets || []).find((x) => x && x.name && x.name.includes(`-${key}.`));
      if (a) return a;
    }
    return null;
  }

  async function checkUpdate() {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    let release;
    try {
      const res = await fetch(UPDATE_API_URL, {
        signal: ctrl.signal,
        headers: {
          'Accept': 'application/vnd.github+json',
          'User-Agent': `VideoStudio/${CURRENT_VERSION}`,
        },
      });
      if (res.status === 403) {
        throw new Error('GitHub API 限流（未鉴权 60 次/小时），稍后再试');
      }
      if (res.status === 404) {
        throw new Error('尚未发布任何 Release');
      }
      if (!res.ok) throw new Error(`GitHub 返回 HTTP ${res.status}`);
      release = await res.json();
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('检查更新超时（6s），请检查网络');
      throw err;
    } finally {
      clearTimeout(timer);
    }

    const latestTag = String(release.tag_name || '').replace(/^v/, '');
    const latest = parseSemver(latestTag);
    const current = parseSemver(CURRENT_VERSION);
    const hasUpdate = isNewer(latest, current);

    const asset = pickAsset(release.assets);
    return {
      current: CURRENT_VERSION,
      latest: latestTag,
      hasUpdate,
      publishedAt: release.published_at || '',
      releaseName: release.name || '',
      releaseNotes: String(release.body || '').slice(0, 4000),
      releaseUrl: release.html_url || '',
      // 没有匹配到当前平台的 asset 时，退化到 release 页（让用户自己挑）
      downloadUrl: asset ? asset.browser_download_url : (release.html_url || ''),
      fileName: asset ? asset.name : '',
      fileSize: asset ? asset.size : 0,
      isElectron: IS_ELECTRON,
    };
  }

  /* ---- API 路由 ---- */
  const routes = {
    'GET /api/settings': () => settings.get(),
    'PUT /api/settings': (body) => settings.save(body),
    'POST /api/settings/test': (body) => testConnection({ ...settings.get(), ...(body || {}) }),

    'GET /api/app/info': () => ({ version: CURRENT_VERSION, isElectron: IS_ELECTRON }),
    'GET /api/health': () => ({
      version: CURRENT_VERSION,
      pid: process.pid,
      uptimeSec: Math.round(process.uptime()),
      taskCount: tasks.list().length,
      hasApiKey: !!settings.get().apiKey,
      models: { source: state.modelSync.source, syncedAt: state.modelSync.syncedAt },
    }),
    'GET /api/update/check': () => checkUpdate(),

    'GET /api/models': () => listModels(),
    'POST /api/models/sync': () => syncModels(),

    'POST /api/oauth/connect': () => connectTokenDance(),
    'POST /api/oauth/cancel': () => {
      if (pendingAuth) {
        pendingAuth.cancel();
        pendingAuth = null;
      }
    },

    'GET /api/tasks': () => tasks.list(),
    'POST /api/tasks': (body) => tasks.create(body || {}),
    'POST /api/tasks/submit-all': () => tasks.submitAll(),
    'PATCH /api/tasks/:id': (body, id) => tasks.update(id, body || {}),
    'POST /api/tasks/:id/duplicate': (_body, id) => tasks.duplicate(id),
    'DELETE /api/tasks/:id': (_body, id) => tasks.remove(id),
    'POST /api/tasks/:id/submit': (_body, id) => tasks.submit(id),
    'POST /api/tasks/:id/redownload': (_body, id) => tasks.redownload(id),

    'POST /api/reveal': (body) => {
      if (body && body.path && isUnderStore(body.path) && fs.existsSync(body.path)) revealPath(body.path);
    },
    'POST /api/open': async (body) => {
      if (body && body.path && isUnderStore(body.path) && fs.existsSync(body.path)) await openExternal(body.path);
    },
  };

  async function handleApi(req, res, url) {
    const key = `${req.method} ${url.pathname}`;
    let handler = routes[key];
    let id = null;
    if (!handler) {
      const m = /^(GET|PATCH|POST|DELETE) \/api\/tasks\/([\w-]+?)(\/duplicate|\/submit|\/redownload)?$/.exec(key);
      if (m) {
        id = m[2];
        handler = routes[`${m[1]} /api/tasks/:id${m[3] || ''}`];
      }
    }
    if (!handler) {
      sendJson(res, 404, fail(new Error('接口不存在')));
      return;
    }
    try {
      const body = req.method === 'GET' ? {} : await readJson(req);
      sendJson(res, 200, ok(await handler(body, id)));
    } catch (err) {
      sendJson(res, 200, fail(err)); // 业务错误走 200 + ok:false，与前端桥接层约定一致
    }
  }

  async function handleUpload(req, res, url) {
    try {
      const kind = url.searchParams.get('kind') || 'image';
      const allowed = UPLOAD_EXT[kind] || UPLOAD_EXT.image;
      const rawName = decodeURIComponent(req.headers['x-file-name'] || 'file');
      const ext = path.extname(rawName).toLowerCase();
      if (!allowed.includes(ext)) {
        sendJson(res, 200, fail(new Error(`不支持的文件类型 ${ext || '(无扩展名)'}`)));
        return;
      }
      const buf = await readBody(req, MAX_UPLOAD_BYTES);
      if (!buf.length) throw new Error('空文件');
      const safeName = path.basename(rawName).replace(/[\\/:*?"<>|]/g, '_');
      const filePath = path.join(uploadDir, `${crypto.randomUUID()}-${safeName}`);
      fs.writeFileSync(filePath, buf);
      sendJson(res, 200, ok({ path: filePath, name: safeName }));
    } catch (err) {
      sendJson(res, 200, fail(err));
    }
  }

  const server = http.createServer((req, res) => {
    // 只服务本机回环地址的 Host，挡住 DNS rebinding 之类的跨站本机访问
    const host = String(req.headers.host || '').split(':')[0].toLowerCase().replace(/^\[|\]$/g, '');
    if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/api/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      res.write(`data: ${JSON.stringify(tasks.list())}\n\n`);
      sseClients.add(res);
      req.on('close', () => sseClients.delete(res));
      return;
    }
    if (url.pathname.startsWith('/api/')) {
      if (url.pathname === '/api/upload') handleUpload(req, res, url);
      else handleApi(req, res, url);
      return;
    }
    if (url.pathname === '/media') {
      serveMedia(req, res, url);
      return;
    }
    if (req.method === 'GET') {
      serveStatic(req, res, url);
      return;
    }
    res.writeHead(404).end('not found');
  });

  return new Promise((resolve, reject) => {
    server.on('error', async (err) => {
      if (err.code === 'EADDRINUSE' && reuseExisting) {
        // 已有实例在运行：直接再开一个浏览器标签页指过去
        const url = `http://127.0.0.1:${port}`;
        if (openBrowser) await openExternal(url);
        console.log(`\n  已有实例正在运行，已在浏览器打开 ${url}\n`);
        process.exit(0);
      }
      reject(err);
    });
    server.listen(port, '127.0.0.1', async () => {
      const address = server.address();
      const url = `http://127.0.0.1:${address.port}`;
      resolve({ server, url, port: address.port, store, tasks, settings });
    });
  });
}

/* ---------------- 直接运行 ---------------- */

async function main() {
  const port = Number(process.env.VIDEO_STUDIO_PORT || DEFAULT_PORT);
  const noOpen = process.env.VIDEO_STUDIO_NO_OPEN || process.argv.includes('--no-open');
  const { url, store, tasks } = await createStudio({ port, openBrowser: !noOpen, reuseExisting: true });

  console.log('');
  console.log('  ┌─────────────────────────────────────────────────┐');
  console.log('  │   TokenDance 视频接入助手 · VideoStudio           │');
  console.log('  └─────────────────────────────────────────────────┘');
  console.log('');
  console.log(`  工作台地址   ${url}`);
  console.log(`  数据目录     ${store}`);
  console.log('');
  console.log('  按 Ctrl+C 停止服务');
  console.log('');

  if (!noOpen) await openExternal(url);

  const shutdown = () => {
    try { tasks.stop(); tasks.flush(); } catch { /* 尽力落盘 */ }
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('');
    console.error(`  启动失败：${err.message}`);
    if (err.code === 'EADDRINUSE') {
      console.error(`  端口 ${process.env.VIDEO_STUDIO_PORT || DEFAULT_PORT} 被占用，可换端口再试：`);
      console.error('  VIDEO_STUDIO_PORT=9000 npm start');
    }
    console.error('');
    process.exit(1);
  });
}

module.exports = { createStudio, dataDir, DEFAULT_PORT };
