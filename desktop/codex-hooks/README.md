# Codex钩子状态接收

接收Codex传入的JSON，按完整会话、轮次、调用及代理ID归并状态。桌面主进程已读取这些元数据，驱动人物状态和只读会话面板；不依赖CrossPet的数据。

## 查看状态

在仓库根目录运行：

```sh
npm run hooks:status
npm run hooks:watch
npm run test:hooks
```

`hooks:watch`每秒读取一次，仅在状态变化时打印。Ctrl+C结束观察，不影响客户端。

查看必要事件元数据：

```sh
node desktop/codex-hooks/status.mjs --events
```

## 运行路径

`Codex hooks → receive.mjs → events/ → state.mjs → 桌面观察器 → 人物与会话面板`

`status.mjs`继续提供独立的只读查询。

- `receive.mjs`：从stdin接收一条完整JSON，获得完整对象后立即退出，不依赖宿主关闭stdin。
- `control.mjs`：以数据目录中的`disabled`文件保存采集开关；接收器启动时及保存前均检查。
- `store.mjs`：提取必要元数据；每个事件使用独立文件，写完后原子改名，避免并发写入相互覆盖或读到半个JSON。
- `state.mjs`：纯归并函数，按会话、轮次、工具和子代理标识投影。单个Post不会结束其他并发工具；旧轮次不会覆盖新的已提交轮次。子代理与主会话共享session_id，但使用独立turn_id；子代理事件不抢占主轮次，活动子代理及其工具按会话汇总。SubagentStop只关闭对应子代理轮次。
- `registration.mjs`：只读检查Codex配置中本接收器覆盖的事件数量，不查询或修改信任状态。
- `status.mjs`：本地只读查询；没有发送消息、审批或控制会话接口。

记录完整归属ID、事件、工具名、模型、时间、许可模式及输入/输出的数据类型。提示词、命令正文、工具结果及其对象键、回答、工作目录、对话文件路径不落盘。不将PostToolUse解释成成功，也不将Stop解释成最终成功完成。Stop会结束该轮活动计数；全部会话无活动时人物回待机，面板继续保留结果未判定。

状态包括`activity_observed`、`tool_running`、`agent_running`、`compacting`、`permission_requested`、`stop_observed`、`interrupted`、`session_ended`和`unknown`。`permission_requested`仅说明观察到审批请求，没有把它当作已确认用户阻塞。计数`permission_requests_observed`是观察累计数，不是待处理请求数量。

## 桌面采集开关

右键或托盘菜单中的“启用 Codex 状态采集”控制当前选定的数据目录：

- 关闭：创建`disabled`标志，接收器停止新增记录；主进程重建为不轮询的观察器，已有记录仅作历史，人物回到待机。
- 开启：移除标志并建立新的观察起点，只用此后收到的事件驱动人物；不会恢复关闭前遗留的活动工具。
- 会话面板显示已开启/已关闭、最近事件时间（含历史）、本次接收条数和钩子注册项数。注册存在不等于已受信，历史时间也不代表当前聊天正在发事件。

开发运行默认使用仓库`.local/codex-hooks/`，打包应用默认使用用户数据目录的`codex-hooks/`。菜单选择的数据目录须与接收器写入目录一致。开关不改动`hooks.json`，也不需要重新信任现有命令；应用没有自动安装、撤销或信任接口。独立查询命令仍可读取历史记录。

## 首次接入

先在仓库根目录运行`npm ci`，使用 Node.js 22.13 或更新版本。根据[Codex 官方钩子说明](https://learn.chatgpt.com/docs/hooks)在自己的钩子配置中添加本接收器，保留其他应用已有条目。

每个事件使用同一条命令，Node 和脚本都填写本机实际绝对路径：

```sh
"<node-executable>" "<repository>/desktop/codex-hooks/receive.mjs" --data-dir "<hook-data-directory>"
```

占位符需替换为实际路径。数据目录是保存`events/`和`disabled`的父目录；省略`--data-dir`时使用本仓库`.local/codex-hooks/`。Windows路径使用对应系统格式。

注册以下12类事件，类型为`command`，超时3秒：

```text
SessionStart UserPromptSubmit PreToolUse PostToolUse
PermissionRequest SubagentStart SubagentStop
PreCompact PostCompact Stop Interrupt SessionEnd
```

在 Codex 的`/hooks`界面审阅并信任这条命令，再启动或恢复一个能加载新钩子的聊天。在桌宠右键菜单选择相同的数据目录并开启采集，执行一次真实查询，确认“本次接收”增加、工具状态变化。仅看到注册条目或历史记录不表示已接通。移动脚本或修改命令后，需要重新审阅信任。

接收器只记录元数据，不向Codex返回决策。成功时没有输出；错误退出码为1，输入超时2秒。桌宠不安装钩子、不更改信任配置，也不控制会话。

## 数据与测试

`.local/`由Git忽略。事件存入`events/`；并发测试写到临时目录并自动清理。`verify-live.mjs <session_id>`只检查实际记录，不生成事件。

平台限制和接入范围见[钩子实现说明](../../docs/codex-hooks-implementation.md)。
