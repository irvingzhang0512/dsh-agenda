import type { AgendaEvent, AgendaSnapshot, AgendaTodo, ClientOp, DayInfo, EventInput, EventPatch, TodoInput, TodoInstance, TodoPatch, AgendaSettings } from '../shared/types.ts';
export declare class AgendaClient {
    private readonly wsUrl;
    private ws;
    private pending;
    private listeners;
    private reconnectTimer;
    private failures;
    private manualClose;
    private baselineReady;
    private generation;
    private calendarCache;
    readonly uiState: Map<string, unknown>;
    connected: boolean;
    snapshot: AgendaSnapshot | null;
    error: string | null;
    private operationError;
    constructor(wsUrl: string | null, unavailable?: string);
    subscribe(listener: () => void): () => void;
    private notify;
    private acceptSnapshot;
    private connect;
    refresh(clearWarning?: boolean): Promise<void>;
    op<T>(op: ClientOp, args?: Record<string, unknown>, timeoutMs?: number): Promise<T>;
    updateSettings(patch: Partial<AgendaSettings>, expectedRevision: string): Promise<AgendaSnapshot>;
    createEvent(input: EventInput): Promise<AgendaEvent>;
    updateEvent(id: string, patch: EventPatch): Promise<AgendaEvent>;
    deleteEvent(id: string): Promise<{
        deleted_id: string;
    }>;
    createTodo(input: TodoInput): Promise<AgendaTodo>;
    updateTodo(id: string, patch: TodoPatch): Promise<AgendaTodo>;
    deleteTodo(id: string): Promise<{
        deleted_id: string;
    }>;
    /** 待办实例列表（重复待办按日期展开；range/status 可选）。 */
    listTodoInstances(range?: {
        from: string;
        to: string;
    }, status?: 'pending' | 'completed'): Promise<TodoInstance[]>;
    /** 完成重复待办的指定日期实例（date 缺省 = 完成下一次）。 */
    completeTodoInstance(id: string, date?: string): Promise<AgendaTodo>;
    createCategory(path: string): Promise<string[]>;
    deleteCategory(path: string): Promise<string[]>;
    /** 某月的 DayInfo（带缓存）。 */
    monthInfo(year: number, month: number): Promise<DayInfo[]>;
    /** 指定日期区间的 DayInfo（尽量用缓存拼接）。 */
    rangeInfo(from: string, to: string): Promise<DayInfo[]>;
    private shiftDay;
    private shiftMonth;
    dispose(): void;
}
/** React 状态钩子：订阅 AgendaClient 的快照 / 连接状态。 */
export declare function useAgendaState(client: AgendaClient | null): {
    connected: boolean;
    snapshot: AgendaSnapshot | null;
    error: string | null;
};
export declare function getAgendaClient(): AgendaClient;
export declare function disposeAgendaClient(): void;
export declare function useMemoClient(): AgendaClient;
