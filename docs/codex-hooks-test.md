# Codex hooks 首轮可行性实测

本文保留首轮CrossPet日志观察结果。独立接收器已于2026-11-02实现并完成真实CLI测试，当前进度以[独立接入记录](codex-hooks-implementation.md)为准。

2026-11-01，macOS，当前原生客户端，随应用安装的CLI版本`0.166.0-alpha.5.1`。

## 结论

**可以通过hooks取得真实的会话生命周期和工具活动事件。** 本次直接观察当前对话产生的事件，未接入动画。现有CrossPet已安装并信任的hook足以完成首轮可行性验证，因此没有修改全局配置或信任记录。

本次结果证明钩子确实触发，并非把人工JSON输入脚本后当作客户端验证。它不等于已经取得完整内部状态：精确并发归属、审批等待解除、成功完成和用量仍须分别验证。

## 怎么测试

读取`~/.codex/hooks.json`及其指向的CrossPet记录器，核对当前事件注册。用仓库`tools/hook-check.mjs`在75秒和20秒两个窗口观察既有`events/codex.jsonl`的新增记录，分别取得11条和5条记录，窗口内未发现日志断档。窗口前的保留记录与窗口内新增记录分开保存。

随后在当前聊天中实际执行：读取测试文件、短命令及异步命令、通过apply_patch修改测试文件、网页工具、无副作用的MCP调用，以及一个只读审查子代理。独立观察器只读取钩子落盘文件，不访问会话正文，不发消息，不输出批准/拒绝决定。

可复查的脱敏元数据位于[实测记录](qa/codex-hooks-2026-11-01.json)；完整本地观察报告位于`.local/hooks/`，该目录不进入Git。公开摘要将CrossPet短会话标识替换为稳定匿名标签，时间改为相对于首次新增事件的秒数；保留事件顺序、间隔与配对关系。这些标签不是原始会话ID。不新增哈希，不保存命令正文、提示词或工具结果。

## 实测覆盖

| 能力 | 证据 | 可以怎样解释 |
| --- | --- | --- |
| 本轮开始 | 主会话出现UserPromptSubmit，含轮次标识的存在标志 | 用户提交触发了hook；不代表模型已经开始生成 |
| 会话启动/恢复 | 主会话出现SessionStart；CrossPet将其标作session-restart | 事件已到达，后续是否显示由观察器自行决定 |
| 命令执行 | Bash出现PreToolUse/PostToolUse | 能观察命令工具前后；不等于可靠成功/失败判定 |
| 读取文件 | 实际cat测试文件，记录仍是Bash | 只凭工具名无法将它与运行其他命令区分 |
| 修改文件 | apply_patch出现PreToolUse/PostToolUse | 可以识别明确的编辑工具 |
| 网页活动 | 当前web.run路径出现webrun前后事件 | 本机这条网页工具路径可见；日志未保存输入，因此不能再细分搜索、打开或截图 |
| MCP工具 | mcp__node_repl__js出现前后事件 | 本次测试的MCP工具可见，不代表所有专用路径均覆盖 |
| 子代理 | 本轮出现SubagentStart及SubagentStop | 生命周期可见；短日志没有agent_id，无法核对多个子代理的精确对应关系 |
| 模型 | CrossPet模型表保存了gpt-6.1-sol、gpt-6-astra | 模型元数据实际存在；本次没有捕获原始字段验证逐事件归属 |
| 上下文压缩 | 保留记录中存在PreCompact/PostCompact | 历史证据，未主动触发新的压缩 |
| 停止/中断 | 保留记录中存在Stop/Interrupt | 部分记录来自临时建议会话；未主动中断当前会话，未验证主会话最终成功完成 |
| 等待审批 | 现有配置没有PermissionRequest | 本轮未验证，不能把没有事件解释为Codex不支持 |
| 会话真正关闭 | 现有配置没有SessionEnd | 本轮未验证 |
| 图像生成、额度/用量、待办详情 | 本轮没有对应实测数据 | 不宣称已获取 |

官方说明本地函数工具可以走前后hooks，而托管WebSearch不走这条路径。本机web.run是已观察到的本地工具路径，两者不能混为一谈。[OpenAI Hooks文档](https://learn.chatgpt.com/docs/hooks)

## 对后续实现的影响

1. **独立接收原始hook元数据。** CrossPet诊断日志将工具名转小写并截断，只有短会话标识和“是否有turn_id”，缺少原始`turn_id`、`tool_use_id`、`agent_id`。它适合验证事件到达，不足以作为多会话汇总的数据接口。正式接收器应保留这些归属字段，仍不保存正文。
2. **逐调用归并。** 本轮存在一个异步Bash尚未交付结果时，MCP和网页工具已经完成的重叠情况。某个PostToolUse不能把整轮改成“思考”或完成。异步命令的Post还可能在后续write_stdin取得结果时才送达，不能将前后hook时间差直接当成真实执行耗时。
3. **区分观察事实与动画解释。** CrossPet的`running/searching/thinking`是它依据工具名做的分类，不是Codex输出的统一状态枚举。实际思考内容、思考进度以及准确完成百分比本轮均未取得。
4. **审批仍需完整验证。** PermissionRequest表示准备询问，可能被其他hook处理；还需验证真实等待开始及解除，才能驱动持续的待确认状态。Stop也可能触发继续运行，不能单独作为成功完成证据。[OpenAI Hooks文档](https://learn.chatgpt.com/docs/hooks)
5. **不依赖CrossPet的超时淘汰判断完成。** 它的会话表会清理长时间无事件的项，这只是表现策略。长任务无事件应当保持未知，而非推断结束。
6. **接收输入不能一直等EOF。** 现有实现记录了部分宿主写完JSON后不关闭stdin的情况；独立接收器须在获得完整JSON后及时退出，并做相应验证。

后续的独立元数据hook现已实现：保留完整调用归属，加入PermissionRequest和SessionEnd，并通过Codex正式hooks审阅流程信任精确命令。基础CLI真实链路已通过；后续原生聊天、并发调用和单子代理证据见独立接入记录。审批等待及复杂嵌套归属仍需完整验证。当前仓库的app-server JSONL桥接收另一套通知格式，不直接拿来解析hook事件。

## 重复观察

本机已有CrossPet钩子配置生效时运行：

```sh
node tools/hook-check.mjs \
  "$HOME/Library/Application Support/CrossPet/events/codex.jsonl" \
  60 .local/hooks/next-run.json
```

在原客户端正常使用工具，再查看新增事件。这是有时限的诊断脚本，不是常驻适配器；它不会安装hooks或操作会话。Windows及其他Codex版本尚未实测。
