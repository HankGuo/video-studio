#!/bin/sh
# TokenDance 视频接入助手 —— Linux / macOS 启动器
# 执行 ./start.sh 即可启动工作台，浏览器会自动打开

cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "  未检测到 Node.js。"
  echo "  请先安装 Node.js 18 或更高版本：https://nodejs.org/"
  echo ""
  exit 1
fi

exec node server.js
