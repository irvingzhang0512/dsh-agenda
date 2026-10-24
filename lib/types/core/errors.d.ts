/**
 * dsh-agenda — 业务错误（结构化 code，供 Tool / Bridge 映射为结果信封）。
 */
/** 服务层错误码。 */
export type AgendaErrorCode = 'INVALID_TITLE' | 'INVALID_DATE' | 'INVALID_RANGE' | 'INVALID_LUNAR' | 'INVALID_CATEGORY' | 'INVALID_STATUS' | 'INVALID_ARGUMENT' | 'INVALID_HOLIDAY_DATA' | 'INVALID_SETTINGS' | 'SETTINGS_CONFLICT' | 'NOT_FOUND' | 'RECURRENCE_UNSUPPORTED' | 'RANGE_TOO_LARGE';
/** 服务层错误：code 机器可读，message 人类可读（中文）。 */
export declare class AgendaError extends Error {
    readonly code: AgendaErrorCode;
    constructor(code: AgendaErrorCode, message: string);
}
