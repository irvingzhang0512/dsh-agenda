# dsh-agenda 架构说明

本文档描述 dsh-agenda V0.1 的架构与关键约定（需求见 `dsh-agenda-requirements.md`）。

## 1. 总体分层

```
浏览器 UI（client 半，tsdown 打包为 CJS，经 window.__ModuleLoader__ 挂载）
   │  WebSocket /agenda/ws
   ▼
WS 桥（src/host/bridge.ts）────────────────┐
                                           │  op 分发（src/index.ts dispatch）
DSH Agent（13 个 agenda_* 工具，src/host/tools.ts）──┐
                                                     ▼
                                      AgendaService（src/core/agenda.ts）
                                          │  mutate / query
                                          ▼
                              AgendaStorage 接口（src/storage/storage.ts）
                                          │
                              CsvAgendaStorage（CSV + YAML + 文件锁 + 备份）
                                          ▼
                          <DSH_DATA_DIR>/agenda/
```

- **单一业务层**：UI、Agent 工具、WS 桥全部经由 `AgendaService` 访问数据；
  任何入口的变更都会使 `dataVersion` 递增并广播全量快照，保证各方看到同一份数据。
- **CSV 只是实现**：Storage 是接口，换存储后端（SQLite 等）不触碰业务层。
- **Skill 不碰文件**：`skills/agenda/SKILL.md` 只描述「自然语言 → 工具」映射，
  一切写操作走确定性工具。

## 2. 宿主装配（src/index.ts）

- `name = 'dsh-agenda'`，`inject = ['tools', 'skills', 'webServer', 'webRuntime']`
  （与 `cordis.patch.yml` 一致）。
- 数据目录 `resolveDataDir()`：`DSH_DATA_DIR` → `$DSH_HOME/data/agenda` → `~/.dsh/data/agenda`。
- 挂载流程：`ensureLayout()` → `seedBundledHolidays()`（仅缺年份写入）→
  `registerAgendaTools()` → 异步注册捆绑 skill → `registerUpgrade('/agenda/ws')`。
- 信任栅栏：WS upgrade 校验 `Origin` / `Host` 落在 `ctx.webRuntime.trustedHosts`。

## 3. 线协议（src/shared/wire.ts + types.ts）

- 客户端 → 宿主：`{ type: 'op', id, op, args? }`（另有 `hello`）。
- 宿主 → 客户端：`{ type: 'snapshot', snapshot }`（全量）/
  `{ type: 'op-result', id, ok, message, result? }` / `{ type: 'error', message }`。
- `ClientOp`：get-snapshot / calendar-info / create-event / update-event / delete-event /
  create-todo / update-todo / delete-todo / create-category / delete-category /
  statistics / search。
- 变更类 op 成功后在应答之外向所有连接广播快照。
- `src/shared/` 零运行时依赖、只承载 JSON 可序列化结构。

## 4. 事件日期模型（src/core/agenda.ts）

- **公历路径**：`start`/`end` 为 `YYYY-MM-DD`（全天）或 `YYYY-MM-DDTHH:mm`（定时）；
  **格式即权威**：date-only → 全天，datetime → 定时（显式 end 带时间会覆盖 allDay）。
  end 省略：全天 = 同日；定时 = 开始 + 1 小时。
- **农历路径**：`calendarType='lunar'` 时以 `lunarYear/Month/Day/Leap` 为准，
  用 `lunarToSolar` 换算 `start`/`end`，同时**保留原始农历字段**（无损还原）。
  start_time/end_time 默认 09:00–10:00。
- **更新合并**（`updateEvent`）：把「当前值 + 补丁」合成一次完整输入后重走日期解析，
  因此公历↔农历切换必然一致；切换方向由 `calendarType` 决定，另一路径字段被忽略。
- 跨天事件由 `eventDates()` 展开为逐日（定时事件 end=次日 T00:00 视为只占开始日）。

## 5. 农历（src/core/lunar.ts）

- 1900–2100 `LUNAR_INFO` 位压缩表（bit0-3 闰月、bit4-15 月大小、bit16 闰月大月），
  纪元 1900-01-31 = 农历正月初一，UTC 日历日运算。
- `solarToLunar` / `lunarToSolar` 互逆（测试含 1400+ 确定性往返抽样）；
  传统节日表 + 除夕判断（次日为正月初一）。
- 支持范围 1900-01-31 至 2100 年初（农历 2100 腊月内），越界返回 null。

## 6. 节假日（src/core/holidays.ts + storage）

- `holidays/<year>.yaml`：`{ year, holidays: [{name, dates}], workdays }`。
- 判定优先级：调休上班（班）> 法定节假日（休，带名称）> 周末 > 工作日。
- 年数据 60s 缓存；`writeYear` 失效缓存。官方数据捆绑于 `holidays/2025.yaml`、
  `holidays/2026.yaml`，挂载时 seed（已有年份不覆盖）。

## 7. 工具约定（src/host/tools.ts）

- 13 个工具名见 `AGENDA_TOOL_NAMES`（与 SKILL.md 契约一致）。
- 统一信封 `{ ok, code, message, ... }`；`AgendaError` 带稳定 `code`
  （INVALID_TITLE / INVALID_DATE / INVALID_LUNAR / NOT_FOUND / RANGE_TOO_LARGE 等）。
- 输出 schema 用 snake_case（`all_day`、`calendar_type`…），`eventView`/`todoView`
  负责从领域对象投影；`render` 输出纯文本可读投影。
- 共享 schema 常量用 `outputWith(extra)` 保持每个工具的 schema 具体化，
  避免 DSL 值推断塌缩为 `never`。

## 8. 存储（src/storage/）

- `events.csv`（16 列）/ `todos.csv`（9 列）列序固定、解析按表头映射、容忍缺列；
- `categories.yaml` / `settings.yaml` / `holidays/<year>.yaml` 用 js-yaml；
- 写路径统一 `withLockedFile`：进程内队列串行化 + 跨进程 `.lock`（O_EXCL，心跳续期，
  10s 陈旧接管）+ `.tmp` 原子替换 + `backup/<file>.<stamp>.bak`（保留 10 份）；
- mutate 抛错不落盘。

## 9. Client（src/client/）

- `index.tsx`：`ctx.slots.inject('main')` 注册 keyed 面板 `agenda`；
  `ctx.slots.inject('sidebar.panellist')` 注册侧栏条目（id `agenda`，order 60）；
  注入样式（`da-` 前缀，DSH CSS 变量 + 兜底）。
- `api.ts`：单例 WS 客户端（模块级，跨面板切换保活），指数退避重连、
  断线排队、请求 id 关联超时；月历信息按 `YYYY-MM` 缓存，快照版本变化失效。
- 视图：Today / 月 / 周 / Todo / 统计 / 搜索；EventEditor / TodoEditor /
  DayDetail 弹窗；所有数据来自共享快照（`AgendaProvider`），无需额外请求。

## 10. 扩展点（V0.2+ 预留）

- **提醒 / 微信**：新增 host 调度器 + 通知渠道，事件写入后由 Service 触发；
- **重复日程**：`recurrence` 字段已落库（当前仅 `none`），展开逻辑放
  `eventDates()` 层；
- **语音**：DSH 输入层已完成 STT，agenda skill 直接消费文本，无需改动；
- **更多节假日年份**：新增 `holidays/<year>.yaml` 即可（无需改代码）。
