'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const { adapterFor } = require('./protocols');
const { findModel, DEFAULT_MODEL } = require('./models');

const POLL_MS = 4000;
const TICK_MS = 1500;
const IMAGE_MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

function now() {
  return Date.now();
}

function clampInt(value, min, max, fallback) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function sanitizeOne(m) {
  if (!m) return null;
  if (m.source === 'url' && m.url) return { source: 'url', url: String(m.url).trim() };
  if (m.source === 'local' && m.path) return { source: 'local', path: String(m.path), name: String(m.name || path.basename(m.path)) };
  return null;
}

function sanitizeMedia(media) {
  const clean = {};
  for (const key of ['firstFrame', 'lastFrame', 'refVideo', 'refAudio', 'editVideo']) {
    const m = sanitizeOne(media && media[key]);
    if (m) clean[key] = m;
  }
  const refs = (media && Array.isArray(media.refImages) ? media.refImages : [])
    .map(sanitizeOne)
    .filter(Boolean);
  if (refs.length) clean.refImages = refs;
  return clean;
}

function migrateTask(t) {
  // 只在字段确实缺失时补默认模型（老版本存量数据没有这个字段）。
  // 空串是「新建了片段但还没选模型」的合法状态，这里若用 !t.model 判断，
  // 重启一次就会把空壳草稿悄悄补成默认模型，表单自己长出来。
  if (t.model == null) t.model = DEFAULT_MODEL;
  if (t.media && t.media.refImage && !t.media.refImages) {
    t.media.refImages = [t.media.refImage];
    delete t.media.refImage;
  }
  if (t.audio === undefined) t.audio = false;
  return t;
}

function defaultResolution(model) {
  return model.resolutions.find((r) => /720|768/.test(r)) || model.resolutions[0];
}

// 任务管理器：草稿创建、提交、轮询、视频下载、持久化
class TaskManager extends EventEmitter {
  constructor({ storeFile, videoDir, getSettings }) {
    super();
    this.storeFile = storeFile;
    this.videoDir = videoDir;
    this.getSettings = getSettings;
    this.tasks = [];
    this._saveTimer = null;
    this._tickTimer = null;
    fs.mkdirSync(videoDir, { recursive: true });
    this._load();
  }

