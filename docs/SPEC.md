# dsh-agenda 当前功能规格

基线日期：2026-10-03；包版本：0.3.0；核对的源码提交：`feb347ed6a867dc6c6e54ade845d0063fc413566`。此提交是首次整理前的实现基线，后续文档提交不提高包版本。

本规格可编辑，功能任务先改预期与验收再实现；Bug 按已有预期直接定位源码。流程见 [根文档驱动开发规范](../../docs/DOC-DRIVEN-DEVELOPMENT.md)。原始需求保持只读，技术文档保留现有名称。

依据与技术入口：[../dsh-agenda-requirements.md](../dsh-agenda-requirements.md)、[architecture.md](architecture.md)。

实现状态与验证状态分别记录。“已实现”表示有当前源码依据，不表示本次已通过运行测试。下面的测试链接是核对过的现有验证入口；2026-10-03 本次只静态核对源码、测试与文档，没有运行产品测试、构建、GUI 或外部服务验证。具体遗漏见条目与末尾待办。

## F001 事件创建与编辑

- 实现状态：已实现。
- 场景与预期：创建、读取、更新、删除事件；记录标题、类别、位置、描述、全天或起止时间，支持跨日和公历／农历日期。
- 边界与异常：农历保留原始年月日与闰月字段并换算公历；字段非法返回业务错误，不能写入半条事件。事件重复当前只支持 none。
- 验收条件：创建后读取字段一致；修改时间后列表落入正确日期；删除后不可再读；非法日期拒绝。
- 实现依据：[../src/core/agenda.ts](../src/core/agenda.ts)、[../src/shared/types.ts](../src/shared/types.ts)。
- 验证记录：2026-10-03 静态核对；已有测试入口：[../tests/agenda.test.ts](../tests/agenda.test.ts)、[../tests/lunar.test.ts](../tests/lunar.test.ts)（覆盖范围以用例为准，本次未执行）。

## F002 单次与重复待办

- 实现状态：已实现。
- 场景与预期：待办可创建、更新、删除和完成；重复模板支持每天、每周、每月、每年，并按日期展开实例，完成记录按实例日期保存。
- 边界与异常：农历重复仅支持每年；月末按目标月末截断，后续月份仍用原始基准日；范围查询有限额，模板与实例区分。
- 验收条件：完成一次实例不完成其他实例；31 日在短月截断后下一长月恢复；闰日按实现规则回退；超范围请求返回错误。
- 实现依据：[../src/core/agenda.ts](../src/core/agenda.ts)、[../src/core/recurrence.ts](../src/core/recurrence.ts)。
- 验证记录：2026-10-03 静态核对；已有测试入口：[../tests/recurrence.test.ts](../tests/recurrence.test.ts)、[../tests/agenda.test.ts](../tests/agenda.test.ts)（覆盖范围以用例为准，本次未执行）。

## F003 类别层级与颜色

- 实现状态：已实现。
- 场景与预期：事件与待办使用层级类别，按路径管理类别；首次使用新路径可创建对应类别，颜色用于界面分类。
- 边界与异常：路径由统一类别逻辑规范化；类别变更通过业务层而非直接改 YAML。
- 验收条件：同一路径规范化后不生成重复类别；子级路径可读取并用于查询与展示。
- 实现依据：[../src/core/categories.ts](../src/core/categories.ts)、[../src/core/agenda.ts](../src/core/agenda.ts)。
- 验证记录：2026-10-03 静态核对；已有测试入口：[../tests/agenda.test.ts](../tests/agenda.test.ts)（覆盖范围以用例为准，本次未执行）。

## F004 列表、搜索与统计

- 实现状态：已实现。
- 场景与预期：按日期范围列事件和待办，搜索标题、描述与类别；统计事件数量、时长、待办完成率及类别分布。
- 边界与异常：重复待办按范围内实例参与查询；事件与待办语义分离，不能把模板数量误当实例完成率。
- 验收条件：同一过滤条件的列表和统计对应；重复实例完成后相关日期完成率变化。
- 实现依据：[../src/core/agenda.ts](../src/core/agenda.ts)。
- 验证记录：2026-10-03 静态核对；已有测试入口：[../tests/agenda.test.ts](../tests/agenda.test.ts)（覆盖范围以用例为准，本次未执行）。

## F005 农历与节假日

