# deferred-agenda-reminders

## Why

冻结SPEC F009与原始需求§5、§20–21保留重复日程和提醒/微信方向。当前仅有重复待办，事件recurrence=none；这些设想需要与已实现内容分开管理。

本次仅搬迁历史候选需求，尚未获得该业务方案的具体版本确认，不是开发授权。

## What Changes

- 保留重复日程事件、提前提醒和可替换通知渠道的候选要求。
- 不恢复已撤回的节假日联网自动更新；节假日库与本地覆盖继续按主规格。
- 只整理待定语义，不新增调度器、通知请求或可用配置。

## Capabilities

### New Capabilities

- `agenda-recurring-events`: 重复事件及实例边界，尚未确定例外编辑规则。
- `agenda-reminders`: 提前触发与通知渠道分离，尚未确定默认策略。

### Modified Capabilities

无已批准修改；若后续选择改变现有能力，须先把对应完整 Requirement 转为 MODIFIED 增量并重新确认。

## Impact

可能涉及AgendaService、事件CSV重复/实例字段、UI/工具、触发调度和通知适配。不得丢弃原始农历字段或覆盖现有CSV；与自动化的归属需先决定。
