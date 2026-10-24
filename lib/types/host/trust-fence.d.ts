/** Desktop 回环及普通 HTTP 的可信来源检查；不接受任意 null Origin。 */
import type { IncomingHttpHeaders } from 'node:http';
interface TrustRequest {
    headers: IncomingHttpHeaders;
    socket?: {
        remoteAddress?: string;
        encrypted?: boolean;
    };
}
export declare function isLoopbackHostname(host: string): boolean;
export declare function isTrustedAgendaRequest(req: TrustRequest, trustedHosts?: readonly string[]): boolean;
export {};
