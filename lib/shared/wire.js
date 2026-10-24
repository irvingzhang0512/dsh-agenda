/** 解析客户端消息；非法消息返回 null（丢弃即可）。 */
export function parseClientMessage(raw) {
    try {
        const value = JSON.parse(raw);
        if (typeof value !== 'object' || value === null)
            return null;
        const message = value;
        if (message.type === 'hello')
            return { type: 'hello' };
        if (message.type === 'op') {
            if (typeof message.id !== 'string' || message.id.length > 128 || typeof message.op !== 'string' || message.op.length > 64)
                return null;
            if (message.args !== undefined && (!message.args || typeof message.args !== 'object' || Array.isArray(message.args)))
                return null;
            const args = (message.args ?? {});
            return { type: 'op', id: message.id, op: message.op, args };
        }
        return null;
    }
    catch {
        return null;
    }
}
/** 序列化宿主消息（JSON 单行）。 */
export function stringifyHostMessage(message) {
    return JSON.stringify(message);
}
