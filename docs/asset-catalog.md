# 当前资产交付范围

2026-11-02目录整理及最新动画交付。整体动画确认依据为2026-10-31用户原话“确认所有当前动画实现”；11月2日用户进一步确认最新状态并要求更新仓库，范围见 `accepted-animations-2026-11-02.txt`。仓库只保留当前交付，制作版本与源路径在来源记录中追溯。

| 资产 | 当前交付 | 确认与限制 |
| --- | --- | --- |
| 彩色应用图标与README teaser | `assets/icons/app.png`、`app.icns`、`app.ico` | 11/03用户提供并明确采纳Q版扒边头像；PNG保留1254×1254原图，ICNS/ICO仅作尺寸与容器转换。README左对齐展示。菜单栏黑白候选未随本次采纳 |
| Q版待机、休眠、掩嘴哈欠唤醒 | `assets/animations/standby/chibi/scene.js` | 10/29唤醒采用，10/31整体确认；唤醒1.5倍、点击振翅、醒后振翅，沿用当前呼吸调幅 |
| 正比阅读与待确认 | `assets/animations/reading/normal/scene.js` | 双手握书，自动连翻；等待往返最初3倍速，10/31确认 |
| 正比工作与待确认 | `assets/animations/work/normal/scene.js` | 自然敲键手、摘戴眼镜/托腮、1.5倍往返，10/31确认 |
| Q版阅读与待确认 | `assets/animations/reading/chibi/scene.js` | 10/31整体确认 |
| Q版工作与待确认 | `assets/animations/work/chibi/scene.js` | 电脑椅及腿上笔记本；11/01按用户要求替换趴卧、修肩与五指；沿用修订，未单独复述采纳 |
| Q版绘图与待确认 | `assets/animations/drawing/chibi/scene.js` | 无眼镜，浮现图稿，10/31整体确认 |
| 正比绘图与待确认 | `assets/animations/drawing/normal/scene.js` | 无眼镜，浮现图稿，10/31整体确认 |
| Q版思考 | `assets/animations/thinking/chibi/scene.js` | 站立全身，10/31整体确认 |
| Q版拖拎与惯性摆动 | `assets/animations/drag/chibi/scene.js` | 11/02按用户“好的，请进行真实桌面实现”沿用当前制作预览交付；2.5头身、闭眼开口笑、较慢回正；不追记为此前单独采纳 |
| Q版扒边探头 | `assets/animations/peek/chibi/scene.js` | 11/04按用户指令交付点击回弹与振翅，使用独立身体、翅膀与眼部层；常驻呼吸眨眼、左侧镜像，抓边接触线保持原位置 |
| Q版飞行 · 60fps | `assets/animations/flight/chibi/scene.js`、`textures/flight.webm` | 11/02用户明确“采纳60帧版本”；5640源片、1112×834、290帧、源时长约4.834秒透明VP9；按用户要求1.5倍速播放约3.22秒。已接原生桌面左右边缘松手触发，macOS右侧飞行、扒边及拖回已实测 |
| 共用控制器、校色、问号、终端、图稿与角色部件 | `assets/shared/` | 保留已有动画的共用实现；沿用用户要求的校色修订，校色后单独采纳未记录 |
| 子代理小云、同步环绕与点击反馈 | `assets/shared/subagents/scene.js`、`style.css`和`textures/` | 11/02确认，Q版半径0.85；11/03按用户要求在人物整体缩小至90%时将云朵实际放大约10%，同步环绕一圈由6秒改为4秒，常驻周期18秒。已接桌面只读观察器的子代理活动计数，任务场景出现双云。11/03已实测单个子代理的独立轮次、启动/结束计数及原生双云显隐；该实机证据覆盖单个子代理，不包含复杂嵌套归属；不以造型推断模型品牌或任务数量 |
| 圆云变身与渐变调度 | `assets/shared/transformation-cloud.js`、`app/runtime/scene-fade.js` | 使用当前软件表现与切换实现 |
| 正比原始图、三视图、Q版A母图与选定静态状态 | `assets/references/` | 使用语义文件名；用于形象校验与来源参考，不代表全部都有生产动画 |

每种状态与形态采用同一布局：`scene.js`、`textures/`与必要模块并列。共用素材集中到 `assets/shared/textures/`；PixiJS、Delaunator及许可证在 `assets/vendor/`。

拖动态与探头吸附已按11月2日真实桌面实施指令，从当前制作预览交付。子代理小助手与小云环绕已按11月2日确认交付。正比待机/休眠/思考只有静态原画，不在当前八组运行组合中。

实际交付文件见根目录 `asset-delivery.json`。目标路径使用语义名称，来源字段保留制作区相对路径与真实文件名，外部根目录使用脱敏占位符。历史重绘、Remotion/Runway尝试、旧QA、依赖安装目录和会话数据不交付。

