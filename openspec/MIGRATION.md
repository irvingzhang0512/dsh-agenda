# dsh-agenda 文档迁移索引

迁移版：2026-10-22-v1。迁移12个旧F编号：11条已实现行为/交付边界进入5个主能力；F009及原始遗漏候选保留为2个未确认变更。

## 唯一活动来源与保留边界

- 当前行为唯一规格源是本库 openspec/specs；未确认/未实现业务仅在 openspec/changes，不能提前合入主规格或归档。
- 原始需求、旧 docs/SPEC.md 与历史方案/验收证据保留原字节并冻结，不再双写。本索引优先于旧文件内“当前可编辑SPEC”等历史路由措辞。
- 技术/配置/工具/使用说明本轮保持字节不变；规格中的“冻结来源”指迁移时所读取版本，绝非永久禁止维护。后续已确认功能实施时仍同步实际技术说明，但不能与OpenSpec成为第二份独立产品真源。
- README/AGENTS只调整入口与维护路由；业务/项目/examples/运行skills、源码、测试、配置、包版本、锁和产物均不改。根跨平台个人工作区方案不在本库重复定义。
- 原文未给出完整设计的愿望仅建候选change；本轮文档授权不是业务批准。用户确认具体文档版的门禁保留，artifacts ready/validate/任务勾选不等于批准、实现或验收。

## 主规格目录

| Capability | 作用 |
|---|---|
| [agenda-calendar](specs/agenda-calendar/spec.md) | 展示农历、节气及离线节假日资料，保留本地修改优先和不覆盖用户原文件的边界。  |
| [agenda-delivery](specs/agenda-delivery/spec.md) | 保持显示名称、稳定运行身份与固定完整版本交付；不授权安装、发布或待定业务扩展。  |
| [agenda-records](specs/agenda-records/spec.md) | 管理用户级共享的日程、待办及多级分类，保留公农历字段与按日实例语义。  |
| [agenda-service-storage](specs/agenda-service-storage/spec.md) | UI、工具与桥共享一个服务，CSV/YAML 是用户级持久资料，保留并发、备份和信任边界。  |
| [agenda-views-queries](specs/agenda-views-queries/spec.md) | 提供六个原生视图及一致的日期、搜索、统计语义。  |

## 全部既有文档分类

盘点依据为git ls-files全清单，共80个跟踪文件；包括所有md/mdx/txt/rst及对其余扩展名的检查，并非只搜索SPEC。当前有12份上述文本文档；没有另藏的requirements.txt。许可证、Git属性等非需求文本不转换为产品规则。下表逐一记录原文件，个人资料与运行文件保持原职责。

| 原文件 | 分类与去向/处理 |
|---|---|
| [AGENTS.md](../AGENTS.md) | 维护入口；仅改OpenSpec路由及流程，不更改开发/验证/提交约束。 |
| [CHANGELOG.md](../CHANGELOG.md) | 历史交付记录，原字节冻结；不是新需求批准。 |
| [README.md](../README.md) | 用户使用/安装入口；保留原功能与版本事实，仅指向本索引和主规格。 |
| [docs/DSH-UPGRADE-20261011.md](../docs/DSH-UPGRADE-20261011.md) | 文件名历史日期但内容是已确认agenda-desktop-20261014-v2；接入/设置/桥规则进入service-storage，原不完整草案被替代。 |
| [docs/DSH-UPGRADE-20261017.md](../docs/DSH-UPGRADE-20261017.md) | 已确认0.2.1-rc.2兼容变更及验证证据，当前交付基线由agenda-delivery承接；不是未实施计划。 |
| [docs/HOLIDAY-UPDATE-20261014.md](../docs/HOLIDAY-UPDATE-20261014.md) | 已确认并实施的节假日v2技术/设计历史；规则进入agenda-calendar F010/A003，原在线更新草案已替代。 |
| [docs/SPEC.md](../docs/SPEC.md) | 历史产品基线，只读冻结；F001–F012映射见下表，后续不回写。 |
| [docs/VERIFICATION-0.4.0.md](../docs/VERIFICATION-0.4.0.md) | 历史验收证据，原字节保留；已通过与待验范围不由迁移重新判定。 |
| [docs/VERIFICATION-OFFICE-20261018.md](../docs/VERIFICATION-OFFICE-20261018.md) | 统一名称/版本隔离组合验证证据，对应F011/F012；日常验收另记。 |
| [docs/architecture.md](../docs/architecture.md) | 技术说明；已有日期/协议/存储/视图契约进入records A001、calendar A003、service-storage A004/A005、views-queries A002。本轮字节不变。 |
| [dsh-agenda-requirements.md](../dsh-agenda-requirements.md) | 原始需求，只读冻结；逐节去向见下表，重复事件/提醒和其他扩展分别进候选change。 |
| [skills/agenda/SKILL.md](../skills/agenda/SKILL.md) | 运行期自然语言→工具指引，不是维护开发skill；原字节保持，业务期仍通过工具不直接写CSV。 |