- 实现状态：已实现。
- 场景与预期：显示农历日期与节日；从本地年度节假日资料显示法定节假日、调休工作日及周末。
- 边界与异常：节假日使用本地 YAML，不自动联网更新；种子初始化不覆盖已有资料；农历转换在算法支持范围内执行。
- 验收条件：农历已知锚点和往返匹配；调休工作日与普通周末可区分；已有节假日文件不被种子替换。
- 实现依据：[../src/core/lunar.ts](../src/core/lunar.ts)、[../src/core/holidays.ts](../src/core/holidays.ts)、[../src/host/seed.ts](../src/host/seed.ts)。
- 验证记录：2026-10-03 静态核对；已有测试入口：[../tests/lunar.test.ts](../tests/lunar.test.ts)、[../tests/holidays.test.ts](../tests/holidays.test.ts)（覆盖范围以用例为准，本次未执行）。

## F006 日程页面

- 实现状态：已实现。
- 场景与预期：侧边栏进入日程应用，提供今日、月、周、待办、统计、搜索六个入口及事件／待办编辑；周起始可配置。
- 边界与异常：页面访问同一 AgendaService；重复待办在待办语义下展示，不能暗示重复事件、提醒或微信推送已实现。
- 验收条件：切换各入口能显示相应数据；编辑后其他入口刷新；窄屏和长标题需页面回归。
- 实现依据：[../src/client/agenda-app.tsx](../src/client/agenda-app.tsx)、[../src/client/agenda-context.tsx](../src/client/agenda-context.tsx)、[../src/client/style.ts](../src/client/style.ts)。
- 验证记录：2026-10-03 静态核对；无对应专项自动测试，需补宿主／页面或真实环境验证。

## F007 模型工具与桥接

- 实现状态：已实现。
- 场景与预期：13 个 agenda_* 工具覆盖事件与待办操作、搜索和统计；UI 与工具共享业务层，经桥接同步。
- 边界与异常：工具输出 snake_case，使用 { ok, code, message, ... } 信封；不可信写请求拒绝，线协议只传 JSON 可序列化结构。
- 验收条件：全部工具注册且信封一致；业务失败返回错误码；跨站写请求拒绝。
- 实现依据：[../src/host/tools.ts](../src/host/tools.ts)、[../src/host/bridge.ts](../src/host/bridge.ts)、[../src/host/trust-fence.ts](../src/host/trust-fence.ts)、[../src/shared/wire.ts](../src/shared/wire.ts)。
- 验证记录：2026-10-03 静态核对；已有测试入口：[../tests/tools.test.ts](../tests/tools.test.ts)、[../tests/trust-fence.test.ts](../tests/trust-fence.test.ts)、[../tests/wire.test.ts](../tests/wire.test.ts)（覆盖范围以用例为准，本次未执行）。

## F008 文件存储与恢复边界

- 实现状态：已实现。
- 场景与预期：事件／待办存 CSV，类别与节假日使用文件资料；写入加锁、原子替换并保留备份。数据目录按 DSH_DATA_DIR、DSH_HOME 或用户目录解析。
- 边界与异常：CSV 按表头读取，旧重复字段缺失可兼容，新列追加；不能绕过服务直接改文件；备份不等于跨版本自动迁移。
- 验收条件：旧 CSV 可读取；并发写不破坏文件；成功写后再读一致，备份按存储策略保留。
- 实现依据：[../src/storage/csv-storage.ts](../src/storage/csv-storage.ts)、[../src/storage/csv.ts](../src/storage/csv.ts)、[../src/storage/file-lock.ts](../src/storage/file-lock.ts)、[../src/index.ts](../src/index.ts)。
- 验证记录：2026-10-03 静态核对；已有测试入口：[../tests/storage.test.ts](../tests/storage.test.ts)（覆盖范围以用例为准，本次未执行）。

## F009 重复事件与提醒

- 实现状态：待实现。
- 历史场景：历史需求中的重复事件、提醒／微信通知及在线节假日更新没有作为当前能力交付。
- 边界与异常：仅保留历史规划来源，不代表已承诺本次开发；尚无对应完整运行实现。
- 验收条件：实现前需分别确定重复实例、触发时机与通知渠道，再新增验收；当前不得显示已启用。
- 来源依据：[../dsh-agenda-requirements.md](../dsh-agenda-requirements.md)。
- 验证记录：未实现，暂无运行验证；实际开发时先拆分规格并明确异常反馈。

## 差异与验证待办

- 旧 README 的 V0.1 功能边界未覆盖已实现的重复待办；本次改为链接当前规格，原始需求保持不变。
- 月历／编辑器／窄屏实际交互本次未验证；现有业务测试不能替代页面验证。

## 规格变更记录

- 2026-10-03：首次从现行文档、实现和现有测试建立功能基线；仅修改维护文档，未变更 API、存储或运行逻辑。
