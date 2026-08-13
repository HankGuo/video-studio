'use strict';

/* 生成应用图标：将品牌 SVG 渲染为 1024x1024 PNG（assets/icon.png） */

const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect x="32" y="32" width="960" height="960" rx="216" fill="#FAF9F6"/>
  <rect x="34" y="34" width="956" height="956" rx="214" fill="none" stroke="#E4E1DA" stroke-width="4"/>
  <rect x="120" y="232" width="560" height="560" rx="112" fill="none" stroke="#2F3437" stroke-width="56"/>
  <path d="M372 414v196l168-98z" fill="#2F3437"/>
  <rect x="596" y="120" width="252" height="252" rx="56" fill="#C2643A"/>
</svg>`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1024,
    height: 1024,
    show: false,
    webPreferences: { offscreen: true },
  });
  const html = `<!DOCTYPE html><html><body style="margin:0;background:transparent">${svg}</body></html>`;
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  await new Promise((r) => setTimeout(r, 500));
  const img = await win.webContents.capturePage();
  const out = path.join(__dirname, '..', 'assets', 'icon.png');
  fs.writeFileSync(out, img.toPNG());
  console.log('written', out, img.getSize());
  app.quit();
});
