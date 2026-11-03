# 当前资产交付范围

2026-11-02目录整理及最新动画交付。整体动画确认依据为2026-10-31用户原话“确认所有当前动画实现”；11月2日用户进一步确认最新状态并要求更新仓库，范围见 `accepted-animations-2026-11-02.txt`。仓库只保留当前交付，制作版本与源路径在来源记录中追溯。

| 资产 | 当前交付 | 确认与限制 |
| --- | --- | --- |
| 彩色应用图标与README teaser | `assets/icons/app.png`、`app.icns`、`app.ico` | 11/03用户提供并明确采纳Q版扒边头像；PNG保留1254×1254原图，ICNS/ICO仅作尺寸与容器转换。README左对齐展示。菜单栏黑白候选未随本次采纳 |
| Q版待机、休眠、掩嘴哈欠唤醒 | `assets/animations/standby/chibi/scene.js` | 10/29唤醒采用，10/31整体确认；唤醒1.5倍、点击振翅、醒后振翅，沿用后续呼吸调幅 |
| 正比阅读与待确认 | `assets/animations/reading/normal/scene.js` | 双手握书，自动连翻；等待往返最初3倍速，10/31确认 |
| 正比工作与待确认 | `assets/animations/work/normal/scene.js` | 自然敲键手、摘戴眼镜/托腮、1.5倍往返，10/31确认 |
| Q版阅读与待确认 | `assets/animations/reading/chibi/scene.js` | 10/31整体确认 |
| Q版工作与待确认 | `assets/animations/work/chibi/scene.js` | 电脑椅及腿上笔记本；11/01按用户要求替换趴卧、修肩与五指；沿用修订，未单独复述采纳 |
| Q版绘图与待确认 | `assets/animations/drawing/chibi/scene.js` | 无眼镜，浮现图稿，10/31整体确认 |
| 正比绘图与待确认 | `assets/animations/drawing/normal/scene.js` | 无眼镜，浮现图稿，10/31整体确认 |
| Q版思考 | `assets/animations/thinking/chibi/scene.js` | 站立全身，10/31整体确认 |
| Q版拖拎与惯性摆动 | `assets/animations/drag/chibi/scene.js` | 11/02按用户“好的，请进行真实桌面实现”沿用当前制作预览交付；2.5头身、闭眼开口笑、较慢回正；不追记为此前单独采纳 |
| Q版扒边探头 | `assets/animations/peek/chibi/scene.js` | 同次桌面实施交付，整图裁切至左右边缘；左侧镜像，保留当前肤色 |
| Q版飞行 · 60fps | `assets/animations/flight/chibi/scene.js`、`textures/flight.webm` | 11/02用户明确“采纳60帧版本”；5640源片、1112×834、290帧、源时长约4.834秒透明VP9；按后续要求1.5倍速播放约3.22秒。已接原生桌面左右边缘松手触发，macOS右侧飞行、扒边及拖回已实测 |
| 共用控制器、校色、问号、终端、图稿与角色部件 | `assets/shared/` | 保留已有动画的共用实现；沿用用户要求的校色修订，校色后单独采纳未记录 |
| 子代理小云、同步环绕与点击反馈 | `assets/shared/subagents/scene.js`、`style.css`和`textures/` | 11/02确认，Q版半径0.85；11/03按用户要求在人物整体缩小至90%时将云朵实际放大约10%，同步环绕一圈由6秒改为4秒，常驻周期18秒。已接桌面只读观察器的子代理活动计数，任务场景出现双云。11/03已实测单个子代理的独立轮次、启动/结束计数及原生双云显隐；复杂嵌套归属仍待验证，不以造型推断模型品牌或任务数量 |
| 圆云变身与渐变调度 | `assets/shared/transformation-cloud.js`、`app/runtime/scene-fade.js` | 使用当前软件表现与切换实现 |
| 正比原始图、三视图、Q版A母图与选定静态状态 | `assets/references/` | 使用语义文件名；用于形象校验与来源参考，不代表全部都有生产动画 |

每种状态与形态采用同一布局：`scene.js`、`textures/`与必要模块并列。共用素材集中到 `assets/shared/textures/`；PixiJS、Delaunator及许可证在 `assets/vendor/`。

拖动态与探头吸附已按11月2日真实桌面实施指令，从当前制作预览交付。子代理小助手与小云环绕已按11月2日确认交付。正比待机/休眠/思考只有静态原画，不在当前八组运行组合中。

实际交付文件见根目录 `asset-delivery.json`。目标路径使用语义名称，来源字段保留制作区相对路径与真实文件名，外部根目录使用脱敏占位符。历史重绘、Remotion/Runway尝试、旧QA、依赖安装目录和会话数据不交付。

飞行于2026-11-02单独采纳60fps版本。视频来源为 `flight-animation/qa/timing-60fps/flight-60fps.webm`，模块来源为 `flight-animation/scene.mjs`；仓库只改写校色导入和视频相对地址。共享色板仅新增 `flight-chibi`，保留原有八种矩阵。审阅入口为 `app/review/flight.html`。模块按传入的松手眼部位置对齐首帧，播放中保持原视频路径；向左复用同一视频水平翻转。该次60fps单独采纳不包括拖拎和扒边；它们于同日后续真实桌面实施指令中按当前制作版交付。原生桌面验证由软件实施记录单独说明。

已知限制：5640源片的部分龙角曾越过画面上缘，补帧没有补回缺失轮廓；视频头发、睫毛和饰品细节比静态稿柔和，60fps增加中间位置而不增加空间细节。素材时间约1.65秒翼尖有半透明双轮廓，2.4833秒及2.7833秒翼缘仍有轻微残影（这些是视频时间，1.5倍速下实际经过时间相应缩短）。末两帧全透明，表示人物已完整离屏。此前 `flight-review` 的源片和审阅材料仍保留在制作档案，不是本次运行依赖。

正比阅读/工作已合并在各自 `scene.js` 中的重复源码，以及“候选未采用”等过期制作说明，也已移回上述制作档案。10月31日的用户确认原文保留在 `docs/accepted-animations-2026-10-31.txt`；本次整理不改写历史采用记录。

## 2026-11-02真实桌面实施所需交付

用户在讨论dsh-pet交互方案后明确“好的，请进行真实桌面实现”。本次沿用当前制作预览中的拖拎、扒边素材与控制器，完成桌面闭环所需交付；不把本次实施授权追记成此前对这两张素材的单独采纳。

拖拎完整母图来自 `desktop-states-2026-11-02/drag-chibi-v8-2p5-closed.png`，网格和惯性控制器来自 `drag-animation/`；扒边来自 `desktop-states-2026-11-02/peek-right-chibi-v3-colors.png` 与 `edge-animation/scene.mjs`。仓库使用语义目标名 `textures/character.png`，不改动像素与运动参数。

`app/runtime/interaction-scenes.js` 将三种交互资产接给现有软件手势调度，统一导出 `DRAG_WIDTH`、`taskEye`、`createDrag`、`createFlight` 和 `createPeek`。拖拎保留各局部角速度，飞行复用已采纳60fps/1.5倍模块，扒边使用整体镜像和边缘裁切。新增 `drag-chibi` 与 `peek-chibi` 校色矩阵，其余已交付矩阵保持原值。
