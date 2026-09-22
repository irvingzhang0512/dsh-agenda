# dsh-agenda 需求说明

## 1. 项目定位

开发一个基于 DSH 的个人日程管理插件：`dsh-agenda`。

核心能力包括：

- 日历 Calendar
- 日程 Event
- 待办 Todo
- Today 当日视图
- 周/月视图
- 农历
- 工作日 / 周末 / 法定节假日 / 调休
- 日程多级分类
- 日程统计
- 搜索
- LLM / Skill 自然语言操作
- 语音输入创建、修改、查询日程

第一阶段不实现提醒和微信，但架构需要为后续提醒、企业微信、微信交互预留能力。

---

## 2. DSH 入口

在 DSH 主界面左上方 / 主导航增加 `Agenda` 入口。

点击后进入独立页面，不局限于 Sidebar。

主要页面：

- Today
- Calendar
  - Month
  - Week
- Todo
- Statistics
- Search

---

## 3. Calendar

### 3.1 月视图

支持：

- 上一月 / 下一月
- 回到今天
- 公历日期
- 农历日期
- 工作日 / 周末不同显示
- 法定节假日
- 调休上班
- 显示当天 Event
- 点击日期查看当天日程
- 点击日期新增 Event

### 3.2 周视图

按时间轴展示一周日程。

支持：

- 上一周 / 下一周
- 回到当前周
- 点击空白时间新增 Event
- 点击 Event 查看详情
- 修改 / 删除 Event

拖拽 Event 调整时间可作为后续增强功能。

---

## 4. Today

Today 页面作为高频入口。

展示：

- 当前日期
- 星期
- 农历
- 今日 Event
- 今日 Todo
- 全天事件
- 已完成 / 未完成 Todo

按时间顺序展示当天安排。

---

## 5. Event 日程

Event 支持：

- 新增
- 查看
- 修改
- 删除
- 全天事件
- 指定开始 / 结束时间
- 公历日期
- 农历日期
- 多级分类
- 地点
- 备注
- 重复规则预留

建议基础字段：

```text
id
title
start
end
all_day
calendar_type
lunar_month
lunar_day
lunar_leap
category
location
description
recurrence
created_at
updated_at
```

---

## 6. Todo 待办

Todo 与 Event 分开管理。

Todo 至少包含：

```text
id
title
date
status
category
description
created_at
updated_at
```

状态至少包括：

- pending
- completed

支持：

- 新增 Todo
- 完成 Todo
- 重新打开
- 修改
- 删除
- 查看当天 Todo
- 搜索 Todo

后续可扩展：

- 优先级
- 截止时间
- Reminder
- Todo 转 Event

---

## 7. 农历

日历显示公历 + 农历。

用户创建 Event 时支持：

- 公历
- 农历

农历事件必须保留原始农历信息，不能只保存转换后的公历日期。

例如：

```yaml
calendar_type: lunar
lunar_month: 8
lunar_day: 15
lunar_leap: false
```

需要正确处理：

- 农历月 / 日
- 闰月
- 公农历转换
- 农历跨年

可逐步增加：

- 春节
- 元宵
- 端午
- 中秋
- 重阳
- 二十四节气

---

## 8. 工作日与节假日

日历需要区分：

- 正常工作日
- 周末
- 法定节假日
- 调休工作日

不同类型使用不同背景色或角标，例如：

- `休`
- `班`

节假日数据独立存储：

```text
<DSH_DATA_DIR>/agenda/holidays/
├── 2026.yaml
├── 2027.yaml
└── ...
```

---

## 9. 分类

Event 与 Todo 均支持多级分类。

采用 Path 方式，不固定层数，例如：

```text
工作/防干烧/算法
工作/防干烧/项目管理
工作/DSH/Plugin
生活/家庭
生活/个人
```

分类定义保存在：

```text
categories.yaml
```

---

## 10. Statistics

第一版提供基础统计：

- 本周 Event 数量
- 本月 Event 数量
- Todo 数量
- Todo 完成情况
- 按分类统计
- Event 时间投入统计

支持时间范围：

- 本周
- 本月
- 自定义范围

后续可以增加趋势图和日程密度。

---

## 11. Search

支持搜索：

- Event title
- Event description
- Event category
- Todo title
- Todo category

后续支持自然语言搜索，例如：

> 查一下这个月和第二技术路线有关的安排。

---

## 12. LLM / Skill

提供 `agenda skill`。

Skill 负责理解自然语言，并调用 Tool。

例如：

> 明天下午三点安排算法评审。

> 把周五下午的会议改到四点。

> 今天还有什么事情？

> 添加一个待办：整理算法评审材料。

语音输入复用 DSH 的 Speech To Text 能力。

流程：

```text
Voice / Text
    ↓
DSH Agent
    ↓
Agenda Skill
    ↓
Agenda Tool
    ↓
Agenda Service
    ↓
Local Storage
```

---

## 13. Tools

建议第一版提供：

```text
agenda_create_event
agenda_get_event
agenda_update_event
agenda_delete_event
agenda_list_events
agenda_search_events

agenda_create_todo
agenda_update_todo
agenda_complete_todo
agenda_delete_todo
agenda_list_todos
agenda_search_todos

agenda_get_statistics
```

