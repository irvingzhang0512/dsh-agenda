# AGENTS.md（dsh-agenda 子仓库）

本文件为 dsh-agenda 独立工作区的维护约定。上级仓库 `F:\irving-dsh-plugins` 的 AGENTS.md
同时适用；进入本目录的新会话应先读取两份。

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

- 提交前必须通过：`typecheck` + `test` + `build` 三者全绿。
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
