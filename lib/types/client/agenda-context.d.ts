import type { ReactNode } from 'react';
import type { AgendaSnapshot, DayInfo } from '../shared/types.ts';
import type { AgendaClient } from './api.ts';
export interface AgendaContextValue {
    client: AgendaClient;
    connected: boolean;
    error: string | null;
    snapshot: AgendaSnapshot | null;
    /** 今天的 DayInfo（农历年/节日/日期类型）；未加载时 null。 */
    todayInfo: DayInfo | null;
}
/** 视图内取上下文；必须在 AgendaProvider 内。 */
export declare function useAgenda(): AgendaContextValue;
/** 应用根 Provider：实例化客户端并订阅快照。 */
export declare function AgendaProvider({ client, children }: {
    client: AgendaClient;
    children: ReactNode;
}): React.ReactElement;
/** 1=周一 … 7=周日 → 中文。 */
export declare function weekdayCn(weekday: number): string;
/** `YYYY-MM-DD` → `M月D日`。 */
export declare function cnDate(date: string): string;
/** `YYYY-MM-DDTHH:mm` → `HH:mm`；date-only 返回 ''。 */
export declare function timeOf(datetime: string): string;
/** 事件在视图中的时间段文本。 */
export declare function eventTimeText(event: {
    start: string;
    end: string;
    allDay: boolean;
}): string;
/** 周区间（按 weekStart）：返回 [周一…周日] 的日期。 */
export declare function weekRange(date: string, weekStart: 'monday' | 'sunday'): string[];
