'use strict';

// TokenDance 视频接入助手 —— Electron 薄壳（仅分发形态，内核仍是 server.js 本地 Web 服务）
// 壳的职责：起一个本地服务 → 开一个无浏览器痕迹的独立窗口指过去。
// 无 IPC、无 preload：窗口与服务的通信走 127.0.0.1 HTTP/SSE，和浏览器版完全一致。

const path = require('path');
const { app, BrowserWindow, shell, dialog } = require('electron');
const { createStudio } = require('../server');

const PORT = Number(process.env.VIDEO_STUDIO_PORT || 8970);

let win = null;
let studio = null;

// 单实例：重复打开只聚焦已有窗口
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(async () => {
    let url = `http://127.0.0.1:${PORT}`;
    try {
      studio = await createStudio({ port: PORT, openBrowser: false });
      url = studio.url;
    } catch (err) {
      if (err.code !== 'EADDRINUSE') {
        dialog.showErrorBox('启动失败', String(err && err.message ? err.message : err));
        app.quit();
        return;
      }
      // 8970 已被占用 = 本机已有实例在跑（比如终端里的 npm start），窗口直接接入它
    }

    win = new BrowserWindow({
      width: 1440,
      height: 900,
      minWidth: 1180,
      minHeight: 720,
      title: 'TokenDance 视频接入助手',
      icon: path.join(__dirname, '..', 'assets', 'icon.png'),
      backgroundColor: '#131312',
      autoHideMenuBar: true,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    win.setMenuBarVisibility(false);

    // 任何新窗口/外链一律交给系统浏览器，本窗口内不出现浏览器行为
    win.webContents.setWindowOpenHandler(({ url: target }) => {
      if (/^https?:\/\//.test(target)) shell.openExternal(target);
      return { action: 'deny' };
    });

    win.loadURL(url);
  });

  app.on('window-all-closed', () => app.quit());
  app.on('will-quit', () => {
    if (studio) {
      try {
        studio.tasks.stop();
        studio.tasks.flush(); // 退出前强制落盘
      } catch { /* 尽力而为 */ }
    }
  });
}
