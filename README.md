# dsh-agenda

当前功能与验收以 [docs/SPEC.md](docs/SPEC.md) 为入口；原始需求保留为历史来源，技术契约见规格内的文档索引。功能任务先改规格再实现，Bug 按已有预期查源码修复。


DSH 个人日程管理插件。公历 + 农历双日历、Event 日程 / Todo 待办、法定节假日与调休、
多级分类、统计与搜索；提供 **13 个 `agenda_*` 工具** 与 **agenda skill**，让 Agent 能用
自然语言（含语音转写文本）直接操作日程。数据全部保存在本地
`<DSH_DATA_DIR>/agenda/`，不依赖任何云服务。

## 功能总览

| 模块 | 能力 | 对应需求 |
| --- | --- | --- |
| Calendar | 月视图 / 周视图（周起始可配置） | §3 |
| Today | 当日视图：今日日程 + 今日待办 + 快速添加 | §4 |
| Event | 日程 CRUD：公历 / 农历、全天 / 定时、跨天、多级分类、地点、备注 | §5/§7 |
| Todo | 待办 CRUD：单次／重复模板、按日期实例完成 / 重开、多级分类；当前规则见 SPEC F002 | §6（历史来源） |
| 农历 | 正式能力：农历事件保留原始农历字段并换算公历；日历显示农历标注与传统节日 | §7 |
| 节假日 | 法定节假日（休）/ 调休上班（班）标记，数据按年维护在 `holidays/<year>.yaml` | §8 |
| 分类 | 路径式多级分类（层数不固定），首次引用自动登记 | §9 |
| 统计 | 范围统计：日程数、定时时长、待办完成率、按分类聚合 | §10 |
| 搜索 | 联合搜索日程与待办（标题 / 备注 / 分类），支持日期范围 | §11 |
| 工具 | 13 个 `agenda_*` 确定性工具（结构化信封 + 文本投影） | §13 |
| Skill | agenda skill：自然语言 → 工具映射 | §13 |
| 语音 | 复用 DSH 的语音输入（STT），skill 只接收文本 | §12（预留，第一阶段不做提醒/微信） |

## 安装

```bash
# 在 DSH 插件工作区中
dsh plugin --profile web add <本仓库路径>
```

插件挂载时自动：
- 初始化 `<DSH_DATA_DIR>/agenda/`（`events.csv` / `todos.csv` / `categories.yaml` /
  `settings.yaml` / `holidays/` / `backup/`）；
- 把捆绑的官方节假日数据 seed 到 `holidays/`（已有年份不覆盖）；
- 注册 13 个工具与 agenda skill；
- 开启 `/agenda/ws` 桥，浏览器 UI 与 Agent 工具共用同一套 AgendaService。

## 数据与存储

- 目录：`<DSH_DATA_DIR>/agenda/`（`DSH_DATA_DIR` 优先，其次 `$DSH_HOME/data/agenda`，
  默认 `~/.dsh/data/agenda`）。
- Event / Todo 存 CSV（列序固定，新增列追加尾部，解析按列名映射）；
- 分类 / 设置 / 节假日存 YAML；
- 所有写路径带文件锁 + `.tmp` 原子替换 + 自动备份（保留最近 10 份）。
- CSV 只是 Storage 的一个实现：UI、语音、LLM 全部通过 AgendaService 访问数据。

## 工具清单（13 个）

`agenda_create_event` · `agenda_get_event` · `agenda_update_event` · `agenda_delete_event` ·
`agenda_list_events` · `agenda_search_events` · `agenda_create_todo` · `agenda_update_todo` ·
`agenda_complete_todo` · `agenda_delete_todo` · `agenda_list_todos` · `agenda_search_todos` ·
`agenda_get_statistics`

所有工具返回统一信封 `{ ok, code, message, ... }`，失败返回结构化错误码而非抛错。
完整约定见 `skills/agenda/SKILL.md` 与 `docs/architecture.md`。

## 开发

```bash
npm install
npm run typecheck   # tsc --noEmit
npm test            # vitest run（农历锚点 / 节假日 / 存储 / 服务 / 工具 / 线协议）
npm run build       # clean → tsc 声明 → tsdown 打包 client
```

提交规范见 `AGENTS.md`（中文 Angular 提交信息，`git commit -F` 写入避免编码损坏）。

## 目录结构

```
dsh-agenda/
├── src/
│   ├── index.ts              # 宿主入口（装配 / 工具 / skill / WS 桥）
│   ├── context-types.ts      # 结构服务面（tools/skills/webServer/webRuntime）
│   ├── core/                 # AgendaService / 农历 / 节假日 / 分类 / 错误
│   ├── storage/              # 存储接口 + CSV 实现 + 文件锁
│   ├── shared/               # 领域类型、线协议、日期纯函数
│   └── client/               # 浏览器 UI（月/周/今天/待办/统计/搜索 + 编辑器）
├── skills/agenda/SKILL.md    # agenda skill（自注册）
├── holidays/2025.yaml …      # 官方节假日数据（seed 源）
├── tests/                    # vitest 测试套件
└── docs/architecture.md      # 架构与约定文档
```

## 路线图（V0.2+，架构已预留）

- 提醒 / 通知（微信等渠道）；
- 重复日程（`recurrence` 字段已预留）；
- 节假日数据在线更新。
