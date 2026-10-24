/**
 * dsh-agenda — 业务错误（结构化 code，供 Tool / Bridge 映射为结果信封）。
 */
/** 服务层错误：code 机器可读，message 人类可读（中文）。 */
export class AgendaError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.name = 'AgendaError';
        this.code = code;
    }
}
