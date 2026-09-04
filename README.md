# TokenDance 视频接入助手 VideoStudio

一款运行在 macOS 上的本地视频生成工作台，接入 **[词元跳动 TokenDance](https://tokendance.space/) 统一模型网关上的全部 17 个视频生成模型**——MiniMax H3 / H3 Max、通义万相 Wan3.0 / Prime、Seedance 2.0 / 2.5 全系、可灵 Kling 3.0 / Omni、HappyHorse 1.0 / 1.1 全系。一个 API Key，五种视频协议，把原本需要手写 API 请求的创作过程，变成看得见、点得动的可视化体验：多段视频并行生成，每段独立选择模型与参数，完成后自动下载到本地，随时回看。

![片段编辑器](docs/screenshots/editor.png)

## 支持的模型

| 模型 | 生成方式 | 分辨率 | 时长 | 计费 |
| --- | --- | --- | --- | --- |
| MiniMax H3 | 文生 / 图生 / 参考生 | 768P · 2K | 1–15s | ¥0.45–0.72/秒 |
| MiniMax H3 Max（极速） | 文生 / 图生 | 480P · 768P | 5–15s | ¥0.198–0.3/秒 |
| Wan3.0 / Wan3.0 Prime | 文生 / 图生 / 参考 / 编辑 | 480P–1080P | 2–30s | ¥0.21–1.44/秒 |
| Seedance 2.5 | 文生 / 图生 / 参考 / 编辑 | 480p–1080p | 4–30s | 按输出 token |
| Seedance 2.0 / Fast / Mini | 文生 / 图生 / 参考 | 最高 4K（2.0） | 4–15s | 按输出 token |
| 可灵 3.0 | 文生 / 图生（首末帧） | 720p–4K | 3–15s | ¥0.48–2.4/秒 |
| 可灵 3.0 Omni | 文生 / 图生 / 参考 / 编辑 | 720p · 1080p | 3–15s | 见平台模型页 |
| HappyHorse 1.1（文/图/参考） | 对应单一模式 | 480P–1080P | 3–15s | ¥0.225–0.6/秒 |
| HappyHorse 1.0（文/图/参考/编辑） | 对应单一模式 | 720P · 1080P | 3–15s | ¥0.9–1.6/秒 |

模型目录内置在应用里（`main/models.js`），包含每个模型支持的生成方式、分辨率档位、时长范围、画面比例与单价，选择模型后表单自动收敛到该模型支持的范围。

## 功能特性

- **17 个视频模型一网打尽**：按厂商分组的可视化模型选择器，能力、单价、限时折扣一目了然
- **四种生成方式**：文生视频 / 图生视频（首帧、首尾帧）/ 多模态参考生视频（参考图 + 参考视频 + 参考音频）/ 视频编辑，按模型能力自动可用
- **多片段并行**：一次性排布多段视频，每段的模型、生成方式、时长、画质、画面比例完全独立，互不干扰
- **本地素材直传**：首帧与参考图支持直接选择本地图片（自动转为 base64 提交），也可以粘贴 URL
- **状态自动跟踪**：提交后自动轮询，排队中 / 生成中 / 已完成一目了然
- **视频自动落盘**：生成结果自动下载到本地（远程地址 24 小时后失效，本地文件永久保留）
- **全局设置**：网关地址与 API Key 可视化配置，支持一键测试连通性，本地保存
- **历史保留**：全部片段与配置本地持久化，重启不丢；中断的任务重启后自动续传；v1 的任务与设置自动迁移

![多片段队列](docs/screenshots/queue.png)

![空状态](docs/screenshots/empty.png)

## 下载与安装

1. 前往 [Releases 页面](https://github.com/HankGuo/video-studio/releases) 下载最新版安装包（Apple Silicon）。
2. 打开 DMG，把 TokenDance Video Studio 拖入「应用程序」文件夹。
3. 首次打开如提示"无法验证开发者"：在「应用程序」中右键应用图标 →「打开」即可（应用未做付费签名，源码完全公开，可放心自查）。
4. 首次启动会自动引导你进入「设置」：填入你在[词元跳动平台](https://tokendance.space/)的 API Key，点击「测试连接」确认后保存。

## 使用说明

1. 点击右上角「新建片段」，在编辑器顶部选择模型（不同模型支持的生成方式、分辨率与时长不同，表单会自动适配）。
2. 选择生成方式，填写提示词，配置时长、画质与画面比例；参考生 / 编辑模式按要求添加素材。
3. 配置自动保存。可以连续新建多段，每段独立配置。
4. 点击「开始生成」提交单段，或点顶部「提交全部草稿」一次性提交。
5. 等待 1–3 分钟，生成完成后视频自动下载到本地，直接点击播放；也可以在 Finder 中查看或导出。

数据存放位置：`~/Library/Application Support/video-studio/`（设置 `settings.json`、任务 `tasks.json`、视频 `videos/`）。

## 技术栈

- **Electron**：应用壳与主进程，负责任务队列、状态轮询、视频下载与本地持久化
- **原生 HTML / CSS / JS** 渲染层：零框架、零构建，深色控制台风格界面（IBM Plex Sans + JetBrains Mono 本地字体）
- **词元跳动统一模型网关**，五种视频协议适配：
  - `minimax:video_generation_v2`（MiniMax H3 系列）
  - `seedance:generations`（Ark 异步任务，Seedance 全系）
  - `wan3:video-synthesis`（阿里百炼异步任务，Wan3.0 系列）
  - `happyhorse:video-synthesis`（DashScope 异步任务，HappyHorse 全系）
  - `kling:text2video / image2video / omni-video`（可灵 3.0 与 Omni）

## 特别鸣谢

本项目整套技术能力构建于 [词元跳动 TokenDance](https://tokendance.space/) 之上，在此致以诚挚谢意。

词元跳动是为接入 AI 模型的开发者打造的统一模型 API 网关，秉承"让每位 AI 创造者，少走一步弯路"的理念：

- **多协议兼容**：原生支持 OpenAI / Claude / Gemini 协议，覆盖文本、图像、视频、语音生成，切换 Base URL 即可接入，零迁移成本
- **智能路由**：根据模型名称自动路由至对应供应商，一个入口，无需关心底层调度
- **统一计费**：跨供应商统一 Token 消耗统计与账单，告别多平台分别充值的混乱
- **容错降级**：同一模型支持多供应商端点自动切换，保障服务持续可用
- **模型丰富**：接入 MiniMax、通义千问、Kimi、智谱、DeepSeek、Seedance、可灵等国内头部模型，持续扩展中

## 开源授权

本项目采用 [MIT License](LICENSE)，**商业使用完全开放**：欢迎二次开发，欢迎直接用于任何商业场景，修改、分发、再发布均不受限制。本项目为个人作品，不保证持续维护，大家拿走改就是了。

## 安全与隐私

本应用为纯本地工具：

- API Key 仅保存在你本机的应用数据目录（`settings.json`），不会上传到你的接入点以外的任何服务器
- 无任何遥测、统计与上报行为
- 全部源代码公开，可逐行审计——开源版本不内置任何密钥，不必担心自己的 API Key 因使用本应用而泄露

## 本地开发与测试

```bash
git clone https://github.com/HankGuo/video-studio.git
cd video-studio

npm install
npm start          # 开发模式运行
npm run pack:dmg   # 打包 DMG 安装包

# 端到端测试（驱动真实界面、真实调用 API，请自备 Key）
VIDEO_STUDIO_TEST_KEY=sk-xxx node test/e2e.js

# 打包产物冒烟测试
node test/smoke.js
```

## 致谢 WorkBuddy × Kimi

本项目 v1 由 [WorkBuddy](https://www.codebuddy.cn/work/) 搭载 Kimi K3 模型独立完成，v2 全量模型扩展由 Kimi Code 完成。作者只负责提需求、喝茶和验收。这本身就是一次"AI 造 AI 工具"的完整实践。

## 关注博主「算力白肉」

一个很懒的博主：年更、月更、不定期更。偶尔发发心得，偶尔发发广子，反正都是随意发挥。喜欢的可以关注一下。

配套公众号文章（本项目 v1 的完整故事）：[《你的 API Key 是不是又在吃灰？》](https://mp.weixin.qq.com/s/DZIaSGb60VXe2NdTmChWiQ)，欢迎阅读、点赞、转发，希望大家支持。

![公众号「算力白肉」二维码](docs/wechat-qr.jpg)
