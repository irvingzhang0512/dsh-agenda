/**
 * dsh-agenda — CSV 编解码（RFC 4180 子集）。
 *
 * 设计要点：
 * - 字段在需要时加引号（含逗号 / 引号 / CR / LF / 首尾空白）；
 * - 引号字段内的 `"` 转义为 `""`，可承载换行与全部中文；
 * - 解析为单趟状态机，容忍 CRLF / LF，剥离 UTF-8 BOM；
 * - 空文件 / 仅表头文件返回空数组。
 */
/** 解析一段 CSV 文本为行数组（每行为字段数组）。 */
export declare function parseCsv(text: string): string[][];
/** 编码行数组为 CSV 文本（CRLF 行尾，结尾带换行）。 */
export declare function stringifyCsv(rows: string[][]): string;
