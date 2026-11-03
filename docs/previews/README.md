# README动作预览

这六段GIF由当前已交付动画直接渲染，用于项目说明；不作为应用运行资产。制作入口位于`<art-workspace>/dragon-pet/readme-previews/`，读取软件仓库的`AnimationHost`、实际控制器与贴图，并通过共享`drawReferenceFrame()`应用现有校色。

| 文件 | 内容 | 时长 |
| --- | --- | --- |
| standby.gif | 休眠、掩嘴哈欠唤醒、点击振翅、回到休眠 | 11秒 |
| reading-chibi.gif | Q版连续翻页、眨眼与呼吸 | 6秒 |
| work-chibi.gif | Q版敲键、终端与点击回应 | 6秒 |
| drawing-chibi.gif | Q版绘图及浮现图稿 | 8秒 |
| reading-normal.gif | 正比阅读→举书待确认→继续阅读 | 9.5秒 |
| work-normal.gif | 正比工作→摘眼镜托腮待确认→继续工作 | 9.5秒 |

预览为320×320、20fps的循环GIF，README按240px展示。导出使用固定的示例事件时序，不读取真实会话数据；等待与绘图示例不表示已接通自动来源。脚本、采样检查图和导出过程保留在制作目录，`docs/`不进入应用安装包。
