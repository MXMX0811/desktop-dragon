# Codex hooks 接入、桌面开关与验证记录

更新日期：2026-11-04。接收器已接入桌面人物和会话面板。最新完整自动测试为145/145通过；真实工具事件、macOS采集开关及单个子代理的计数和双云显隐已验证。该实机证据不包含多屏、混合缩放、复杂嵌套子代理归属和常驻开销。

新安装步骤见[钩子模块说明](../desktop/codex-hooks/README.md)。本文保留各阶段的实现依据、证据与限制；真实会话标识和绝对时间已从公开记录移除，原始事件与截图保留于不提交的`.local/`，克隆仓库不包含这些私人材料。

## 2026-11-03：桌面连接与采集开关

在测试环境中保留已受信的12类钩子定义及原有CrossPet配置。通过Codex官方只读`hooks/list`复查，本项目12项均启用且为`trusted`。这是该测试环境的证据；桌面自身只读取注册项数，不能据此判断信任状态，也不代表新安装自动完成注册。

右键与托盘菜单提供“启用 Codex 状态采集”。开关保存为所选钩子数据目录中的`disabled`文件；`receive.mjs`在开始接收以及保存前检查它，停用时成功退出而不新增记录。主进程同步重建观察器：关闭后停止轮询、已有记录归历史、人物回到待机；开启后重新确定观察起点，只让新事件推进人物状态。已加载旧钩子定义的聊天也会经过同一个接收器开关，无需反复改动配置或信任。

会话面板显示采集已开启/已关闭、最近事件时间（包含历史）、本次接收条数、注册项数。旧事件不证明当前聊天已接通，已注册不证明已受信。数据目录选择须与接收器实际写入位置一致；开发默认为仓库`.local/codex-hooks/`，打包应用默认为用户数据目录的`codex-hooks/`。应用没有自动安装、撤销、信任或重启Codex的接口。

较早阶段只收到历史记录，一个在注册钩子前已打开的长聊天没有新事件。该阶段`npm test`为84/84通过，覆盖关闭后不接收、输入中关闭不保存、仅显示历史以及重新开启不恢复旧活动。该结果属于当时版本；最新完整测试见本文末节。

### 真实CLI与观察器验证

一个临时CLI测试会话执行只读命令：等待20秒并输出测试标识。工具与CLI均以退出码0结束，未使用绕过信任或沙箱的参数。以下6条记录由Codex实际调用本项目接收器产生，没有注入模拟事件。表中时间以该会话的SessionStart接收时刻为零点，保留实际事件间隔。

| 实际事件 | 相对接收时间（秒） |
| --- | ---: |
| SessionStart | 0.000 |
| UserPromptSubmit | 0.636 |
| PreToolUse（Bash） | 103.700 |
| PostToolUse（Bash） | 123.848 |
| Stop | 130.999 |
| SessionEnd | 131.089 |

使用实际`createSessionObserver`同步观察同一事件目录，时间线捕获了`standby → thinking → work → thinking`，工具活动数从0升至1，再回到0。观察进程按预设180秒结束，早于最后的Stop与SessionEnd，因此这份时间线没有捕获最终回到待机；这两条结束事件由接收器的实际落盘记录证明。

本地证据为`.local/hook-live/codex.jsonl`、`.local/hook-live/timeline.jsonl`及`.local/codex-hooks/events/`。当时新版macOS应用已打包、启动并连接同一数据目录，但设备锁屏，未验证原生菜单开关点击、面板刷新和人物画面。该阶段只有采集开关自动测试证据；原生操作验收记录如下。

### 既有聊天恢复与原生桌面验收

受测长聊天在注册新增钩子前已经创建，初次观察期间出现多轮开始，没有resume，也没有本项目钩子事件。随后恢复该聊天，接收器收到`SessionStart source=resume`及真实Bash和MCP的`PreToolUse`、`PostToolUse`。这证明该聊天恢复后的工具事件已接通，不代表所有旧聊天会立即热加载钩子。

随后在运行中的macOS打包应用完成原生右键操作：

- 关闭“启用 Codex 状态采集”后，面板显示已关闭、本次接收0条，历史记录仍可查看，人物回到待机。关闭期间实际执行shell命令，执行前后事件总数不变。
- 重新开启后，本次接收从0条开始，没有恢复旧工具或旧任务的实时活动。
- 原生面板显示受测聊天正在“执行工具”，人物显示工作龙娘。随后关闭再开启采集，建立新的观察起点，将桌面自动化工具超时遗留的未配对开始事件归入历史；之后原生画面确认人物显示思考龙娘。该操作没有删除历史事件，也不代表缺失的结束事件已被补齐。

