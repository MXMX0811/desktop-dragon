# 当前动画与状态演练

从仓库根目录运行 `python3 tools/preview.py`，打开 http://127.0.0.1:55888/runtime/index.html 。无需安装依赖。

本目录提供浏览器动画演练及桌面共用的状态、交互和动画宿主。Electron桌面入口在`desktop/main/`，真实多会话观察及查询面板在`app/desktop/`使用。当前实现及验证范围见[架构文档](../../docs/architecture.md)。

“本地会话”只读取 bridge/session.json；缺少时显示等待接入。仓库没有包含私人会话快照。bridge/codex_stream.py为原有JSONL输入桥，不会自动连接原生客户端。

软件代码在本仓库维护；动画controller/rig/scene与素材在原工作区制作，确认后交付到 `assets/animations/<state>/<form>/`。各组统一使用 `scene.js` 和 `textures/`，共用模块放在 `assets/shared/`。正比阅读/工作沿用已采用的完整导出模块；仓库不包含制作构建器。

放大审阅使用 inspect.html，与展示页共用AnimationHost和同一批资产。

子代理小云已交付，运行页和放大审阅都从 `assets/shared/subagents/scene.js` 加载。演练开关只用于进行中的思考、阅读、工作、绘图（含待确认）；待机、休眠、完成、断连没有活动开关。本地会话模式不从演练勾选项推断真实子代理活动。点击人物会触发两云同步环绕，圈内再次点击继续当前圈。桌面入口已将真实子代理活动连接到同一双云动画；浏览器演练开关不修改真实会话状态。
