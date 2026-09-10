'use strict';

// 服务器冒烟测试：隔离数据目录 + 随机端口启动，逐个验证 API 与静态资源
// 运行：node test/server.js

const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.VIDEO_STUDIO_USER_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'video-studio-test-'));
process.env.VIDEO_STUDIO_NO_OPEN = '1';

const { createStudio } = require('../server');

let passed = 0;
let failed = 0;

function check(name, cond, extra = '') {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${name} ${extra}`);
  }
}

async function main() {
  const { server, url } = await createStudio({ port: 0, openBrowser: false });
  console.log(`\n测试服务器：${url}（数据目录 ${process.env.VIDEO_STUDIO_USER_DATA}）\n`);

  const get = async (p, headers) => {
    const res = await fetch(url + p, { headers });
    const text = await res.text();
    return { res, text };
  };
  const api = async (p, method = 'GET', body) => {
    const res = await fetch(url + p, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return res.json();
  };

  // 静态资源
  const home = await get('/');
  check('GET / 返回页面', home.res.status === 200 && home.text.includes('TokenDance'));
  const css = await get('/styles.css');
  check('GET /styles.css', css.res.status === 200 && css.res.headers.get('content-type').includes('text/css'));
  const app = await get('/app.js');
  check('GET /app.js', app.res.status === 200);
  const bridge = await get('/studio.js');
  check('GET /studio.js 桥接层', bridge.res.status === 200 && bridge.text.includes('window.studio'));
  const traversal = await get('/..%2fserver.js');
  check('路径穿越被拒绝', traversal.res.status === 404);

  // 设置
  const s0 = await api('/api/settings');
  check('读取默认设置', s0.ok && s0.data.endpoint === 'https://tokendance.space');
  const s1 = await api('/api/settings', 'PUT', { endpoint: 'https://tokendance.space/', apiKey: 'sk-test-123' });
  check('保存设置（接入点归一化）', s1.ok && s1.data.apiKey === 'sk-test-123' && s1.data.endpoint === 'https://tokendance.space');
  check('设置落盘', fs.readFileSync(path.join(process.env.VIDEO_STUDIO_USER_DATA, 'settings.json'), 'utf8').includes('sk-test-123'));

  // 模型目录
  const models = await api('/api/models');
  check('内置模型目录', models.ok && models.data.length >= 17 && models.data[0].id);

  // 任务生命周期
  const created = await api('/api/tasks', 'POST', { model: 'minimax-h3', prompt: '一只猫在窗台晒太阳' });
  check('创建片段', created.ok && created.data.status === 'draft' && created.data.id);
  const id = created.data.id;
  const patched = await api(`/api/tasks/${id}`, 'PATCH', { duration: 8, ratio: '16:9' });
  check('更新片段', patched.ok && patched.data.duration === 8);
  const dup = await api(`/api/tasks/${id}/duplicate`, 'POST');
  check('复制片段', dup.ok && dup.data.id !== id && dup.data.prompt === created.data.prompt);
  const list = await api('/api/tasks');
  check('任务列表', list.ok && list.data.length === 2);
  const removed = await api(`/api/tasks/${dup.data.id}`, 'DELETE');
  check('删除片段', removed.ok);
  const list2 = await api('/api/tasks');
  check('删除后列表', list2.ok && list2.data.length === 1);
  const badPatch = await api(`/api/tasks/${id}`, 'PATCH', { duration: 9999 });
  check('越界参数被收敛', badPatch.ok && badPatch.data.duration <= 15);

  // 上传 + 媒体流
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c626001000000ffff03000006000557bfabd40000000049454e44ae426082', 'hex');
  const up = await fetch(url + '/api/upload?kind=image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent('测试 图.png') },
    body: png,
  });
  const upBody = await up.json();
  check('上传图片', upBody.ok && upBody.data.path.endsWith('.png') && fs.existsSync(upBody.data.path));
  const media = await fetch(`${url}/media?path=${encodeURIComponent(upBody.data.path)}`);
  check('媒体文件可访问', media.status === 200 && media.headers.get('content-type') === 'image/png');
  await media.arrayBuffer();
  const ranged = await fetch(`${url}/media?path=${encodeURIComponent(upBody.data.path)}`, { headers: { Range: 'bytes=0-9' } });
  check('Range 请求 206', ranged.status === 206 && ranged.headers.get('content-range').startsWith('bytes 0-9/'));
  await ranged.arrayBuffer();
  const relative = await fetch(`${url}/media?path=${encodeURIComponent('etc/passwd')}`);
  check('非绝对路径被拒绝', relative.status === 400);
  await relative.text();
  const outside = await fetch(`${url}/media?path=${encodeURIComponent('/etc/hosts')}`);
  check('数据目录外的绝对路径被拒绝（403）', outside.status === 403);
  await outside.text();
  // Host 是 fetch 的禁用头，改用原生 http 验证 DNS rebinding 防护
  const http = require('http');
  const rawGet = (hostHeader) => new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request({ host: u.hostname, port: u.port, path: '/', headers: { Host: hostHeader } }, (res) => {
      res.resume();
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject);
    req.end();
  });
  check('非回环 Host 被拒绝（DNS rebinding 防护）', (await rawGet('evil.example.com')) === 403);
  check('localhost Host 正常访问', (await rawGet(`localhost:${new URL(url).port}`)) === 200);

  // SSE
  const es = await fetch(url + '/api/events');
  check('SSE 事件流', es.status === 200 && es.headers.get('content-type').includes('text/event-stream'));
  await es.body.cancel();

  // 提交（无真实 Key，应失败但流程完整）
  const submitted = await api(`/api/tasks/${id}/submit`, 'POST');
  check('提交流程可走通（无 Key 时失败入列）', submitted.ok && (submitted.data.status === 'queued' || submitted.data.status === 'failed'));

  server.close();
  console.log(`\n结果：${passed} 通过，${failed} 失败\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error('\n测试运行出错：', err);
  process.exit(1);
});
