'use strict';

/**
 * 端到端测试：启动真实 Electron 应用，通过 CDP 驱动 UI，
 * 走真实 API 完成一次完整生成，并截取各阶段界面。
 * 运行：node test/e2e.js
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SHOTS = path.join(ROOT, 'test', 'shots');
const USER_DATA = '/tmp/vs-e2e';
// 使用随机高端口，避免被本机其他自动化工具扫描到固定调试端口后干扰测试
const PORT = 20000 + Math.floor(Math.random() * 20000);
const PROMPT = '一只橘猫趴在窗台晒太阳，镜头缓慢推近，暖色调';
// 开源版本不内置密钥，测试用 Key 通过环境变量注入
const APIKEY = process.env.VIDEO_STUDIO_TEST_KEY || '';

// 清理可能残留的同类测试进程，避免环境污染
try {
  execSync(`pkill -f 'video-studio.*remote-debugging-port' || true`, { stdio: 'ignore' });
} catch { /* 无残留 */ }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let ws;
let msgId = 0;
const pending = new Map();

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression, awaitPromise = false) {
  const res = await send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true });
  if (res.exceptionDetails) {
    const desc = res.exceptionDetails.exception && res.exceptionDetails.exception.description;
    throw new Error(`页面内执行出错: ${desc || res.exceptionDetails.text}`);
  }
  return res.result ? res.result.value : undefined;
}

async function shot(name) {
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(SHOTS, name), Buffer.from(data, 'base64'));
  console.log(`[shot] ${name}`);
}

async function click(sel) {
  await evaluate(`(() => { const el = document.querySelector('${sel}'); if (!el) throw new Error('找不到元素 ${sel}'); el.click(); })()`);
}

async function waitFor(label, expression, timeoutMs = 30000, interval = 500) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(expression)) return;
    await sleep(interval);
  }
  throw new Error(`等待超时: ${label}`);
}

