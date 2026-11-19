## MODIFIED Requirements

### Requirement: F008 文件存储与恢复边界

系统 SHALL 满足本条既有行为与验收约束。来源：冻结的 [SPEC F008](../../../../../docs/SPEC.md)；确认、历史实现与验证依据见 [迁移索引](../../../../MIGRATION.md)。

- 场景与预期：事件／待办存 CSV，类别与节假日使用文件资料；写入加锁、原子替换并保留备份。宿主显式配置 dataDir 时使用该目录，留空或未声明时按 DSH_DATA_DIR、DSH_HOME 或用户目录解析。
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

### Requirement: A005 文件布局和设置接口

系统 SHALL 优先在宿主配置 dataDir 指定的绝对目录存储资料；缺省时依次采用 DSH_DATA_DIR/agenda、DSH_HOME/data/agenda 或用户默认目录，不随项目/会话分裂。events.csv 16列、todos.csv 9列按冻结架构维护；categories.yaml、settings.yaml、holidays/<year>.yaml 保持文本格式。写入使用进程内队列、O_EXCL跨进程锁与心跳、10秒陈旧锁接管、tmp原子替换。update-settings 只接受 patch.weekStart 与 expectedRevision，返回含 settingsRevision、holidayData 的完整快照；非法设置拒绝。来源：[冻结架构 §2–3、8](../../../../../docs/architecture.md)。

#### Scenario: 切换项目不搬移日程

- **WHEN** 同一用户运行环境中的不同会话打开日程
- **THEN** 读取同一目录与服务；开发环境使用独立 DSH_HOME/DSH_DATA_DIR 形成隔离，不按Session拆业务资料。

#### Scenario: 修改非允许设置键

- **WHEN** update-settings携带未知业务设置变更或无效周起始值
- **THEN** 拒绝非法补丁，既有未知YAML键仍保留，文件修订基于原始字节SHA-256。

#### Scenario: 指定存储位置后重开

- **WHEN** 管理员配置有效的绝对 dataDir，重启宿主并打开其他工作区
- **THEN** 服务报告该目录，读写、备份和节假日监听使用同一位置。隔离写入样例只出现在指定目录。

#### Scenario: 显式目录无效

- **WHEN** dataDir 为相对路径、指向文件或无法访问
- **THEN** 插件报告目录错误，停止初始化，默认目录中的原文件保持原样。