飞行于2026-11-02单独采纳60fps版本。视频来源为 `flight-animation/qa/timing-60fps/flight-60fps.webm`，模块来源为 `flight-animation/scene.mjs`；仓库只改写校色导入和视频相对地址。共享色板仅新增 `flight-chibi`，保留原有八种矩阵。独立审阅入口现位于制作区`software-preview/review/flight.html`，不属于软件交付。模块按传入的松手眼部位置对齐首帧，播放中保持原视频路径；向左复用同一视频水平翻转。该次60fps单独采纳不包括拖拎和扒边；它们于同日真实桌面实施指令中按当前制作版交付。原生桌面验证由软件实施记录单独说明。

已知限制：5640源片的部分龙角曾越过画面上缘，补帧没有补回缺失轮廓；视频头发、睫毛和饰品细节比静态稿柔和，60fps增加中间位置而不增加空间细节。素材时间约1.65秒翼尖有半透明双轮廓，2.4833秒及2.7833秒翼缘仍有轻微残影（这些是视频时间，1.5倍速下实际经过时间相应缩短）。末两帧全透明，表示人物已完整离屏。此前 `flight-review` 的源片和审阅材料仍保留在制作档案，不是本次运行依赖。

正比阅读/工作已合并在各自 `scene.js` 中的重复源码，以及“候选未采用”等过期制作说明，也已移回上述制作档案。10月31日的用户确认原文保留在 `docs/accepted-animations-2026-10-31.txt`；本次整理不改写历史采用记录。

## 2026-11-02真实桌面实施所需交付

用户在讨论dsh-pet交互方案后明确“好的，请进行真实桌面实现”。本次沿用当前制作预览中的拖拎、扒边素材与控制器，完成桌面闭环所需交付；不把本次实施授权追记成此前对这两张素材的单独采纳。

拖拎完整母图来自 `desktop-states-2026-11-02/drag-chibi-v8-2p5-closed.png`，网格和惯性控制器来自 `drag-animation/`；扒边来自 `desktop-states-2026-11-02/peek-right-chibi-v3-colors.png` 与 `edge-animation/scene.mjs`。仓库使用语义目标名 `textures/character.png`，不改动像素与运动参数。

`app/runtime/interaction-scenes.js` 将三种交互资产接给现有软件手势调度，统一导出 `DRAG_EDGE_WIDTH`、`taskEye`、`createDrag`、`createFlight` 和 `createPeek`。拖拎保留各局部角速度，飞行复用已采纳60fps/1.5倍模块，扒边使用整体镜像和边缘裁切。新增 `drag-chibi` 与 `peek-chibi` 校色矩阵，其余已交付矩阵保持原值。

## 2026-11-04扒边点击反馈交付

用户明确要求“将贴边状态的回弹和振翅应用至实际交付代码”。采用制作区`edge-animation/candidate.mjs`与实际使用的`layers/`，`face.mjs`改为交付语义名`face.js`，原`scene.mjs`的定位常量与函数提取为`layout.js`。检查页面、制作脚本、生成中间稿及`sample/renderFrame`检查接口不交付。

点击播放0.64秒轻微回弹和1.35秒振翅，连续点击维持当前回应；沿用该分层模块的4.7秒呼吸和5.7秒眨眼。左右布局、人物尺寸、裁切与双手接触线保留。正式手势层把扒边单击送到当前扒边动画，达到拖动阈值后执行拖动；隐藏、暂停、销毁停止动画时钟。正式软件不读取制作目录。

制作检查记录中的限制继续保留：162档未辨出翼下交接问题；原生像素放大时，点击峰值附近的翼下隐面发束有小段较直接缝。此次接入不把旧的1000档整页未验收记录改写为通过。


## 2026-11-04待确认问号尺寸统一

按用户“放大所有状态的待确认问号与正比状态相同”，以当前正比工作为基准，对阅读、工作、绘图的Q版及正比按可见轮廓高度标定。默认Q版162档、正比324档下，气泡可见高度约29.45逻辑像素；共享气泡保留呼吸带来的轻微变化，原画轮廓保持等比。正比工作保持原尺寸，其余五组均放大。原弹跳、问号轻摇、位置和方向保留。

制作源为`chibi-scenes/{reading,work,drawing}-scene.js`、`drawing-animation/scene.js`及`reading-animation/reading-wait-rig.js`；正比阅读经既有构建导出`runtime/generated/reading.js`。交付到各自`assets/animations/{state}/{form}/scene.js`，仅保留仓库已有资源导入地址。尺寸依据实际非透明轮廓标定，不将140像素纹理中的透明留白当可见大小。

本轮六组状态深浅底检查与24项验证通过，进入、保持、返回各采样16帧，共288个样本。可见高度为29.45px；Q版阅读/工作随呼吸最高29.66px。未发现遮脸、越界或退出残留。检查材料位于制作区`software-preview/qa-question-size/`，不提交到软件仓库。macOS应用已重新打包。

macOS原生动作菜单已核对Q版工作待确认稳定后的新尺寸，随后恢复“跟随会话状态”；没有留下手动待确认姿态。