## F编号 → Requirement / Scenario 完整映射

旧验收条目在对应主规格保留，并补WHEN/THEN场景；替代的历史细节见后表。下列实现状态来自原文，不是本轮产品重新验证。

| 原编号/标题 | 当前去向与Requirement | 场景 | 历史状态 |
|---|---|---|---|
| F001 事件创建与编辑 | [agenda-records](specs/agenda-records/spec.md) / F001 | 公历跨日记录可往返编辑；农历输入非法不产生半条记录 | 原记录已实现；验证按独立证据 |
| F002 单次与重复待办 | [agenda-records](specs/agenda-records/spec.md) / F002 | 重复待办逐日完成；短月与农历重复边界 | 原记录已实现；验证按独立证据 |
| F003 类别层级与颜色 | [agenda-records](specs/agenda-records/spec.md) / F003 | 新分类路径归一化；所有入口通过服务写分类 | 原记录已实现；验证按独立证据 |
| F004 列表、搜索与统计 | [agenda-views-queries](specs/agenda-views-queries/spec.md) / F004 | 范围内重复实例计数；搜索与分类筛选 | 原记录已实现；验证按独立证据 |
| F005 农历与节假日 | [agenda-calendar](specs/agenda-calendar/spec.md) / F005 | 离线查看日期；日期超出支持范围 | 原记录已实现；验证按独立证据 |
| F006 日程页面 | [agenda-views-queries](specs/agenda-views-queries/spec.md) / F006 | 切页保留当前工作；有修改的弹窗关闭 | 原记录已实现；验证按独立证据 |
| F007 模型工具与桥接 | [agenda-service-storage](specs/agenda-service-storage/spec.md) / F007 | 工具写入与页面同步；断线写入与超时 | 原记录已实现；验证按独立证据 |
| F008 文件存储与恢复边界 | [agenda-service-storage](specs/agenda-service-storage/spec.md) / F008 | 旧CSV按表头读取；并发设置保存；写入失败保留原文件 | 原记录已实现；验证按独立证据 |
| F009 重复事件与提醒 | [deferred-agenda-reminders](changes/deferred-agenda-reminders/proposal.md)，F009-R1/R2/R3 | 范围内重复事件；历史单次事件；显式安排提醒；渠道不可用；切换通知适配器 | 待确认、未实现；联网更新节假日分支已撤回 |
| F010 节假日库与年度数据维护 | [agenda-calendar](specs/agenda-calendar/spec.md) / F010 | 用户删除旧种子假日；新增修改与无基线年度；损坏文件与未收录年份；本地资料变动通知 | 原记录已实现；验证按独立证据 |
| F011 插件列表与详情的显示名称 | [agenda-delivery](specs/agenda-delivery/spec.md) / F011 | 切换界面语言 | 原记录已实现；验证按独立证据 |
| F012 统一版本与固定交付 | [agenda-delivery](specs/agenda-delivery/spec.md) / F012 | 同基线修订更新；独立安装与配置保留 | 原记录已实现；验证按独立证据 |

## 原始需求逐节去向（含SPEC未覆盖项）

来源：[dsh-agenda-requirements.md](../dsh-agenda-requirements.md)。未覆盖不等于可以删掉；被较新已确认方案替代的条目保留历史意图并注明去向，未决条目放候选变更。

