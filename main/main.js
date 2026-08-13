'use strict';

const path = require('path');
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const { SettingsStore } = require('./settings');
const { TaskManager } = require('./tasks');
const api = require('./api');

// 允许通过环境变量覆盖数据目录（测试隔离用）
if (process.env.VIDEO_STUDIO_USER_DATA) {
  app.setPath('userData', process.env.VIDEO_STUDIO_USER_DATA);
}

let win = null;
let settings = null;
let tasks = null;

const MEDIA_FILTERS = {
  image: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
  video: [{ name: '视频', extensions: ['mp4', 'mov', 'webm', 'm4v'] }],
  audio: [{ name: '音频', extensions: ['mp3', 'wav', 'm4a', 'aac'] }],
};

function ok(data) {
  return { ok: true, data };
}

function fail(err) {
  return { ok: false, error: err && err.message ? err.message : String(err) };
}

function handle(channel, fn) {
  ipcMain.handle(channel, async (_event, ...args) => {
    if (process.env.VIDEO_STUDIO_USER_DATA) {
      console.log('[ipc]', channel, JSON.stringify(args).slice(0, 160));
    }
    try {
      return ok(await fn(...args));
    } catch (err) {
      return fail(err);
    }
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1320,
    height: 840,
    minWidth: 1080,
    minHeight: 700,
    title: 'AI 视频工坊',
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#F7F5F0',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  win.on('closed', () => {
    win = null;
  });
}

function broadcast(list) {
  if (win && !win.isDestroyed()) {
    win.webContents.send('tasks:changed', list);
  }
}

app.whenReady().then(() => {
  const userData = app.getPath('userData');
  settings = new SettingsStore(path.join(userData, 'settings.json'));
  tasks = new TaskManager({
    storeFile: path.join(userData, 'tasks.json'),
    videoDir: path.join(userData, 'videos'),
    getSettings: () => settings.get(),
  });
  tasks.on('changed', broadcast);
  tasks.start();

  handle('settings:get', () => settings.get());
  handle('settings:save', (patch) => settings.save(patch));
  handle('settings:test', (draft) => api.testConnection({ ...settings.get(), ...(draft || {}) }));

  handle('tasks:list', () => tasks.list());
  handle('task:create', (config) => tasks.create(config || {}));
  handle('task:update', (id, patch) => tasks.update(id, patch || {}));
  handle('task:duplicate', (id) => tasks.duplicate(id));
  handle('task:remove', (id) => tasks.remove(id));
  handle('task:submit', (id) => tasks.submit(id));
  handle('task:submitAll', () => tasks.submitAll());
  handle('task:redownload', (id) => tasks.redownload(id));

  handle('dialog:pickMedia', async (kind) => {
    const result = await dialog.showOpenDialog(win, {
      title: '选择素材文件',
      properties: ['openFile'],
      filters: MEDIA_FILTERS[kind] || undefined,
    });
    if (result.canceled || !result.filePaths.length) return null;
    const filePath = result.filePaths[0];
    return { path: filePath, name: path.basename(filePath) };
  });

  handle('video:reveal', (filePath) => {
    if (filePath) shell.showItemInFolder(filePath);
  });
  handle('video:open', async (filePath) => {
    if (filePath) await shell.openPath(filePath);
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  if (tasks) tasks.stop();
});
