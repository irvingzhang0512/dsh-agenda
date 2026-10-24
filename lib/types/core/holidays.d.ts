/** 库默认值与本地覆盖，所有入口共享同一只读缓存。 */
import type { DayType, HolidayDataSummary } from '../shared/types.ts';
import type { AgendaStorage, HolidayYear } from '../storage/storage.ts';
import { type HolidaySource } from './holiday-data.ts';
export interface DayKind {
    type: DayType;
    holidayName?: string;
}
export declare class HolidayService {
    private readonly storage;
    private readonly source?;
    private cache;
    private lastGood;
    private state;
    private fingerprint;
    constructor(storage: AgendaStorage, source?: HolidaySource | undefined);
    loadYear(year: number): Promise<HolidayYear | null>;
    writeYear(data: HolidayYear): Promise<void>;
    availableYears(): Promise<number[]>;
    summary(): Promise<HolidayDataSummary>;
    refresh(): Promise<boolean>;
    dayKind(date: string, weekday: number): Promise<DayKind>;
}