| 原章节 | 去向与判断 |
|---|---|
| 1 项目定位 | agenda-records/views-queries/service-storage：用户级日程定位保留。 |
| 2 DSH 入口 | agenda-views-queries F006/A002：原生侧栏/main入口，旧Web说法不要求恢复停用Web。 |
| 3 Calendar | agenda-views-queries F006；拖动建议转deferred-agenda-planning / R-DRAG，未声明现有可拖动。 |
| 3.1 月视图 | agenda-views-queries F006；拖动建议转deferred-agenda-planning / R-DRAG，未声明现有可拖动。 |
| 3.2 周视图 | agenda-views-queries F006；拖动建议转deferred-agenda-planning / R-DRAG，未声明现有可拖动。 |
| 4 Today | agenda-views-queries F006：今天页/当日事件待办。 |
| 5 Event 日程 | agenda-records F001/A001；重复事件与提醒未落地部分转deferred-agenda-reminders。 |
| 6 Todo 待办 | agenda-records F002；优先级/截止时间/Todo转Event转deferred-agenda-planning，提醒在reminders候选。 |
| 7 农历 | agenda-calendar F005/A003与records F001/F002：农历/节气/生日原字段及范围。 |
| 8 工作日与节假日 | agenda-calendar F010/A003：固定本地库加用户覆盖；历史按年种子被v2替代，不新增在线更新。 |
| 9 分类 | agenda-records F003：多层分类、颜色、同一服务。 |
| 10 Statistics | agenda-views-queries F004：当前范围汇总；趋势/密度建议转planning / R-STATISTICS。 |
| 11 Search | agenda-views-queries F004：搜索/日期/分类；自然语言经运行skill和工具，不另加全文数据库。 |
| 12 LLM / Skill | agenda-service-storage F007：LLM/语音输入复用DSH文本及捆绑skill，不实现独立STT。 |
| 13 Tools | agenda-service-storage F007：13工具、信封和服务路径；禁止直接写文件。 |
| 14 本地持久化 | agenda-service-storage F008/A005：CSV/YAML用户级目录；不按项目/会话分库存储。 |
| 15 Storage 设计 | agenda-service-storage：Storage接口边界保留；JSONL/SQLite/远端仅可扩展举例，当前不承诺改存储后端。 |
| 16 文件安全 | agenda-service-storage F008：锁、原子替换、备份及错误不落盘。 |
| 17 模块结构 | 技术实现组织参考；现行服务/存储职责在service-storage，本轮不按原目录示例重构源码。 |
| 18 数据流 | agenda-service-storage F007：UI/Tools共享业务服务和变更通知。 |
| 19 V0.1 范围 | 已落地项按主规格验收；旧MVP清单中的重复事件/提醒不因此获实现声明。 |
| 20 暂不实现 | 明确非MVP范围；重复/提醒转候选，其余微信/企业微信/双向同步/协作/云/Google-Outlook/CalDAV/复杂RRULE/附件/参与人保持未选定，不开发。 |
| 21 后续扩展 | deferred-agenda-reminders F009-R1/R2/R3：提前10分钟/1小时/自定义、渠道分离；未确认。 |
| 22 核心设计原则 | 主规格的统一服务、可替换存储和离线文本资料边界；不将未来扩展转为现成功能。 |

## 历史替代、遗漏与不确定点

- F009在旧SPEC仍含历史“在线更新节假日”方向，已由已确认F010和HOLIDAY-UPDATE v2明确撤回；本次候选不恢复。
- 20261011命名文件的现内容是20261014-v2，替代旧草案错误的提醒/会话隔离验收；数据是用户级共享，重复待办不等于重复事件。
- 原要求的拖动、优先级/截止时间/Todo转Event、趋势/密度缺少现行完整承诺，明确进入planning候选；没有为了补齐功能列表修改源码或预期。
- 旧架构开头0.4.0/0.2.0仅历史说明；后续20261017及F012的0.2.1-rc.2+rev.1为当前交付基线，保留所有功能语义。
- CSV/YAML列与设置weekStart之外的未来新增字段必须先明确迁移；本轮不移动、重写或种子化资料。

## 确认、实现与验证证据

- agenda-desktop-20261014-v2及holiday-library-20261014-v2在旧文件明确记录用户确认和已实施；对应0.4.0验收单独保留。
- 20261017兼容升级确认与实际检查见原升级记录；F011/F012来自office-suite-implementation-20261018-v1，原验收见VERIFICATION-OFFICE。
- 原F009未确认/未实现的状态保持。文档迁移不能当作新提醒、自动联网或多机同步验收。

本轮仅做OpenSpec严格校验、完整F编号/文档分类/链接与受保护文件哈希核对，结果由根迁移报告记录。未运行产品测试、构建、真人设备、云端调用或安装；没有提交/推送，也不提高兼容标记。旧验收中的待办不会被文档结构校验自动消除。
