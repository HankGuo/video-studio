'use strict';

/* 打包产物冒烟测试：直接启动 dist 里的 .app，截图确认真空状态可渲染 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const APP_BIN = path.join(ROOT, 'dist', 'mac-arm64', 'VideoStudio.app', 'Contents', 'MacOS', 'VideoStudio');
const USER_DATA = '/tmp/vs-smoke';
const PORT = 20000 + Math.floor(Math.random() * 20000);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  fs.rmSync(USER_DATA, { recursive: true, force: true });
  const child = spawn(APP_BIN, [`--remote-debugging-port=${PORT}`], {
    env: { ...process.env, VIDEO_STUDIO_USER_DATA: USER_DATA },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr.on('data', (d) => {
    const line = String(d).trim();
    if (line && !line.includes('DevTools listening')) console.error('[app]', line);
  });

  try {
    let target = null;
    for (let i = 0; i < 40; i++) {
      await sleep(500);
      try {
        const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
        target = list.find((t) => t.type === 'page' && t.url.includes('renderer/index.html'));
        if (target) break;
      } catch { /* 未就绪 */ }
    }
    if (!target) throw new Error('打包应用页面未出现');

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', reject, { once: true });
    });
    let msgId = 0;
    const pending = new Map();
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++msgId;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    });

    await send('Page.enable');
    await send('Runtime.enable');
    await sleep(1800);

    const ready = await send('Runtime.evaluate', {
      expression: `!!document.querySelector('#btn-new') && !!document.querySelector('.empty-state')`,
      returnByValue: true,
    });
    if (!ready.result.value) throw new Error('打包应用界面未正确渲染');

    const settings = await send('Runtime.evaluate', {
      expression: `studio.getSettings()`,
      awaitPromise: true,
      returnByValue: true,
    });
    if (!settings.result.value.endpoint) throw new Error('默认设置未加载');
    console.log('[ok] 默认设置:', settings.result.value.endpoint);

    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ROOT, 'test', 'shots', '10-packaged.png'), Buffer.from(data, 'base64'));
    console.log('[ok] 打包应用截图 10-packaged.png');
    console.log('\n冒烟测试通过');
  } finally {
    child.kill('SIGTERM');
    setTimeout(() => process.exit(0), 800).unref();
  }
}

main().catch((err) => {
  console.error('\n冒烟测试失败:', err.message);
  process.exit(1);
});