Skill 不允许直接修改本地文件。

---

## 14. 本地持久化

不使用数据库。

数据属于用户级全局数据，不属于某一个 Workspace，也不能放在 Plugin 安装目录。

统一存储：

```text
<DSH_DATA_DIR>/agenda/
```

如果 DSH 暂时没有统一数据目录，可临时使用：

```text
~/.dsh/data/agenda/
```

代码中不能写死具体用户路径。

推荐目录：

```text
<DSH_DATA_DIR>/agenda/
├── events.csv
├── todos.csv
├── categories.yaml
├── settings.yaml
├── holidays/
│   ├── 2026.yaml
│   └── ...
└── backup/
```

---

## 15. Storage 设计

业务层不能直接依赖 CSV。

定义统一 Storage 接口，例如：

```text
AgendaStorage

listEvents()
getEvent()
createEvent()
updateEvent()
deleteEvent()

listTodos()
getTodo()
createTodo()
updateTodo()
deleteTodo()
```

当前实现：

```text
CsvAgendaStorage
```

以后可以替换为：

- JSONL
- SQLite
- Remote Storage

而不影响 UI / Service / Tool。

---

## 16. 文件安全

CSV 写入必须避免损坏。

写操作建议：

```text
读取最新文件
    ↓
获取文件锁
    ↓
写入 .tmp
    ↓
原子替换原文件
    ↓
释放锁
```

需要支持：

- 文件锁
- 原子写入
- 简单自动备份

避免 UI、Agent、Tool 同时写文件造成数据损坏。

---

## 17. 模块结构

建议：

```text
dsh-agenda/
├── frontend/
│   ├── TodayView
│   ├── MonthView
│   ├── WeekView
│   ├── TodoView
│   ├── StatisticsView
│   ├── SearchView
│   └── EventEditor
│
├── core/
│   ├── AgendaService
│   ├── EventService
│   ├── TodoService
│   ├── LunarService
│   ├── HolidayService
│   ├── CategoryService
│   └── StatisticsService
│
├── storage/
│   ├── AgendaStorage
│   └── CsvAgendaStorage
│
├── tools/
│
└── skills/
    └── agenda/
```

---

## 18. 数据流

UI：

```text
Agenda UI
   ↓
Agenda Service
   ↓
Agenda Storage
   ↓
Local Files
```

AI：

```text
User
 ↓
DSH Agent
 ↓
Agenda Skill
 ↓
Agenda Tools
 ↓
Agenda Service
 ↓
Agenda Storage
 ↓
Local Files
```

UI、文本、语音最终都使用同一套 Service。

---

## 19. V0.1 范围

必须实现：

### UI

- DSH Agenda 一级入口
- Today
- Month
- Week
- Todo
- Statistics
- Search

### Calendar

- 公历
- 农历
- 工作日
- 周末
- 法定节假日
- 调休

### Event

- 新增
- 查看
- 修改
- 删除
- 多级分类
- 农历 Event

### Todo

- 新增
- 修改
- 删除
- 完成 / 未完成
- 分类

### AI

- Agenda Skill
- Event Tools
- Todo Tools
- 查询 / 搜索 / 修改能力
- 支持 DSH 语音输入链路

### Storage

- events.csv
- todos.csv
- categories.yaml
- settings.yaml
- holiday yaml
- 文件锁
- 原子写入
- 自动备份

---

## 20. 暂不实现

V0.1 暂不实现：

- Reminder
- 微信通知
- 企业微信
- 微信双向交互
- 多人协作
- 云同步
- Google Calendar / Outlook 同步
- CalDAV
- 复杂 RRULE
- 附件
- 参与人

---

## 21. 后续扩展

### Reminder

后续增加：

- Event Reminder
- Todo Reminder
- 提前 10 分钟
- 提前 1 小时
- 指定时间提醒

### 微信

未来采用独立 Adapter：

```text
Agenda
  ↓
Reminder
  ↓
Notification Adapter
  ↓
WeChat / WeCom
```

微信消息进入 DSH 时：

```text
WeChat
  ↓
Message Adapter
  ↓
DSH Agent
  ↓
Agenda Skill
```

不要让微信逻辑与 Agenda Core 耦合。

---

## 22. 核心设计原则

1. 插件名统一为 `dsh-agenda`。
2. Event、Todo 是核心业务对象。
3. Calendar 是主要展示方式。
4. Today 是日常高频入口。
5. 农历是正式能力，不是纯 UI 展示。
6. Event / Todo 支持多级分类。
7. 用户数据全部保存在本地。
8. 数据目录与 Plugin 安装目录分离。
9. 数据目录与 Workspace 分离。
10. UI、Voice、LLM 共用同一套 AgendaService。
11. Skill 负责理解自然语言。
12. Tool 负责确定性 CRUD。
13. Skill 不直接读写 CSV。
14. CSV 只是 Storage 实现，不是业务模型。
15. 第一版优先保证日常可用，不追求复杂功能。
