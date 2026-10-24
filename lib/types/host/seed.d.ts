import type { AgendaStorage, HolidayYear } from '../storage/storage.ts';
/** 解析 holidays/*.yaml 原始文本（宽松容错）。 */
export declare function parseHolidayYaml(raw: string, year: number): HolidayYear | null;
/**
 * 把捆绑的节假日数据补齐到数据目录。
 * @param storage 存储
 * @param packageRootUrl 包根目录的 import.meta.url（指向 holidays/ 父级）
 */
export declare function seedBundledHolidays(storage: AgendaStorage, holidaysUrl: URL): Promise<number>;
