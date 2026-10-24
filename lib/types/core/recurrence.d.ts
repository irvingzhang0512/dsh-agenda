import type { CalendarType, TodoRecurrence } from '../shared/types.ts';
/** 推演所需的模板字段（AgendaTodo 的结构子集）。 */
export interface TodoBase {
    date: string;
    recurrence?: TodoRecurrence;
    calendarType?: CalendarType;
    lunarYear?: number;
    lunarMonth?: number;
    lunarDay?: number;
    lunarLeap?: boolean;
}
/**
 * 展开一个待办在 [from, to]（含）内的全部实例日期。
 * 单次待办：date 在范围内返回 [date]，否则 []。
 */
export declare function todoOccurrenceDates(todo: TodoBase, from: string, to: string): string[];
