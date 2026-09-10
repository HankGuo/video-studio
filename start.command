#!/bin/bash
# TokenDance 视频接入助手 —— macOS 双击启动器
# 双击本文件（或在终端执行 ./start.command）即可启动工作台，浏览器会自动打开

cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "  未检测到 Node.js。"
  echo "  请先安装 Node.js 18 或更高版本：https://nodejs.org/"
  echo "  （安装完成后重新双击本文件即可）"
  echo ""
  read -r -p "按回车退出…"
  exit 1
fi

exec node server.js