本地截图保存在`.local/native-review/hooks/`，包括`off.png`、`reenabled.png`、`current-session.png`和`current-thinking.png`；原始事件仍在`.local/codex-hooks/events/`。这些文件不随仓库公开。

同时修正`app/desktop/app.js`中恢复跟随时已打开面板的模式文字刷新；当时`node --check`通过，macOS应用重新打包运行，未重跑此前84项测试。该阶段新增证据仅为上述原生操作与画面。测试工具留下的两个残留指针经授权重启其服务后消失，由用户确认；这属于测试环境处理，不作为桌宠功能验收。完整自动测试结果见本文末节。

### CrossPet参考及取舍

CrossPet的[`tools/integrate.py`](https://github.com/lokicorvus/crosspet/blob/main/tools/integrate.py#L327)通过`merge_hooks()`和`remove_hooks()`实现接入/撤销，只处理自身命令，保留其他钩子，并提示用`/hooks`信任。[macOS接入界面](https://github.com/lokicorvus/crosspet/blob/main/app/mac/App%2BIntegrations.swift)与[另一接入界面实现](https://github.com/lokicorvus/crosspet/blob/main/app/windows/src/Pet.Integrations.cs)调用同一安装工具；[设置页面](https://github.com/lokicorvus/crosspet/blob/main/app/web/settings.html#L235)区分已注册与是否收过事件。本项目沿用这种状态区分，钩子的注册与信任由用户手动完成。

CrossPet的[`ai-autostart-off`](https://github.com/lokicorvus/crosspet/blob/main/integrations/crosspet-hook.py#L182)只阻止自动启动桌宠；其[开发控制台暂停](https://github.com/lokicorvus/crosspet/blob/main/app/mac/App%2BState.swift#L34)只暂停表现，事件仍被采集。撤销配置也不能保证已加载钩子的旧聊天立即停写。本项目用数据目录中的运行时标志同时停止新增记录和动画跟随，保留现有受信定义。

## 2026-11-02：独立接收器与真实测试

macOS；客户端附带的 Codex CLI `0.166.0-alpha.5.1`。该轮验收范围为独立钩子接收器、按会话归并的状态查询和测试。新增的12类钩子已通过Codex官方启动审阅界面信任，临时CLI会话完成真实端到端测试；随后观察到一个原生桌面恢复会话的完整工具与停止事件。

### 代码与查询

```text
Codex 调用 hook
  → desktop/codex-hooks/receive.mjs
  → .local/codex-hooks/events/ 独立事件文件
  → state.mjs 按会话、轮次、调用和代理 ID 归并
  → status.mjs 查询与观察
```

在仓库根目录运行：

```sh
npm run hooks:status
npm run hooks:watch
npm run test:hooks
```

观察命令每秒查询一次，内容变化时打印；Ctrl+C仅结束观察。当时实现使用 Node 内置 API，未添加依赖；命令分类使用`shell-quote`，见文件检索状态修正记录。接收器不输出批准、拒绝或继续执行决定，没有控制会话或发送消息的接口。

钩子保留事件名、完整归属 ID、工具名、模型、时间及有限元数据。不保存提示词、命令正文、工具结果、回答、工作目录或对话文件路径。输入和输出只记录数据类型，连对象键也不保存，避免路径或业务内容出现在键名中。`.local/`不进入 Git。每条事件独立写入并原子改名，可处理并发写入；接收器拿到完整 JSON 后退出，不等待宿主关闭 stdin。

### 当时测试环境的安装与信任

在 `~/.codex/hooks.json` 中添加以下事件，保留原有 CrossPet 配置：

`SessionStart`、`UserPromptSubmit`、`PreToolUse`、`PostToolUse`、`PermissionRequest`、`SubagentStart`、`SubagentStop`、`PreCompact`、`PostCompact`、`Stop`、`Interrupt`、`SessionEnd`。

每个事件调用（安装路径已脱敏）：

```sh
"<node-executable>" "<repository>/desktop/codex-hooks/receive.mjs"
```

超时3秒。原配置备份在 `.local/codex-hooks/hooks-before-install.json`。用户授权后，在官方审阅界面信任新增命令，随后通过只读 `hooks/list` 核实12项均为 `trusted`；没有手工写入信任值。`<node-executable>`与`<repository>`分别表示实际Node可执行文件和仓库位置，示例不暴露本机安装路径。

### 真实测试结果

启动一个临时、非持久化 Codex CLI 测试会话，要求依次读取测试文件、用 `apply_patch` 创建本地测试文件、再读取该文件。工具正常执行，CLI退出码为0。接收器由 Codex 自动调用，验收未向接收器注入伪造事件。

| 实际事件 | 条数 | 状态核对 |
| --- | ---: | --- |
| SessionStart | 1 | 已观察会话启动，活动状态仍未知 |
| UserPromptSubmit | 1 | 本轮活动已观察到 |
| PreToolUse / PostToolUse | 3 / 3 | 两次 Bash、一次 apply_patch；每对完整 turn_id、tool_use_id 相同 |
| Stop | 1 | 仅记录停止事件，不推断成功 |
| SessionEnd | 1 | 会话结束，活动工具计数归零 |

共10条真实事件。按事件逐步归并，工具运行时计数为1，结束后回到0；最终会话状态为 `session_ended`。工具完成与最终成功另由测试 CLI 的实际结果核对，不能从 `PostToolUse` 或 `Stop` 单独推断。

持续观察期间，本接收器又收到一个恢复会话的49条真实事件。仅检查其本地 `session_meta`，确认 `originator` 为 `Codex Desktop`；没有读取对话正文。该轮23组工具事件全部配对：20次 Bash、1次 view_image、1次 MCP 依赖查询、1次 webrun。按实际事件顺序回放归并，最多同时有3个活动工具；每个 Post 只结束对应调用。还捕获到 SessionStart、UserPromptSubmit 和 Stop。该会话没有观察到 SessionEnd，不推断其已关闭或成功完成。

这证实桌面客户端恢复后的会话可以调用本项目钩子；当时另一个旧长聊天没有产生本项目事件，不能声称所有已打开聊天都会立即热加载。没有为测试向其他聊天发送消息或控制其任务。

脱敏摘要见 [验收结果](qa/codex-hooks-implementation-2026-11-02.json)。本地实际事件、CLI测试输出和逐步验证结果在 `.local/codex-hooks/`。可使用 `node desktop/codex-hooks/verify-live.mjs <实际会话ID>` 对实际记录重新验证，该脚本不会生成事件。

### 当时的自动测试与验证范围

`npm test`：32项通过，其中钩子模块15项。覆盖完整 JSON 到达但 stdin 未关闭、分块输入、16个并发接收进程、隐私字段过滤、并发工具与会话、迟到事件、子代理归属、审批事件、停止/中断、缺失 ID 及重复事件。最后审查修复了中断后会话级压缩标志残留，并验证旧轮中断不会清除当前轮的压缩标志。

| 能力 | 2026-11-02证据 |
| --- | --- |
| 新启动 CLI 的启动、提交、工具前后、停止、会话结束 | 本接收器真实验证通过 |
| 原生桌面恢复会话与同轮工具并发 | 本接收器真实观察到49条事件、23对工具调用、最高3个并行工具 |
| 当时受测的旧长聊天 | 该观察窗口没有新事件，不能据此认定已加载新增钩子 |
| 多会话同时活动、子代理归属、审批、中断、压缩 | 已注册，归并逻辑有自动测试；该轮证据只覆盖自动测试 |
| 本地网页、MCP、查看图片工具 | 本接收器真实观察到 webrun、MCP 依赖查询、view_image；不据此声称全部工具可见 |
| 图像生成 | 本接收器未实测 |
| 审批等待解除、成功结果、用量和待办 | 当前 hook 链尚不能完整证明或提供 |
| 长时间运行开销与事件留存 | 不包含在该轮实机验收范围 |

`PermissionRequest`只表示观察到请求，不能证明用户此刻仍被阻塞；`permission_requests_observed`是累计观察次数。没有事件也不能推断任务完成或客户端断开。工具缺少归属 ID 时记为未配对，不猜测对应关系。已完成事件保留在本地，查询输出区分历史结束会话和活动观察，不代表已实现常驻客户端健康检测。

原生接入以目标聊天的新事件进入本项目目录为证据。当前人物动画由已观察活动和工具驱动；`PermissionRequest`只能表示已观察到权限请求，不能独立驱动审批等待。异步提问等待的接入与验收见本文末节。

事件语义依据 [Codex Hooks 官方文档](https://learn.chatgpt.com/docs/hooks)。此前依赖 CrossPet 日志的可行性观察保留在 [首轮观察记录](codex-hooks-test.md)，与本次独立实现分开记录。

## 11月3日文件检索状态修正

真实文件搜索通过Bash钩子到达，Pre/Post通常只隔约0.1–0.2秒；原实现将Bash统一归一般工作，又每秒批量归并，常在发布时直接回到无运行工具的思考。依据[官方钩子字段](https://learn.chatgpt.com/docs/hooks)，接收器现用`shell-quote`解析`tool_input.command`，只保存`tool_kind`。明确检索、读取及纯读取管道显示阅读，混合命令仍为工作。

当前轮已配对的完成工具保留3秒展示，活动工具计数仍为实际值，新实际工具优先。无新事件时也会在截止时自动回思考，不重播历史。真实测试已验证144ms的Bash搜索产生`search`类别，未保存命令正文。

验证结果：92项自动测试通过。更新后的macOS安装包已运行；以真实`tail -f | rg`读取本机打包日志时，原生AX显示“阅读龙娘”，截图确认阅读形象，未使用模拟事件。另一会话仍运行命令时汇总可保持工作。该阶段左右边界按拖动人物80%尺寸缩至约137px，判定与高亮共用计算值，左右内外边界检查通过；当前飞行尺寸与贴边范围见架构文档。

## 11月3日无活动时恢复待机

用户反馈所有会话已无活动，人物仍为思考。回放反馈前的真实元数据，活动会话、工具与子代理均为0，旧展示策略仍输出`thinking`和`suspended:true`：原因是把`stop_observed`当成需保留上一姿态的结果未知。现无活动统一回待机；Stop结束该轮活动计数，旧调用不随新调用恢复。查询面板保留停止事实与结果未判定，成功能力标志仍为false。相同历史输入已回放验证为`standby`、不暂停，无修改原事件。

## 11月3日真实子代理检查

按用户要求启动只读测试子代理。首轮真实SubagentStart与SubagentStop的接收间隔为306秒；两者共享主会话session_id，使用同一个独立子代理turn_id与agent_id。旧逻辑只统计主current_turn，导致子代理活动漏计。现在保留原完整ID配对，按会话汇总当前主轮次和仍运行的子代理轮次，子代理不改变主轮次。真实事件回放已验证子代理计数从1回到0。子代理结束清除自身工具残留，不结束主会话；主会话停止也不误清仍运行的独立子代理。

第二轮使用修复后的macOS打包应用，真实SubagentStart与SubagentStop的接收间隔为143秒。原生桌面已确认双云出现，右键会话面板显示活动会话1、子代理1；结束后事件投影的子代理计数回到0，原生截图确认双云消失。检查期间主会话仍在执行检查工具，因此此步骤未将桌面最终待机记为实测通过；无活动回待机已由真实历史回放与回归测试验证。完整自动测试101/101通过。


## 11月4日异步提问的待确认显示

问题工具`request_user_input_async`会立即返回，原桌面快照又固定传入`waiting:false`，因此既有待确认动画只在手动审阅中可见。接收器现在从该工具输入提取问题数量，从实际Post结果提取`accepted`布尔值；只有明确接受且数量已知才建立待答。

真实客户端已观察到：Post的`tool_response`为JSON字符串，包含`accepted:true`；`UserPromptSubmit.prompt`中的回答为完整独立的`send_user_message_question_reply`结构，`questionItemId`精确匹配同会话原提问调用与问题索引。只落盘问题数量、接受标记及答复对应的调用/索引，题目、选项与答案不保存；普通消息或带引用的示例不作为答复。该结构在当前受测客户端核实，不扩大为所有客户端版本与提问入口。

待答按会话保留，可跨轮次逐题解除；工具返回、Stop、Interrupt或其他消息不当作已回答。SessionEnd清空该会话问题。用户选择多会话时待确认优先：人物采用提问前的阅读/工作姿态，无前置工具则显示工作待确认。活动会话、工具、子代理及待答计数相互独立。启动历史、关闭或重新开启采集不会复活旧问题；权限审批及跳过流程需独立证据。

145项Node测试通过，正式页面隔离Electron的21项自动等待检查通过，具体范围见[架构记录](architecture.md)。macOS修复包启动后，一次全新的真实提问产生`pendingInputCount:1`和`waiting:true`，原生截图确认Q版工作龙娘停止敲击、看向用户且出现问号；没有通过手动动作菜单或注入事件驱动。


用户随后确认“已出现待确认动作”。对应真实回答进入UserPromptSubmit后，该会话待答问题数从1降为0，当前保持0；macOS原生画面确认问号收起，恢复正常工作提示。提问接受、等待显示、真实回答与解除的完整链路在本次受测客户端闭合。
