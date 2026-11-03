# 第三方来源

## 桌面与动画运行库

Electron 45.2.1用于桌面窗口和Chromium运行环境，采用MIT许可。Electron Packager 20.3.0用于应用打包，采用BSD-2-Clause许可。依赖由`package-lock.json`锁定；完整许可随相应依赖保留。来源：[Electron](https://github.com/electron/electron)、[Electron Packager](https://github.com/electron/packager)。

shell-quote 1.12.0用于解析命令的工具类别，采用MIT许可。完整许可随生产依赖保留。来源：[shell-quote](https://github.com/ljharb/shell-quote)。

PixiJS 8.22.0随现用动画交付，文件为`assets/vendor/pixi.min.js`及配套模块，保留原库中的MIT授权说明。来源：[PixiJS](https://github.com/pixijs/pixijs)。

Delaunator 5.1.0随当前待机动画交付，用于网格三角剖分，采用ISC许可。文件为`assets/vendor/delaunator.js`，完整许可保留于`assets/vendor/delaunator.LICENSE`。来源：[Delaunator](https://github.com/mapbox/delaunator)。

## 角色与视频

角色原始设计参考ZipZipPipe，Q版比例与色彩参考CrossPet（lokicorvus）。原项目素材许可记录为CC BY-NC-SA 4.0；详细来源保存在`assets/references/attribution.txt`。本仓库没有给角色素材另行授予MIT许可。

来源：[CrossPet](https://github.com/lokicorvus/crosspet)、[人物页面](https://genderswapai.com/ai-gijinka/gpt)、[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)。

飞行源片由用户提供，采用文件为`jimeng-2026-11-01-5640.mp4`。其制作来源与处理记录保留在美术工作区；用户采纳的60fps透明视频及运行模块已交付到`assets/animations/flight/chibi/`。本次桌面实现另采用制作区当前拖拎与扒边资产，来源及采用范围见`asset-delivery.json`和`docs/asset-catalog.md`。

子代理两张云朵由内置图像生成服务按用户指定形象制作：蓝云参考角色原图中的小云，终端云参考[Codex标识](https://openai.com/academy/codex/)。资产位于`assets/shared/subagents/textures/`，来源文件与确认记录见交付清单；这些图像不是官方SDK附带素材。

## 实现参考

桌面交互和状态观察设计参考[CrossPet](https://github.com/lokicorvus/crosspet)及[dsh-pet](https://github.com/PC2005-cloud/dsh-pet)。参考其交互和职责划分不代表导入了整个应用或其视频素材。当前桌面窗口由Electron实现，人物动画使用本仓库交付模块。
