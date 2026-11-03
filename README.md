# desktop-dragon

<p align="left">
  <img src="assets/icons/app.png" width="240" height="240" alt="Desktop Dragon：扒着图标下沿的Q版白龙娘头像">
</p>

面向 macOS、Windows 的桌面龙娘，用分层动画显示已观察到的 Codex 会话、工具和子代理活动。支持点击反馈、拖动、形态切换、左右边缘飞行与扒边，以及右键会话查询。软件只读取状态，人物交互只改变本地表现。

实现范围和平台限制见[架构说明](docs/architecture.md)。

## 安装与运行

### macOS Apple Silicon 预览版

首个预览版为 `0.1.0-alpha.1`，仅提供 Apple Silicon（M 系列芯片）Mac 的 ZIP。应用包声明最低需要 macOS 13，尚未逐版本验证兼容性；本次不提供 Intel Mac 或 Windows 安装包。

1. 从 [本次 Release](https://github.com/MXMX0811/desktop-dragon/releases/tag/v0.1.0-alpha.1) 下载 macOS arm64 ZIP 并解压。
2. 将 `Desktop Dragon.app` 移到“应用程序”，然后打开。
3. 本版本尚无 Developer ID 签名和 Apple 公证。若首次打开被系统阻止，确认下载来源后，按 [Apple 官方说明](https://support.apple.com/en-us/102445)，在“系统设置 → 隐私与安全”中选择“仍要打开”，再确认打开。

打包应用已包含运行环境与素材，使用桌宠无需安装 Node.js 或 Python。macOS 下不显示 Dock 图标；可通过人物右键或菜单栏托盘操作、隐藏和退出。首次运行可用右键菜单审阅动作，详见[本版发布说明](docs/releases/0.1.0-alpha.1.md)。

显示真实 Codex 活动需另行安装 Node.js 22.13 或更新版本，取得并保留本仓库，在仓库根目录运行 `npm ci`，再按[钩子接入说明](desktop/codex-hooks/README.md)完成注册、信任与数据目录选择。接收器依赖仓库脚本；移动仓库或修改命令后需重新审阅信任。应用不会自动安装钩子。

### 从源码运行

需要 Node.js 22.13 或更新版本。克隆仓库后在仓库根目录运行：

```sh
npm ci
npm start
```

运行模块、贴图、视频和第三方动画库均随仓库交付，运行时无需原美术制作目录。源码运行的 Codex 接入步骤与上述预览版相同。

### 人物操作

- 单击人物播放反馈；休眠时单击唤醒。
- 拖动人物到显示器外侧的左、右边缘并松手，播放飞行后扒边；向屏幕内拖回恢复当前活动。
- 子代理小云在拖动时收起；放下后，仍有子代理活动时重新出现。
- 阅读、工作、绘图支持连续三击或右键菜单切换 Q 版与正比。
- 右键菜单“查看会话状态”打开面板；“启用 Codex 状态采集”控制采集，“跟随会话状态”退出动作审阅。托盘也提供采集、显示/隐藏、回到屏幕内、选择钩子目录和退出。

## 状态采集

开发运行使用仓库的 `.local/codex-hooks/`；打包应用使用 Electron 用户数据目录下的 `codex-hooks/`。若接收器写入其他位置，在菜单选择其数据目录，确保桌面与接收器使用同一目录。选择目录不会注册或信任钩子。

主进程每秒检查新事件。应用启动前的记录归为历史；关闭采集后停止新增记录和轮询，人物回到待机；重新开启只观察新活动。面板区分最近事件、本次接收量和注册项数，注册存在不代表已受信或当前聊天已连接。

事件仅记录必要元数据，不保存提示词、命令正文、工具结果或凭据。完整会话及调用标识仅保留在本地，`.local/`不提交、不打包，也不通过资源协议或预览服务器提供。`Stop`表示已观察停止，不代表成功；`PermissionRequest`不能单独证明正在等待审批。账户用量、待办正文、原会话跳转和准确根任务归属尚未接入。

在仓库根目录查询开发数据：

```sh
npm run hooks:status
npm run hooks:watch
```

## 检查与打包

```sh
npm test
python3 -m unittest discover -s app/runtime/bridge -p 'test_*.py'
npm run package
```

GitHub Actions 在每次推送和拉取请求运行同一组 Node 与 Python 测试。Python 3 仅用于 JSONL 桥测试及浏览器预览。打包使用锁定版本的 Electron Packager，在 `out/` 生成当前主机平台的应用；尚未配置签名、公证或安装器。

发布时同步`package.json`与锁文件版本，准备`docs/releases/{版本号}.md`，提交后推送对应的`v{版本号}`标签。发布工作流在macOS arm64完成测试、打包与上传，再公开Release；带`alpha`、`beta`等后缀的版本标记为预发布。

浏览器动画审阅：

```sh
npm run preview
```

打开[状态展示](http://127.0.0.1:55888/runtime/index.html)或[动画检查](http://127.0.0.1:55888/runtime/inspect.html)。浏览器预览用于查看人物动作与状态切换。

## 模块与设计记录

| 内容 | 入口 |
| --- | --- |
| 原生窗口、托盘、资源协议、只读来源观察 | `desktop/main/` |
| 有限 IPC 接口 | `desktop/preload/` |
| 桌面人物宿主、面板、屏幕坐标与命中区域 | `app/desktop/` |
| 共用状态策略、交互、动画宿主及审阅页面 | [app/runtime/](app/runtime/README.md) |
| 钩子接收、采集开关、事实归并与查询 | [desktop/codex-hooks/](desktop/codex-hooks/README.md) |
| 状态动画与贴图 | `assets/animations/{state}/{form}/scene.js`、`textures/` |
| 共用部件与运行库 | `assets/shared/`、`assets/vendor/` |

软件功能在本仓库开发；绘图、补绘、分层与动画组装在制作工作区完成后，按[资产交付约定](docs/asset-delivery.md)整体交付。

- [工作约定](AGENTS.md)、[架构与实施状态](docs/architecture.md)。
- [钩子实现与验证](docs/codex-hooks-implementation.md)、[首轮可行性观察](docs/codex-hooks-test.md)。
- [资产目录](docs/asset-catalog.md)、[交付清单](asset-delivery.json)、[第三方来源](THIRD_PARTY_NOTICES.md)。
- [动画设计经验](docs/animation-design-guide.md)、[动作设计模板](docs/state-design-template.md)。
