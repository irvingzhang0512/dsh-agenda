# agenda-service-storage

## Purpose

UI、工具与桥共享一个服务，CSV/YAML 是用户级持久资料，保留并发、备份和信任边界。 本文是迁移后的活动规格；旧文档仅为冻结来源。迁移不新增功能、不等于重新完成运行验收。

## Requirements

### Requirement: F007 模型工具与桥接

系统 SHALL 满足本条既有行为与验收约束。来源：冻结的 [SPEC F007](../../../docs/SPEC.md)；确认、历史实现与验证依据见 [迁移索引](../../MIGRATION.md)。

- 场景与预期：13 个 agenda_* 工具覆盖事件与待办操作、搜索和统计；UI 与工具共享业务层，经桥接同步。
- 边界与异常：工具输出 snake_case，使用 { ok, code, message, ... } 信封；不可信写请求拒绝，线协议只传 JSON 可序列化结构。
- 验收条件：全部工具注册且信封一致；业务失败返回错误码；跨站写请求拒绝。

#### Scenario: 工具写入与页面同步

- **WHEN** 一个 agenda 工具通过服务成功新增记录
- **THEN** 返回 ok/code/message 结构化信封及snake_case结果，并由统一订阅按序发布快照；失败不发布成功快照。

#### Scenario: 断线写入与超时

- **WHEN** 连接已断开后发起写入，或已发送写入等不到应答
- **THEN** 断开时拒绝新写入；已发超时显示结果待核对，重连仅拉快照且不自动重放，避免重复记录。


### Requirement: F008 文件存储与恢复边界

系统 SHALL 满足本条既有行为与验收约束。来源：冻结的 [SPEC F008](../../../docs/SPEC.md)；确认、历史实现与验证依据见 [迁移索引](../../MIGRATION.md)。

- 场景与预期：事件／待办存 CSV，类别与节假日使用文件资料；写入加锁、原子替换并保留备份。数据目录按 DSH_DATA_DIR、DSH_HOME 或用户目录解析。
- 边界与异常：CSV 按表头读取，旧重复字段缺失可兼容，新列追加；不能绕过服务直接改文件；备份不等于跨版本自动迁移。
- 验收条件：旧 CSV 可读取；并发写不破坏文件；成功写后再读一致，备份按存储策略保留。

#### Scenario: 旧CSV按表头读取

- **WHEN** 旧文件列序不同或缺少新增重复字段，再通过服务写入
- **THEN** 按表头映射并容忍约定缺列，新增列以兼容方式写入；不会要求用户手工重建数据库。

#### Scenario: 并发设置保存

- **WHEN** 两个窗口持有同一原始 settings.yaml 修订，先后保存 weekStart
- **THEN** 第二个旧修订得到 SETTINGS_CONFLICT；锁内只合并白名单字段并保留未知键，不覆盖第一个保存。

#### Scenario: 写入失败保留原文件

- **WHEN** 锁定写事务中的变更函数抛错或新数据校验失败
- **THEN** 不落盘半成品；成功路径原子替换并保留最近10份备份，备份不被描述为跨版本迁移保证。


### Requirement: A004 Desktop桥身份与协议

宿主 SHALL 在 /agenda/ws 核对回环 socket、Host 与 Origin；原生仅接受精确 dsh-app://app，HTTP 要求 scheme/Host/port 匹配。原生客户端使用公开 streamBaseUrl 构造地址，不使用 ws://app；普通HTTP页面仅用合法同源回退。线协议为 op(id,op,args)、snapshot、op-result、error，数据全部可 JSON 序列化。新连接先建快照基线，旧代次回调不可覆盖它。来源：[冻结Desktop v2](../../../docs/DSH-UPGRADE-20261011.md)、[架构 §2–3、8](../../../docs/architecture.md)。

#### Scenario: 跨站访问桥

- **WHEN** 请求来自非回环、错误端口或外部Origin
- **THEN** 在upgrade阶段拒绝，不能执行op或取得共享快照。

#### Scenario: 旧连接迟到

- **WHEN** 重连已获得新快照，旧连接随后回调
- **THEN** 忽略旧代次；服务写入和发布串行化，所有客户端最终看到相同 dataVersion。


### Requirement: A005 文件布局和设置接口

系统 SHALL 在 DSH_DATA_DIR/agenda、否则 DSH_HOME/data/agenda、否则用户默认目录存储资料，不随项目/会话分裂。events.csv 16列、todos.csv 9列按冻结架构维护；categories.yaml、settings.yaml、holidays/<year>.yaml 保持文本格式。写入使用进程内队列、O_EXCL跨进程锁与心跳、10秒陈旧锁接管、tmp原子替换。update-settings 只接受 patch.weekStart 与 expectedRevision，返回含 settingsRevision、holidayData 的完整快照；非法设置拒绝。来源：[冻结架构 §2–3、8](../../../docs/architecture.md)。

#### Scenario: 切换项目不搬移日程

- **WHEN** 同一用户运行环境中的不同会话打开日程
- **THEN** 读取同一目录与服务；开发环境使用独立 DSH_HOME/DSH_DATA_DIR 形成隔离，不按Session拆业务资料。

#### Scenario: 修改非允许设置键

- **WHEN** update-settings携带未知业务设置变更或无效周起始值
- **THEN** 拒绝非法补丁，既有未知YAML键仍保留，文件修订基于原始字节SHA-256。
