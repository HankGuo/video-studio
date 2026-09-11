# TokenDance 视频接入助手 VideoStudio

一个跑在本机的**视频生成 Playground**，接入 [词元跳动 TokenDance](https://tokendance.space/) 统一模型网关上的全部视频生成模型——MiniMax H3 / H3 Max、通义万相 Wan3.0 / Prime、Seedance 2.0 / 2.5 全系、可灵 Kling 3.0 / Omni、HappyHorse 1.0 / 1.1 全系。一个 API Key，把原本需要手写 API 请求的创作过程，变成看得见、点得动的桌面体验：多段视频并行生成，每段独立选择模型与参数，完成后自动下载到本地，随时回看。

它本质上是一个**协议转换控制台**：填表单 → 组装成各模型的 API 请求 → 跟踪状态 → 下载结果，仅此而已。

> **定位声明**：本项目是社区自发的**非官方** Playground，与词元跳动官方无隶属关系；模型能力、价格、可用性以[官方平台](https://tokendance.space/)为准。

![片段编辑器](docs/screenshots/editor.png)

## 下载（双击即用，无需安装任何环境）

到 [Releases](https://github.com/HankGuo/video-studio/releases) 下载对应平台的包：

| 平台 | 下载 | 首次打开 |
| --- | --- | --- |
| macOS（Apple 芯片） | [VideoStudio-0.1.0-mac-arm64.zip](https://github.com/HankGuo/video-studio/releases/download/v0.1.0/VideoStudio-0.1.0-mac-arm64.zip) | 首次需执行一次 `xattr`，见下方 |
| macOS（Intel） | [VideoStudio-0.1.0-mac-x64.zip](https://github.com/HankGuo/video-studio/releases/download/v0.1.0/VideoStudio-0.1.0-mac-x64.zip) | 同上 |
| Windows | [VideoStudio-0.1.0-win-setup.exe](https://github.com/HankGuo/video-studio/releases/download/v0.1.0/VideoStudio-0.1.0-win-setup.exe)（安装向导）/ [绿色 zip](https://github.com/HankGuo/video-studio/releases/download/v0.1.0/VideoStudio-0.1.0-win-x64.zip) | SmartScreen 提示时点「更多信息 → 仍要运行」 |
| Linux | [VideoStudio-0.1.0-linux-x86_64.AppImage](https://github.com/HankGuo/video-studio/releases/download/v0.1.0/VideoStudio-0.1.0-linux-x86_64.AppImage)（[arm64 版](https://github.com/HankGuo/video-studio/releases/download/v0.1.0/VideoStudio-0.1.0-linux-arm64.AppImage)） | `chmod +x` 后双击运行 |

### macOS 首次打开必读

macOS 包用的是 ad-hoc 签名，没有 Apple 开发者证书、也没做公证（notarization），所以系统一定会拦一次。把 app 拖进「应用程序」后，执行一次这条命令即可：

```bash
xattr -cr "/Applications/TokenDance 视频接入助手.app"
```

也可以走图形界面：双击后到「系统设置 → 隐私与安全性」，在底部找到被拦截的提示，点「仍要打开」。

> **不要再用「右键 → 打开」这个老办法。** 它只对「无法验证开发者」有效，对签名损坏的包无效；而且从 macOS 15 起 Apple 已逐步取消这个入口，在新系统上根本不会出现「打开」按钮。这个项目早期的安装包因为构建配置写错（`identity: null` 会让 Electron 跳过签名、在包里留下失效的旧签名），在 macOS 上会被判定为「文件已损坏」并直接扔进废纸篓——那个问题已经修掉，从 v0.1.0 起用的是正确的 ad-hoc 签名。

Windows 包同样没有代码签名证书，首次运行 SmartScreen 会拦一次，点「更多信息 → 仍要运行」即可。

首次启动会引导你填入[词元跳动平台](https://tokendance.space/)的 API Key——在设置里点「一键授权」，浏览器确认后自动完成，全程 PKCE 安全流程。

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

模型目录内置在应用里（`main/models.js`），包含每个模型支持的生成方式、分辨率档位、时长范围、画面比例与单价。每次启动还会匿名拉取网关的公开模型清单并与内置目录合并，新模型上架即刻可用。

## 功能特性

- **全量视频模型一网打尽**：按厂商分组的可视化模型选择器，官方品牌标识、能力、单价、限时折扣一目了然
- **四种生成方式**：文生视频 / 图生视频（首帧、首尾帧）/ 多模态参考生视频（参考图 + 参考视频 + 参考音频）/ 视频编辑，按模型能力自动收敛可用选项
- **多片段并行**：一次性排布多段视频，每段的模型、生成方式、时长、画质、画面比例完全独立
- **费用预估**：编辑器底部按当前模型 / 画质 / 时长实时计算预估费用，提交前心里有数
- **本地素材直传**：首帧与参考图支持直接选择本地图片，也可以粘贴公开可访问的 URL
- **状态自动跟踪**：提交后自动轮询，排队中 / 生成中 / 已完成实时刷新；完成后视频自动落盘本地，页面内直接播放
- **深色 / 日间 / 跟随系统三种主题**，顶栏一键切换，选择记忆在本机
- **新手引导遮罩**：首次启动四步聚光灯导览（连接网关 → 新建片段 → 配置提交 → 任务队列），顶栏「?」随时重放
- **队列状态筛选**：全部 / 草稿 / 进行中 / 完成 / 失败一键过滤，带实时计数

![多片段队列](docs/screenshots/queue.png)

## 为什么这么简单

经常有"视频工作台"会做画布、时间线、轨道剪辑，这个项目明确不做。与其铺一堆半成品功能，不如把"选模型 → 填参数 → 出片"这一条链路打磨到顺手；它的价值是让你用最低成本试遍各个模型、对比效果、攒下素材，真正的剪辑合成交给专业的剪辑软件去做。功能边界即产品尊严。

简单不等于不放心——**你的数据永远是你的**：

- API Key 仅保存在你本机，素材与生成的视频不出本机一步（素材只在提交任务时发送给你自己配置的网关）
- 应用没有服务器端、没有账号体系、没有遥测上报，本地服务仅监听 `127.0.0.1`，连局域网都访问不到
- 全部代码开源，可逐行审计验证

数据落盘位置（可用环境变量 `VIDEO_STUDIO_USER_DATA` 整体覆盖）：

| 平台 | 配置与视频 |
| --- | --- |
| macOS | `~/Library/Application Support/video-studio` |
| Windows | `%APPDATA%\video-studio` |
| Linux | `~/.config/video-studio` |

## 使用说明

1. 打开应用，在设置里完成「一键授权」（或粘贴 API Key），点「测试连接」确认后保存
2. 点「新建片段」，选择模型（表单会自动收敛到该模型支持的范围），填写提示词、配置时长画质
3. 可以连续新建多段，每段独立配置；点「开始生成」提交单段，或「提交全部草稿」一次性提交
4. 等待 1–3 分钟，生成完成后视频自动下载到本地，点击即可播放、导出

## 从源码运行

唯一前置依赖是 **Node.js 18 或更高版本**（[下载地址](https://nodejs.org/)）。运行时零第三方依赖、零构建步骤，`npm install` 只是为了打安装包。

```bash
git clone https://github.com/HankGuo/video-studio.git
cd video-studio
npm start
```

启动后浏览器会自动打开 `http://127.0.0.1:8970`，用完在终端按 `Ctrl+C` 结束。不想碰终端的话，双击启动器效果一样：macOS 用 `start.command`，Windows 用 `start.bat`，Linux 用 `start.sh`。

端口被占用时可以换：`VIDEO_STUDIO_PORT=9000 npm start`。重复启动不会开重复的服务——已有实例在跑时，再次启动只会帮你多开一个标签页。

自测与打包：

```bash
npm test              # 25 项接口自测
npm run pack:mac      # 打 macOS 包（arm64 + x64）
npm run pack:win      # 打 Windows 包（NSIS 安装向导 + 绿色 zip）
npm run pack:linux    # 打 Linux 包（AppImage，x64 + arm64）
```

### 桌面版是怎么来的

桌面版是一个 ~70 行的 Electron 薄壳（`desktop/main.js`），职责只有两件：起本地服务、开一个**没有地址栏、没有导航、没有菜单栏**的独立窗口指过去。壳里没有 IPC、没有 preload，窗口与内核之间走的就是 `127.0.0.1` 上的普通 HTTP/SSE——和浏览器版是同一份代码，不会分叉。

## 反馈与吐槽

有问题、有想法、用得不爽，都欢迎到 [Issues](https://github.com/HankGuo/video-studio/issues) 里直接说，吐槽也欢迎。

企业或团队如需私有化部署、功能定制或商业支持，可联系：**superai@agent.qq.com**。

## 开源授权

本项目采用 [MIT License](LICENSE)，**商业使用完全开放**：欢迎二次开发，修改、分发、再发布均不受限制。

## 特别鸣谢

本项目构建于 [词元跳动 TokenDance](https://tokendance.space/) 之上——为接入 AI 模型的开发者打造的统一模型 API 网关：多协议兼容、智能路由、统一计费、容错降级，秉承"让每位 AI 创造者，少走一步弯路"的理念。在此致以诚挚谢意。

## 关注博主「算力白肉」

一个很懒的博主：年更、月更、不定期更。配套公众号文章：[《你的 API Key 是不是又在吃灰？》](https://mp.weixin.qq.com/s/DZIaSGb60VXe2NdTmChWiQ)，欢迎阅读、点赞、转发。

![公众号「算力白肉」二维码](docs/wechat-qr.jpg)