async function main() {
  if (!APIKEY) {
    console.error('请通过环境变量 VIDEO_STUDIO_TEST_KEY 提供测试用 API Key');
    process.exit(1);
  }
  fs.rmSync(USER_DATA, { recursive: true, force: true });
  fs.mkdirSync(SHOTS, { recursive: true });

  const electronBin = require(path.join(ROOT, 'node_modules', 'electron', 'index.js'));
  const child = spawn(electronBin, ['.', `--remote-debugging-port=${PORT}`], {
    cwd: ROOT,
    env: { ...process.env, VIDEO_STUDIO_USER_DATA: USER_DATA },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => console.log('[electron-out]', String(d).trim()));
  child.stderr.on('data', (d) => {
    const line = String(d).trim();
    if (line && !line.includes('DevTools listening')) console.error('[electron]', line);
  });

  try {
    // 等待 DevTools 端口与页面目标
    let target = null;
    for (let i = 0; i < 60; i++) {
      await sleep(500);
      try {
        const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
        target = list.find((t) => t.type === 'page' && t.url.includes('renderer/index.html'));
        if (target) break;
      } catch { /* 端口未就绪 */ }
    }
    if (!target) throw new Error('未找到应用页面目标');

    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', reject, { once: true });
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
    await waitFor('应用启动', `!!document.querySelector('#btn-new')`);
    await sleep(1200);

    // 0. 首次启动应自动打开设置弹窗（无内置密钥），填入 Key 并保存
    await waitFor('设置弹窗自动打开', `!document.querySelector('#settings-modal').classList.contains('hidden')`);
    await evaluate(`(() => {
      const el = document.querySelector('#set-apikey');
      el.value = ${JSON.stringify(APIKEY)};
      el.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await click('#btn-settings-save');
    await sleep(400);

    // 1. 空状态
    await shot('01-empty.png');

    // 2. 新建片段 → 编辑器
    await click('#btn-new');
    await waitFor('编辑器出现', `!!document.querySelector('#f-prompt')`);
    await sleep(400);
    await shot('02-editor.png');

    // 3. 填写提示词、选择时长 8s（验证独立配置与自动保存）
    await evaluate(`(() => {
      const el = document.querySelector('#f-prompt');
      el.value = ${JSON.stringify(PROMPT)};
      el.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await click(`[data-field="duration"] .chip[data-value="8"]`);
    await sleep(800);
    await shot('03-editor-filled.png');

    const saved = await evaluate(
      `studio.listTasks().then(ts => ts.find(t => t.prompt.includes('橘猫')) && ts.find(t => t.prompt.includes('橘猫')).duration)`,
      true
    );
    if (saved !== 8) throw new Error(`自动保存未生效，duration=${saved}`);
    console.log('[ok] 自动保存生效（时长 8s）');

    // 4. 设置弹窗：填入 API Key → 测试连接 → 保存
    await click('#btn-settings');
    await sleep(300);
    await evaluate(`(() => {
      const el = document.querySelector('#set-apikey');
      el.value = ${JSON.stringify(APIKEY)};
      el.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await shot('04-settings.png');
    await click('#btn-test-conn');
    await waitFor('连接测试结果', `(() => { const t = document.querySelector('#test-result').textContent; return t && t !== '测试中…'; })()`, 20000);
    const testResult = await evaluate(`document.querySelector('#test-result').textContent`);
    console.log('[ok] 连接测试:', testResult);
    await shot('05-settings-test.png');
    if (!testResult.includes('有效')) throw new Error(`连接测试未通过: ${testResult}`);
    await click('#btn-settings-save');
    await sleep(400);

    // 5. 提交生成
    await click('.foot-actions [data-action="submit"]');
    await sleep(2500);
    await shot('06-progress.png');

    // 6. 轮询直至完成（真实生成，最多 8 分钟）
    let task = null;
    let runningShot = false;
    const deadline = Date.now() + 8 * 60 * 1000;
    while (Date.now() < deadline) {
      const tasks = await evaluate('studio.listTasks()', true);
      task = tasks.find((t) => (t.prompt || '').includes('橘猫'));
      if (!task) throw new Error('任务从列表中消失');
      if (task.status === 'failed') throw new Error(`生成失败: ${task.error}`);
      if (task.status === 'running' && !runningShot) {
        runningShot = true;
        await shot('07-running.png');
      }
      if (task.status === 'succeeded' && task.videoPath) break;
      await sleep(8000);
    }
    if (!task || task.status !== 'succeeded') throw new Error(`生成超时，最终状态: ${task && task.status}`);
    console.log('[ok] 生成完成，远程任务:', task.remoteId);

    const stat = fs.statSync(task.videoPath);
    if (stat.size < 100 * 1024) throw new Error(`视频文件异常，仅 ${stat.size} 字节`);
    console.log(`[ok] 视频已下载到本地: ${task.videoPath}（${(stat.size / 1024 / 1024).toFixed(2)} MB）`);

    await sleep(1000);
    await shot('08-player.png');

    // 7. 多任务队列：再建两段草稿
    await click('#btn-new');
    await sleep(350);
    await click('#btn-new');
    await sleep(350);
    await shot('09-queue.png');
    const count = await evaluate(`studio.listTasks().then(ts => ts.length)`, true);
    if (count !== 3) throw new Error(`任务数异常: ${count}`);
    console.log('[ok] 多任务队列正常（3 段片段）');

    // 8. 持久化：tasks.json 应存在且包含 3 个任务
    const store = JSON.parse(fs.readFileSync(path.join(USER_DATA, 'tasks.json'), 'utf8'));
    if (!Array.isArray(store.tasks) || store.tasks.length !== 3) throw new Error('tasks.json 持久化异常');
    console.log('[ok] 任务持久化正常');

    console.log('\nE2E 全部通过');
  } finally {
    child.kill('SIGTERM');
    setTimeout(() => process.exit(0), 800).unref();
  }
}

main().catch((err) => {
  console.error('\nE2E 失败:', err.message);
  process.exit(1);
});
