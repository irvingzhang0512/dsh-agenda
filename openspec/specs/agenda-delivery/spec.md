# agenda-delivery

## Purpose

保持显示名称、稳定运行身份与固定完整版本交付；不授权安装、发布或待定业务扩展。 本文是迁移后的活动规格；旧文档仅为冻结来源。迁移不新增功能、不等于重新完成运行验收。

## Requirements

### Requirement: F011 插件列表与详情的显示名称

系统 SHALL 满足本条既有行为与验收约束。来源：冻结的 [SPEC F011](../../../docs/SPEC.md)；确认、历史实现与验证依据见 [迁移索引](../../MIGRATION.md)。

插件 SHALL 通过分发locale提供规定的中英文名称及简介，保持包名和运行身份不变；布局和旧功能回归按下列精确断言验收。

#### Scenario: 切换界面语言

- **WHEN** 宿主从固定安装包读取中文或英文locale
- **THEN** 分别显示 Irving · 日程与待办 或 Irving · Agenda，简介使用对应资源；包名、工具、服务、客户端身份不变。
- **AND** 场景与预期：中文显示「Irving · 日程与待办」，英文显示「Irving · Agenda」；保留完整包名 dsh-agenda 与全部运行标识。
- **AND** 中文简介：展示公历与农历日历、节假日和调休，支持日程、待办管理及 Agent 工具操作。
- **AND** 英文简介：Display Gregorian and lunar calendars, holidays, and adjusted workdays, with schedule and to-do management and Agent tools.
- **AND** 技术契约：导出 locale/en.json 与 locale/zh.json 的 meta.title／meta.description；exports["./locale/*.json"] 指向对应资源，files 分发 locale，package.description 使用中文简介兜底。客户端设置／详情标题同步；功能导航不强制改名。
- **AND** 验收：目标宿主从固定 tgz 解析两语言名称／简介，原生列表、详情、成员行一致；无新增布局溢出，原工具／配置／存储保持。新套件成员在隔离验证后交付日常。

### Requirement: F012 统一版本与固定交付

系统 SHALL 满足本条既有行为与验收约束。来源：冻结的 [SPEC F012](../../../docs/SPEC.md)；确认、历史实现与验证依据见 [迁移索引](../../MIGRATION.md)。

插件 SHALL 使用完整宿主基线加整数修订号交付，并核对源码与产物身份，保持独立安装、旧配置及业务资料；下列场景保留原迁移与交付断言。

#### Scenario: 同基线修订更新

- **WHEN** 从旧完整版本迁移到0.2.1-rc.2+rev.1
- **THEN** 同时核对完整版本、源码SHA和产物散列；旧后缀只通过明确映射，不能因SemVer忽略build而跳过更新。
- **AND** 包版本统一为 0.2.1-rc.2+rev.1；宿主与官方 peers 仍为实际要求的原版本。完整字符串、源码 SHA 和产物散列同时校验，不能使用忽略 build metadata 的 SemVer 判断修订升级。
- **AND** Chatty／Automation 的原比较接口保留，规范后缀改为 +rev.N，N 为无前导零的安全正整数；跨官方基线拒绝。旧版本仅由明确迁移映射及原锁／散列接管，不能把旧后缀 .1 与 rev.1 当作无需更新。
- **AND** 本包继续独立安装，不进入办公套件；启停和业务配置语义保持。
- **AND** 配置／数据：没有业务字段改名或存储搬迁；套件接管仅处理组合选择与既有 disabled 字段，保留未知配置、工具引用、文档和凭据。迁移 CAS／备份／冲突／回滚由根维护入口执行。
- **AND** 验收：完整产物、版本迁移、原功能回归；成员还需唯一实例、旧配置命中、总／子开关与业务资料保留。具体记录见 VERIFICATION-OFFICE-20261018.md（完成后生成）。

#### Scenario: 独立安装与配置保留

- **WHEN** 根维护入口处理固定组合与disabled字段
- **THEN** Agenda继续独立安装；未知配置、工具引用、业务资料与凭据保留，根入口负责CAS、备份、冲突与回滚。
