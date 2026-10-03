# AGENTS.md（dsh-agenda 子仓库）

## 开发入口与文档分工

先返回根维护目录，读取 [根 AGENTS](../AGENTS.md)、[维护规范](../docs/MAINTENANCE.md) 和开发 Skill；本仓库的特殊约束仍适用。统一流程见 [文档驱动开发](../docs/DOC-DRIVEN-DEVELOPMENT.md)，当前可编辑规格见 [docs/SPEC.md](docs/SPEC.md)。

- 功能新增／修改：读取规格及其差异，先改预期和验收条件，涉及接口／配置／存储时先同步技术契约；用户确认该版文档后再改源码并验证。自然语言需求也先落入规格。
- 文档确认：将修改后的规格／相关技术契约的链接、功能编号、行为差异与验收条件交用户审阅，等待明确确认该版文档后才能改对应源码／测试实现或运行配置；确认前可读源码、查日志／已有测试、完善文档。用户已明确要求按同一版文档实现且含义未再改变时直接继续，不重复询问；仅提出需求、保存／提交文档或沉默不算确认。确认后新增语义差异先重新确认，记录确认范围与文档依据。
- Bug：按已有预期复现并直接查看源码、日志和测试，修复回归；预期未变无需改规格，遗漏／歧义补规格，产品规则变化部分按功能流程。不得改规格把 Bug 解释为正确行为。
- 原始需求保持只读历史来源；实现状态和验证结果分开记录，冲突保留证据并标待确认。README 是入口，架构／配置／接口文档维护技术契约。
- 纯文档任务检查编号、状态、链接与源码／测试引用，记录未执行的验证；无需运行下面的代码测试／构建或重装。代码改动仍遵循本仓库验证要求。
- 纯文档变更不提高包版本，独立中文 Angular docs 提交，保持当前实际分支；根仓库同步完整提交锁。安装快照由脚本检查，未变保留，不自动推送。


本文件为 dsh-agenda 独立工作区的维护约定。上级维护仓库的 [AGENTS.md](../AGENTS.md)
同时适用；路径以当前检出位置为准，进入本目录的新会话应先读取两份。

## 语言

- 默认使用中文交流与维护文档（提交信息、注释、README、变更记录）。

## 环境

- 沙箱内 `npm` / `tsc` / `tsdown` 的 shim（`.cmd` / `.ps1`）可能不可用；用 node 直接调入口：
  - `node node_modules/typescript/bin/tsc -p tsconfig.json [--noEmit]`
  - `node node_modules/tsdown/dist/run.mjs -c tsdown.config.ts`
  - `node node_modules/vitest/vitest.mjs run`
- 不要用 PowerShell 的 `Get-Content` / `Set-Content` 管道处理含中文的文件（编码损坏风险）；
  读取用 read 工具 / `node -e "readFileSync(...)"`。

## 代码组织

- **单一业务层**：UI（client）、Agent 工具（tools）、WS 桥（bridge）都通过
  `src/core/agenda.ts` 的 `AgendaService` 访问数据；CSV 只是 `src/storage/` 的实现细节。
- **约定**：
  - Event 公历字段用 camelCase（`allDay`/`calendarType`），工具输出视图用 snake_case
    （`all_day`/`calendar_type`），在 `src/host/tools.ts` 的 `eventView`/`todoView` 转换；
  - 13 个工具必须返回结构化信封 `{ ok, code, message, ... }`，失败返回错误码而非抛错；
  - 农历事件保留原始农历字段（`lunarYear/Month/Day/Leap`）并换算公历；
  - `src/shared/` 必须零运行时依赖、只含 JSON 可序列化结构（WS 线协议直接承载）。
- 数据目录在运行时解析（`resolveDataDir`），禁止在代码里写死用户路径。

## 验证

- 代码提交前必须通过：`typecheck` + `test` + `build` 三者全绿。
- `tests/` 覆盖：农历锚点与往返、官方节假日、存储（CSV/YAML/并发/备份）、
  AgendaService 业务、13 工具信封、线协议。

## 提交规范

- 遵循 Angular / Conventional Commits，主题用中文：
  `feat(scope): 中文主题` / `fix(scope): …` / `docs: …` / `test: …` / `refactor: …`。
- 提交信息用 UTF-8 文件承载：先写 `COMMIT_MSG` 再用 `git commit -F COMMIT_MSG`，
  提交后删除该临时文件。
- **不提交** `lib/`、`node_modules/`、`*.tmp`、`*.log`（已在 `.gitignore`）。
- 每个逻辑变更一个提交；工具/Skill/文档与代码同库演进。

## 集成

- 本插件的安装状态记录在上级 `inventory/plugins.yaml`（`verifiedWith` 未验证前为 null）与
  `inventory/web-installed.json`（由 `node tools/snapshot-web.mjs --write` 生成，不手改）。
- 修改插件前先 `git status --short --branch` 保留已有改动。
