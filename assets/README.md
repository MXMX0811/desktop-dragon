# 资产

每种已交付状态使用相同的目录布局：

```text
animations/<state>/<form>/
  scene.js       # 场景入口
  textures/      # 当前场景使用的图片
  *.js           # 此场景需要的控制、动作、表情等模块
  layout.json    # 仅在场景实际需要时保存部件坐标
shared/          # 共用控制器、效果、校色与共用 textures
vendor/          # 运行依赖及许可证
references/      # 已选定的人物参考图
icons/           # 已采纳的应用图标：PNG原图、ICNS与ICO容器
```

`state` 使用 `standby`、`reading`、`work`、`drawing`、`thinking`；`form` 使用 `chibi` 或 `normal`。不存在的状态与形态不创建空目录。待确认与点击反馈属于原场景，待机、休眠、唤醒共用待机模型。

所有状态均由 `scene.js` 进入。控制器按现有动画实现由该入口导出、独立模块提供或共用；宿主位于 `app/runtime/animation-host.js`。软件层不复制纹理，也不持有素材分层逻辑。

共用坐姿身体、尾巴与翅膀放在 `shared/textures/chibi-seated/`；工作和绘图共用眼部放在 `shared/textures/drawing-eyes/`。单个状态专用的图片放回自己的 `textures/`。

目录和文件使用状态、部件与用途命名，不使用重绘次数、候选标记或版本号。来源及确认范围见根目录 `asset-delivery.json` 和 `docs/asset-catalog.md`，制作源的相对目录与文件名保留原名用于追溯，外部根目录使用脱敏占位符。

候选、历史稿、加工脚本和审阅截图留在制作工作区。更新资产时按当前结构整体交付运行所需文件，再检查八组现有动画与状态切换。

`icons/app.png`为用户采纳的彩色头像原图，同时用于README teaser；`app.icns`与`app.ico`由同一原图缩放导出。打包入口使用`icons/app`，由Electron Packager按目标平台选择扩展名。

子代理小助手是跨状态叠加层，集中在 `shared/subagents/`：入口`scene.js`、样式`style.css`、两张图片`textures/sora.png`和`textures/codex.png`。人物动画与软件事实归并不放进此模块。
