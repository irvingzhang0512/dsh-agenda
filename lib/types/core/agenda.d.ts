import type { AgendaEvent, AgendaSettings, AgendaSnapshot, AgendaTodo, DateRange, DayInfo, EventInput, EventPatch, SearchResult, StatisticsResult, TodoInput, TodoInstance, TodoPatch } from '../shared/types.ts';
import type { AgendaStorage } from '../storage/storage.ts';
import type { HolidaySource } from './holiday-data.ts';
import { HolidayService } from './holidays.ts';
/** AgendaService 门面。 */
export declare class AgendaService {
    private readonly storage;
    readonly holidays: HolidayService;
    private readonly now;
    private dataVersion;
    private mutationTail;
    private listeners;
    subscribe(listener: () => void): () => void;
    private changed;
    private mutate;
    updateSettings(patch: Partial<AgendaSettings>, expectedRevision: string): Promise<AgendaSnapshot>;
    refreshHolidays(): Promise<void>;
    constructor(storage: AgendaStorage, options?: {
        now?: () => Date;
        holidaySource?: HolidaySource;
    });
    /** 当前数据版本（每次成功变更 +1）。 */
    get version(): number;
    private stamp;
    /** 读取设置；缺省只返回默认值，不写用户文件。 */
    settings(): Promise<AgendaSettings>;
    /** 全量快照（WS 建连与变更广播）。 */
    snapshot(): Promise<AgendaSnapshot>;
    /** 创建日程；按 calendarType 走公历或农历路径。 */
    createEvent(input: EventInput): Promise<AgendaEvent>;
    /** 查看单个日程。 */
    getEvent(id: string): Promise<AgendaEvent | null>;
    /**
     * 修改日程：以「当前值 + 补丁」合并成一次完整输入后重走日期解析，
     * 保证无论公历→农历还是反向切换都能得到一致且可校验的结果。
     */
    updateEvent(id: string, patch: EventPatch): Promise<AgendaEvent>;
    /** 删除日程；返回被删除对象。 */
    deleteEvent(id: string): Promise<AgendaEvent>;
    /** 列出日期范围内的日程（默认全部，按开始时间排序）。 */
    listEvents(range?: DateRange): Promise<AgendaEvent[]>;
    /** 按输入解析 start/end/allDay 并写回 event（农历路径完成换算）。 */
    private applyEventDates;
    private applyLunarDates;
    private applySolarDates;
    /** 写回可选扩展字段（location/description；空串或 null 清除）。 */
    private applyEventExtras;
    /** 提取并归一化分类字段；undefined 表示未提供，''/null 表示清除。 */
    private eventCategory;
    /** 首次引用的分类自动登记进 categories.yaml。 */
    private registerCategoryIfNew;
    /** 断言日期真实存在（如 2026-02-30 会拒绝）。 */
    private assertDate;
    private assertTitle;
    /** 取 datetime 的 HH:mm；date-only 返回 undefined。 */
    private timeOf;
    private shiftOneHour;
    /** 校验重复/农历字段；返回归一化结果（农历时含换算公历日）。 */
    private prepareTodoInput;
    /** 创建待办。 */
    createTodo(input: TodoInput): Promise<AgendaTodo>;
    /** 查看单个待办（模板）。 */
    getTodo(id: string): Promise<AgendaTodo | null>;
    /** 列出待办模板（可选范围/状态过滤，按日期升序）。快照/编辑用；列表展示请用 listTodoInstances。 */
    listTodos(range?: DateRange, status?: 'pending' | 'completed'): Promise<AgendaTodo[]>;
    /** 列出 [from,to] 内的待办实例（重复待办按规则展开）；range 省略返回全部。 */
    listTodoInstances(range?: DateRange, status?: 'pending' | 'completed'): Promise<TodoInstance[]>;
    /** 修改待办（模板字段 + 实例完成/重开）。 */
    updateTodo(id: string, patch: TodoPatch): Promise<AgendaTodo>;
    /** 下一个未完成的实例日期（用于无 date 的完成操作）；全部完成返回 null。 */
    private nextPendingDate;
    /** 完成 / 重新打开待办的快捷方式（可指定实例日期）。 */
    setTodoStatus(id: string, status: 'pending' | 'completed', statusDate?: string): Promise<AgendaTodo>;
    /** 删除待办；返回被删除对象。 */
    deleteTodo(id: string): Promise<AgendaTodo>;
    listCategories(): Promise<string[]>;
    /** 新增分类（已存在则原样返回）。 */
    createCategory(path: string): Promise<string[]>;
    /** 删除分类（Event/Todo 上的引用保留为文本）。 */
    deleteCategory(path: string): Promise<string[]>;
    /** 计算日期区间的 DayInfo（公历+农历+节假日）。 */
    calendarInfo(from: string, to: string): Promise<DayInfo[]>;
    /** 范围统计（需求 §10）。 */
    statistics(range: DateRange): Promise<StatisticsResult>;
    /** 定时事件时长（小时）；跨天按自然跨度。 */
    private eventDurationHours;
    /**
     * 联合搜索（需求 §11）：Event 的 title/description/category 与
     * Todo 的 title/category；可选日期范围过滤。
     */
    search(query: string, options?: {
        eventsRange?: DateRange;
        todosRange?: DateRange;
    }): Promise<SearchResult>;
    private validateRange;
}
