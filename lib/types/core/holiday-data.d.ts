import type { HolidayYear } from '../storage/storage.ts';
export interface HolidaySource {
    readonly packageVersion: string;
    availableYears(): Promise<number[]>;
    loadYear(year: number): Promise<HolidayYear | null>;
    legacyYear(year: number): Promise<HolidayYear | null>;
}
export declare function holidayName(name: string): string;
export declare function normalizeHolidayYear(raw: unknown, year: number): HolidayYear;
export declare function mergeHolidayYear(base: HolidayYear | null, local: HolidayYear | null, legacy: HolidayYear | null): {
    data: HolidayYear | null;
    overridden: boolean;
    legacyFull: boolean;
};
