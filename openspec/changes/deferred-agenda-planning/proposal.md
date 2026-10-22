# deferred-agenda-planning

## Why

原始需求的拖动编辑、待办优先级/截止时间/Todo转Event和趋势统计等未在当前F条目中完整兑现；需要明确去向而不标成已实现。

本次仅搬迁历史候选需求，尚未获得该业务方案的具体版本确认，不是开发授权。

## What Changes

- 保留拖动编辑、扩展待办字段及转为日程、趋势/密度统计候选。
- 外部同步、多用户、云同步、Google/Outlook/CalDAV、附件/参与人、复杂RRULE仍为明确后续/非MVP范围，本次不设计或授权。

## Capabilities

### New Capabilities

- `agenda-planning-extensions`: 待定交互、待办字段及分析扩展。

### Modified Capabilities

无已批准修改；若后续选择改变现有能力，须先把对应完整 Requirement 转为 MODIFIED 增量并重新确认。

## Impact

可能影响六视图、工具、CSV字段与统计口径；现有数据和默认行为不变。跨平台恢复/同步归根工作区提案，本库不重复定义网络同步。
