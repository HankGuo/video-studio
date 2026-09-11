'use strict';

// 主题引导：尽量在首次渲染前应用，避免闪烁（CSP 禁止内联脚本，所以放在最早加载的外链脚本里）
try {
  const pref = localStorage.getItem('td-theme') || 'system';
  const resolved = pref === 'system'
    ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
    : pref;
  document.documentElement.dataset.theme = resolved;
} catch { /* 默认深色 */ }

// 浏览器端桥接层：与本地 server.js 通信，暴露与原来 Electron preload 完全一致的
// window.studio 接口，app.js 无需感知底层从 IPC 换成了 HTTP + SSE。

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const body = await res.json().catch(() => null);
  if (!body || typeof body.ok !== 'boolean') {
    throw new Error(`请求失败（HTTP ${res.status}）`);
  }
  if (body.ok) return body.data;
  throw new Error(body.error || '操作失败');
}

const ACCEPT = {
  image: '.png,.jpg,.jpeg,.webp,.gif,image/png,image/jpeg,image/webp,image/gif',
  video: '.mp4,.mov,.webm,.m4v,video/mp4,video/quicktime,video/webm',
  audio: '.mp3,.wav,.m4a,.aac,audio/mpeg,audio/wav,audio/mp4,audio/aac',
};

// 用浏览器原生文件选择替代 Electron 的 dialog.showOpenDialog：
// 选中后上传到服务器（保存在数据目录 uploads/ 下），返回服务器侧路径
function pickAndUpload(kind) {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = ACCEPT[kind] || ACCEPT.image;
    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) {
        resolve(null);
        return;
      }
      try {
        const res = await fetch(`/api/upload?kind=${encodeURIComponent(kind)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            'X-File-Name': encodeURIComponent(file.name),
          },
          body: file,
        });
        const body = await res.json();
        if (!body || !body.ok) throw new Error((body && body.error) || `上传失败（HTTP ${res.status}）`);
        resolve(body.data); // { path, name }
      } catch (err) {
        reject(err);
      }
    };
    // 用户取消选择时不会触发 change，这里监听窗口重新获得焦点来兜底
    let settled = false;
    const settle = (fn, v) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('focus', onFocus);
      fn(v);
    };
    const onFocus = () => setTimeout(() => {
      if (!input.files || !input.files.length) settle(resolve, null);
    }, 400);
    const origResolve = resolve;
    const origReject = reject;
    resolve = (v) => settle(origResolve, v);
    reject = (e) => settle(origReject, e);
    window.addEventListener('focus', onFocus);
    input.click();
  });
}

window.studio = {
  getSettings: () => api('/api/settings'),
  saveSettings: (patch) => api('/api/settings', { method: 'PUT', body: JSON.stringify(patch) }),
  testSettings: (draft) => api('/api/settings/test', { method: 'POST', body: JSON.stringify(draft || {}) }),

  getAppInfo: () => api('/api/app/info'),
  checkUpdate: () => api('/api/update/check'),

  listModels: () => api('/api/models'),
  syncModels: () => api('/api/models/sync', { method: 'POST', body: '{}' }),
  connectTokenDance: () => api('/api/oauth/connect', { method: 'POST', body: '{}' }),
  cancelConnect: () => api('/api/oauth/cancel', { method: 'POST', body: '{}' }),

  listTasks: () => api('/api/tasks'),
  createTask: (config) => api('/api/tasks', { method: 'POST', body: JSON.stringify(config || {}) }),
  updateTask: (id, patch) => api(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(patch || {}) }),
  duplicateTask: (id) => api(`/api/tasks/${id}/duplicate`, { method: 'POST', body: '{}' }),
  removeTask: (id) => api(`/api/tasks/${id}`, { method: 'DELETE' }),
  submitTask: (id) => api(`/api/tasks/${id}/submit`, { method: 'POST', body: '{}' }),
  submitAllTasks: () => api('/api/tasks/submit-all', { method: 'POST', body: '{}' }),
  redownloadTask: (id) => api(`/api/tasks/${id}/redownload`, { method: 'POST', body: '{}' }),

  pickMedia: (kind) => pickAndUpload(kind),
  revealVideo: (filePath) => api('/api/reveal', { method: 'POST', body: JSON.stringify({ path: filePath }) }),
  openVideo: (filePath) => api('/api/open', { method: 'POST', body: JSON.stringify({ path: filePath }) }),

  // 任务状态推送：SSE 替代原来的 ipcRenderer.on('tasks:changed')
  onTasksChanged: (callback) => {
    const es = new EventSource('/api/events');
    es.onmessage = (e) => {
      try { callback(JSON.parse(e.data)); } catch { /* 忽略坏帧 */ }
    };
    return () => es.close();
  },
};
