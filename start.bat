@echo off
rem TokenDance 视频接入助手 —— Windows 双击启动器
rem 双击本文件即可启动工作台，浏览器会自动打开

cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   未检测到 Node.js。
  echo   请先安装 Node.js 18 或更高版本：https://nodejs.org/
  echo   （安装完成后重新双击本文件即可）
  echo.
  pause
  exit /b 1
)

node server.js
if errorlevel 1 pause