  _load() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.storeFile, 'utf8'));
      this.tasks = Array.isArray(raw.tasks) ? raw.tasks.map(migrateTask) : [];
    } catch {
      this.tasks = [];
    }
    // 恢复上次退出时仍在进行中的任务
    for (const t of this.tasks) {
      if (t.status === 'submitting') {
        if (t.remoteId) {
          t.status = 'queued';
        } else {
          t.status = 'failed';
          t.error = '应用在提交过程中退出，请重新提交';
        }
      }
      if (t.status === 'succeeded' && !t.videoPath && t.videoUrl) {
        this._download(t, t.videoUrl); // 上次没下完的视频补下（URL 24h 内有效）
      }
    }
  }

  start() {
    this._tickTimer = setInterval(() => this._pollDue(), TICK_MS);
    this._tickTimer.unref?.();
  }

  stop() {
    if (this._tickTimer) clearInterval(this._tickTimer);
    this._tickTimer = null;
  }

  // 退出前把防抖中的落盘立即写掉，避免 Ctrl+C 丢失最后几百毫秒的编辑
  flush() {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
    }
    this._persist();
  }

  _find(id) {
    return this.tasks.find((t) => t.id === id);
  }

  _public(t) {
    const out = {};
    for (const [k, v] of Object.entries(t)) if (!k.startsWith('_')) out[k] = v;
    return out;
  }

  list() {
    return this.tasks.map((t) => this._public(t));
  }

  _persist() {
    const payload = JSON.stringify({ tasks: this.list() }, null, 2);
    fs.writeFileSync(this.storeFile, payload);
  }

  _changed() {
    this.emit('changed', this.list());
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this._persist(), 300);
  }

  create(config) {
    // 用 findModel 而不是 getModel：后者会静默兜底到 DEFAULT_MODEL，
    // 那样「没传模型」和「传了一个不存在的模型」都会被当成默认模型，未选模型的状态就消失了
    const model = findModel(config.model);
    const task = {
      id: crypto.randomUUID(),
      remoteId: '',
      // 空串 = 尚未选定模型。新建片段默认不带模型：表单要等用户选定后才组装出来，
      // 所以这里只落一张空壳草稿 —— mode/duration/resolution/ratio 等模型相关字段全部留空，
      // 由 update() 里选定模型时的收敛逻辑统一补全，规则只此一份。
      model: '',
      mode: '',
      prompt: String(config.prompt || ''),
      duration: 0,
      resolution: '',
      ratio: '',
      audio: false,
      media: sanitizeMedia(config.media),
      status: 'draft',
      error: '',
      videoPath: '',
      videoUrl: '',
      downloadError: '',
      createdAt: now(),
      updatedAt: now(),
      submittedAt: 0,
    };
    if (model) {
      // 创建时就带模型的场景（复制草稿）：按该模型的能力收敛各项配置
      task.model = model.id;
      task.mode = model.modes.includes(config.mode) ? config.mode : model.modes[0];
      task.duration = clampInt(config.duration, model.duration[0], model.duration[1], Math.min(6, model.duration[1]));
      task.resolution = model.resolutions.includes(config.resolution) ? config.resolution : defaultResolution(model);
      task.ratio = model.ratios.includes(config.ratio) ? config.ratio : (model.ratios.includes('adaptive') ? 'adaptive' : '16:9');
      task.audio = model.audio ? !!config.audio : false;
    }
    this.tasks.unshift(task);
    this._changed();
    return this._public(task);
  }

  update(id, patch) {
    const task = this._find(id);
    if (!task) throw new Error('片段不存在');
    if (task.status !== 'draft' && task.status !== 'failed') throw new Error('已提交的片段不能再修改，可复制为新片段');
    if (patch.model && patch.model !== task.model) {
      // 用 findModel 而不是 getModel：查不到就明确报错，绝不静默换成默认模型 ——
      // 用户明明选了 A、任务却按 B 生成并按 B 计费，这在界面上完全看不出来。
      // create / submit 早就是这个口径，这里与它们保持一致
      const model = findModel(patch.model);
      if (!model) throw new Error(`模型 ${patch.model} 不在当前模型目录中，请先同步模型目录后再选择`);
      task.model = model.id;
      // 切换模型后把各项配置收敛到新模型支持的范围
      if (!model.modes.includes(task.mode)) task.mode = model.modes[0];
      task.duration = clampInt(task.duration, model.duration[0], model.duration[1], model.duration[0]);
      if (!model.resolutions.includes(task.resolution)) task.resolution = defaultResolution(model);
      if (!model.ratios.includes(task.ratio)) task.ratio = model.ratios.includes('adaptive') ? 'adaptive' : model.ratios[0];
      if (!model.audio) task.audio = false;
      task.media = sanitizeMedia(task.media);
    }
    // 提示词与素材跟模型无关，任何时候都改得动
    if (patch.prompt !== undefined) task.prompt = String(patch.prompt);
    if (patch.media !== undefined) task.media = sanitizeMedia(patch.media);
    // 其余字段都得按模型能力校验。模型查不到时（还没选、或已下线）跳过这些校验，
    // 而不是拿默认模型的规则去套一个根本不属于它的任务
    const model = findModel(task.model);
    if (model) {
      if (patch.mode && model.modes.includes(patch.mode)) task.mode = patch.mode;
      if (patch.duration !== undefined) task.duration = clampInt(patch.duration, model.duration[0], model.duration[1], task.duration);
      if (patch.resolution && model.resolutions.includes(patch.resolution)) task.resolution = patch.resolution;
      if (patch.ratio && model.ratios.includes(patch.ratio)) task.ratio = patch.ratio;
      if (patch.audio !== undefined && model.audio) task.audio = !!patch.audio;
    }
    task.updatedAt = now();
    this._changed();
    return this._public(task);
  }

  duplicate(id) {
    const src = this._find(id);
    if (!src) throw new Error('片段不存在');
    return this.create({
      model: src.model,
      mode: src.mode,
      prompt: src.prompt,
      duration: src.duration,
      resolution: src.resolution,
      ratio: src.ratio,
      audio: src.audio,
      media: src.media,
    });
  }

  remove(id) {
    const idx = this.tasks.findIndex((t) => t.id === id);
    if (idx === -1) return;
    const [task] = this.tasks.splice(idx, 1);
    if (task.videoPath) {
      try { fs.unlinkSync(task.videoPath); } catch { /* 文件可能已不存在 */ }
    }
    this._changed();
  }

  async submit(id) {
    const task = this._find(id);
    if (!task) throw new Error('片段不存在');
    if (task.status !== 'draft' && task.status !== 'failed') return this._public(task);
    task.status = 'submitting';
    task.error = '';
    task.updatedAt = now();
    this._changed();
    try {
      // 未选模型的空壳草稿没有可提交的内容。放在 try 里走既有错误路径，
      // 这样批量提交遇到它只标记这一段失败，不会中断后面草稿的提交
      if (!task.model) throw new Error('请先为该片段选择模型');
      const model = findModel(task.model);
      if (!model) throw new Error(`模型 ${task.model} 已从目录下线，请复制为新片段后重新选择模型`);
      const adapter = adapterFor(model.protocol);
      const items = await this._buildItems(task);
      task.remoteId = await adapter.submit(this.getSettings(), task, items);
      task.status = 'queued';
      task.submittedAt = now();
      task._nextPoll = 0;
      task._pollErrors = 0;
      task._emptyResults = 0;
    } catch (err) {
      task.status = 'failed';
      task.error = err.message;
    }
    task.updatedAt = now();
    this._changed();
    return this._public(task);
  }

  async submitAll() {
    const drafts = this.tasks.filter((t) => t.status === 'draft');
    for (const t of drafts) {
      await this.submit(t.id); // 串行提交，避免瞬时打满网关
    }
    return this.list();
  }

  // 把任务组装成标准化 items：文本 + 素材（本地图片转 base64 data URI，视频/音频需 URL）
  async _buildItems(task) {
    const items = [];
    const prompt = (task.prompt || '').trim();
    if (task.mode === 'text' && !prompt) throw new Error('文生视频需要填写提示词');
    if (prompt) items.push({ type: 'text', text: prompt });

    const toItem = (m, role, kind) => {
      if (!m) return null;
      if (m.source === 'url' && m.url) return { kind, role, url: m.url };
      if (m.source === 'local' && m.path) {
        if (kind !== 'image') throw new Error('参考视频 / 参考音频请使用可公开访问的 URL');
        const mime = IMAGE_MIME[path.extname(m.path).toLowerCase()] || 'image/png';
        const b64 = fs.readFileSync(m.path).toString('base64');
        return { kind, role, url: `data:${mime};base64,${b64}` };
      }
      return null;
    };
    const push = (m, role, kind) => {
      const item = toItem(m, role, kind);
      if (item) items.push(item);
    };

    if (task.mode === 'image') {
      push(task.media.firstFrame, 'first_frame', 'image');
      push(task.media.lastFrame, 'last_frame', 'image');
      if (!items.some((i) => i.role)) throw new Error('图生视频需要至少一张首帧图片');
    } else if (task.mode === 'reference') {
      for (const m of task.media.refImages || []) push(m, 'reference_image', 'image');
      push(task.media.refVideo, 'reference_video', 'video');
      push(task.media.refAudio, 'reference_audio', 'audio');
      const hasVisual = items.some((i) => i.role === 'reference_image' || i.role === 'reference_video');
      if (!hasVisual) throw new Error('参考生视频至少需要参考图片或参考视频');
    } else if (task.mode === 'edit') {
      push(task.media.editVideo, 'edit_video', 'video');
      for (const m of task.media.refImages || []) push(m, 'reference_image', 'image');
      if (!items.some((i) => i.role === 'edit_video')) throw new Error('视频编辑需要一段源视频（URL）');
      if (!prompt) throw new Error('视频编辑需要填写编辑指令');
    }
    if (!items.length) throw new Error('请至少填写提示词或添加素材');
    return items;
  }

  _pollDue() {
    const t = now();
    for (const task of this.tasks) {
      if (
        (task.status === 'queued' || task.status === 'running') &&
        task.remoteId &&
        !task._polling &&
        (task._nextPoll || 0) <= t
      ) {
        this._poll(task);
      }
    }
  }

  async _poll(task) {
    task._polling = true;
    try {
      const model = findModel(task.model);
      if (!model) throw Object.assign(new Error(`模型 ${task.model} 已从目录下线，无法继续跟踪`), { httpStatus: 410 });
      const adapter = adapterFor(model.protocol);
      const remote = await adapter.query(this.getSettings(), task.remoteId, task);
      task._pollErrors = 0;
      task._nextPoll = now() + POLL_MS;
      this._applyRemote(task, remote);
    } catch (err) {
      task._pollErrors = (task._pollErrors || 0) + 1;
      task._nextPoll = now() + POLL_MS * 2; // 网络异常时退避
      let terminal = null;
      if (err.httpStatus === 404) {
        terminal = '远端任务不存在或已过期';
      } else if (err.httpStatus === 410) {
        terminal = err.message;
      } else if (err.httpStatus === 401 || err.httpStatus === 403) {
        terminal = `网关鉴权失败，请在设置中检查 API Key：${err.message}`;
      } else if (task._pollErrors >= 10) {
        terminal = `网关持续不可达（已重试 ${task._pollErrors} 次）：${err.message}`;
      }
      if (terminal) {
        task.status = 'failed';
        task.error = terminal;
        task.updatedAt = now();
        this._changed();
      }
    } finally {
      task._polling = false;
    }
  }

  _applyRemote(task, remote) {
    const status = remote.status;
    let dirty = false;
    if ((status === 'queued' || status === 'running') && task.status !== status) {
      task.status = status;
      dirty = true;
    } else if (status === 'succeeded') {
      // 网关可能先返回 succeeded、稍后才给出视频地址：没有地址时继续轮询几次
      if (!remote.videoUrl && !task.videoUrl) {
        task._emptyResults = (task._emptyResults || 0) + 1;
        if (task._emptyResults <= 6) {
          task._nextPoll = now() + POLL_MS;
          return;
        }
        task.status = 'failed';
        task.error = '网关已标记完成但未返回视频地址，请到词元跳动控制台核对后重试';
        task.updatedAt = now();
        this._changed();
        return;
      }
      if (remote.videoUrl && remote.videoUrl !== task.videoUrl) {
        task.videoUrl = remote.videoUrl;
        dirty = true;
      }
      if (task.status !== 'succeeded') {
        task.status = 'succeeded';
        task.updatedAt = now();
        dirty = true;
      }
      if (task.videoUrl && !task.videoPath) this._download(task, task.videoUrl);
    } else if (status === 'failed' || status === 'cancelled' || status === 'expired') {
      if (task.status !== status) {
        task.status = status;
        task.error = remote.error || `任务${status}`;
        task.updatedAt = now();
        dirty = true;
      }
    }
    if (dirty) this._changed();
  }

  async _download(task, url) {
    if (task._downloading) return false;
    task._downloading = true;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 5 * 60 * 1000); // 大文件最多下 5 分钟
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) {
        clearTimeout(timer);
        throw new Error(`视频下载失败（HTTP ${res.status}）`);
      }
      const buf = Buffer.from(await res.arrayBuffer());
      clearTimeout(timer);
      const ct = String(res.headers.get('content-type') || '').toLowerCase();
      const ext = ct.includes('quicktime') ? '.mov' : ct.includes('webm') ? '.webm' : '.mp4';
      const file = path.join(this.videoDir, `${task.id}${ext}`);
      fs.writeFileSync(file, buf);
      if (task.videoPath && task.videoPath !== file) {
        try { fs.unlinkSync(task.videoPath); } catch { /* 旧文件可能已不存在 */ }
      }
      task.videoPath = file;
      task.downloadError = '';
      return true;
    } catch (err) {
      task.downloadError = err && err.name === 'AbortError' ? '视频下载超时（5 分钟），请点击重新下载' : err.message;
      return false;
    } finally {
      task._downloading = false;
      task.updatedAt = now();
      this._changed();
    }
  }

  async redownload(id) {
    const task = this._find(id);
    if (!task || !task.videoUrl) throw new Error('没有可下载的视频地址');
    if (task._downloading) throw new Error('正在下载中，请稍候');
    await this._download(task, task.videoUrl);
    return this._public(task);
  }
}

module.exports = { TaskManager };
