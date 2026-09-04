'use strict';

const { contextBridge, ipcRenderer } = require('electron');

function invoke(channel, ...args) {
  return ipcRenderer.invoke(channel, ...args).then((res) => {
    if (!res || typeof res.ok !== 'boolean') return res;
    if (res.ok) return res.data;
    throw new Error(res.error || '操作失败');
  });
}

contextBridge.exposeInMainWorld('studio', {
  getSettings: () => invoke('settings:get'),
  saveSettings: (patch) => invoke('settings:save', patch),
  testSettings: (draft) => invoke('settings:test', draft),

  listModels: () => invoke('models:list'),
  syncModels: () => invoke('models:sync'),

  listTasks: () => invoke('tasks:list'),
  createTask: (config) => invoke('task:create', config),
  updateTask: (id, patch) => invoke('task:update', id, patch),
  duplicateTask: (id) => invoke('task:duplicate', id),
  removeTask: (id) => invoke('task:remove', id),
  submitTask: (id) => invoke('task:submit', id),
  submitAllTasks: () => invoke('task:submitAll'),
  redownloadTask: (id) => invoke('task:redownload', id),

  pickMedia: (kind) => invoke('dialog:pickMedia', kind),
  revealVideo: (filePath) => invoke('video:reveal', filePath),
  openVideo: (filePath) => invoke('video:open', filePath),

  onTasksChanged: (callback) => {
    ipcRenderer.on('tasks:changed', (_event, list) => callback(list));
  },
});
