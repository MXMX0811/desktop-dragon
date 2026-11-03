# 桌面共用运行模块

本目录供`app/desktop/`调用，不提供独立展示页面。桌面入口通过仓库根目录的`npm start`启动。

| 模块 | 职责 |
| --- | --- |
| `animation-host.js` | 加载已交付动画，管理暂停、点击和销毁 |
| `presenter.js`、`scene-fade.js` | 场景选择后的动画调度与渐变 |
| `display-policy.js` | Q版/正比选择和统一身体尺度 |
| `pet-interaction.js` | 点击、连击、拖动、飞行与扒边的交互调度 |
| `interaction-scenes.js` | 拖拎、飞行、扒边资产入口与锚点 |

真实会话状态由`desktop/codex-hooks/`和`desktop/main/sessions.mjs`提供。动画模块及贴图位于`assets/`，运行不依赖美术制作目录。相关检查包含在`npm test`中。
