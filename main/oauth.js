'use strict';

// TokenDance OAuth 式 API Key 授权（https://tokendance.space/docs/api-key-oauth）
// PKCE(S256) + 本地 loopback 回调：拉起浏览器授权 → 随机端口接收 code → 交换 Key

const http = require('http');
const crypto = require('crypto');

// 应用归因配置：app_url 是平台侧「应用归因的唯一要素」，会写入新创建的 Key。
// 必须是稳定 URL（不要用随机 callback 端口），本地分布式部署也共用同一个值即可。
// 正式申请通过后如有专属产品页，可用环境变量覆盖，无需改代码：
//   VIDEO_STUDIO_APP_URL / VIDEO_STUDIO_KEY_NAME
const APP_URL = process.env.VIDEO_STUDIO_APP_URL || 'https://github.com/HankGuo/video-studio';
const KEY_NAME = process.env.VIDEO_STUDIO_KEY_NAME || 'TokenDance 视频接入助手 (VideoStudio)';
const AUTH_TIMEOUT_MS = 5 * 60 * 1000;

function base64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function generatePkce() {
  const verifier = crypto.randomUUID() + crypto.randomUUID(); // 72 字符，符合 43–128 要求
  const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

function buildAuthUrl(endpoint, { callbackUrl, challenge, appUrl, keyName }) {
  const base = String(endpoint || 'https://tokendance.space').replace(/\/+$/, '');
  const params = new URLSearchParams({
    callback_url: callbackUrl,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    app_url: appUrl || APP_URL,
    key_name: keyName || KEY_NAME,
  });
  return `${base}/auth?${params.toString()}`;
}

// 在随机空闲端口监听一次性回调，返回 { port, waitForCode, close }
function startCallbackServer() {
  return new Promise((resolve, reject) => {
    let done = false;
    let timer = null;
    let codeResolve;
    let codeReject;
    const codePromise = new Promise((res, rej) => { codeResolve = res; codeReject = rej; });

    const server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (!url.pathname.startsWith('/callback')) {
        res.writeHead(404).end('Not Found');
        return;
      }
      const code = url.searchParams.get('code');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<html><body style="font-family:system-ui;background:#09090B;color:#FAFAFA;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><p>授权完成，可以关闭此页面，回到 TokenDance 视频接入助手。</p></body></html>');
      if (code && !done) {
        done = true;
        codeResolve(code);
      } else if (!done) {
        done = true;
        codeReject(new Error('回调中没有授权码'));
      }
    });

    const finish = (fn, value) => {
      if (done) return;
      done = true;
      fn(value);
      if (timer) clearTimeout(timer);
      try { server.close(); } catch { /* 已关闭 */ }
    };

    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      timer = setTimeout(() => finish(codeReject, new Error('授权超时（5 分钟），请重试')), AUTH_TIMEOUT_MS);
      timer.unref?.();
      resolve({
        port,
        waitForCode: () => codePromise,
        cancel: () => finish(codeReject, new Error('已取消授权')),
        close: () => finish(() => {}, null),
      });
    });
  });
}

async function exchangeCode(endpoint, code, verifier) {
  const base = String(endpoint || 'https://tokendance.space').replace(/\/+$/, '');
  const res = await fetch(`${base}/portal/api/v1/auth/keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, code_verifier: verifier, code_challenge_method: 'S256' }),
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!res.ok || !data || !data.key) {
    const message = (data && (data.message || (data.error && data.error.message))) || `Key 交换失败（HTTP ${res.status}）`;
    throw new Error(message);
  }
  return data.key; // 完整 Key 只在此响应中出现一次，调用方必须立即保存
}

// 完整授权流程：openBrowser 由调用方注入（server.js 的跨平台 opener）
// 返回 { promise, cancel, getAuthUrl }；promise 解出 { key } 或抛出带用户可读信息的错误
function startAuthorization({ endpoint, openBrowser }) {
  let server = null;
  let authUrl = '';
  const promise = (async () => {
    const pkce = generatePkce();
    server = await startCallbackServer();
    const callbackUrl = `http://127.0.0.1:${server.port}/callback`;
    authUrl = buildAuthUrl(endpoint, { callbackUrl, challenge: pkce.challenge });
    try {
      const opened = await openBrowser(authUrl).catch(() => false);
      if (!opened) {
        // headless / 无默认浏览器：把授权页地址打印到终端，用户手动打开后流程照常完成
        console.warn('\n  无法自动打开浏览器，请手动访问以下地址完成授权：');
        console.warn(`  ${authUrl}\n`);
      }
      const code = await server.waitForCode();
      const key = await exchangeCode(endpoint, code, pkce.verifier);
      return { key };
    } finally {
      if (server) server.close();
    }
  })();
  return {
    promise,
    cancel: () => { if (server) server.cancel(); },
    getAuthUrl: () => authUrl,
  };
}

module.exports = { startAuthorization, buildAuthUrl, generatePkce, APP_URL, KEY_NAME };
