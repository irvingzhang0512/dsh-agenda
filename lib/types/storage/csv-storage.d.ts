import type { AgendaEvent, AgendaSettings, AgendaTodo } from '../shared/types.ts';
import type { AgendaStorage, HolidayYear } from './storage.ts';
/**
 * CSV/YAML 本地文件存储。
 */
export declare class CsvAgendaStorage implements AgendaStorage {
    readonly dataDir: string;
    private readonly backupDir;
    private readonly writeOptions;
    constructor(dataDir: string);
    private get eventsPath();
    private get todosPath();
    private get categoriesPath();
    private get settingsPath();
    private holidayPath;
    /** 确保目录结构存在（挂载时调用一次）。 */
    ensureLayout(): Promise<void>;
    listEvents(): Promise<AgendaEvent[]>;
    mutateEvents<T>(mutate: (events: AgendaEvent[]) => {
        value: T;
    }): Promise<T>;
    listTodos(): Promise<AgendaTodo[]>;
    mutateTodos<T>(mutate: (todos: AgendaTodo[]) => {
        value: T;
    }): Promise<T>;
    listCategories(): Promise<string[]>;
    mutateCategories<T>(mutate: (categories: string[]) => {
        value: T;
    }): Promise<T>;
    private settingsRaw;
    private settingsRevision;
    settingsState(): Promise<{
        settings: AgendaSettings;
        revision: string;
    }>;
    loadSettings(): Promise<AgendaSettings | null>;
    saveSettings(settings: AgendaSettings): Promise<void>;
    updateSettings(patch: Partial<AgendaSettings>, expectedRevision: string): Promise<void>;
    listHolidayYears(): Promise<number[]>;
    readHolidayYear(year: number): Promise<HolidayYear | null>;
    writeHolidayYear(data: HolidayYear): Promise<void>;
    /** 调试用：直接写一个文本文件（seed 脚本/测试使用）。 */
    writeRaw(path: string, content: string): Promise<void>;
}
