/**
 * dsh-agenda — WS 桥浏览器信任栅栏。
 *
 * 与 @deepseek-ai/dsh-client-connection 的 /api 网关栅栏行为一致（参考
 * dsh-better-sidebar-controller 的 trust-fence，本插件不依赖其内部实现）：
 *
 * - Host 头为回环主机（localhost / 127.x / ::1）直接放行；
 * - 非回环主机必须命中 webRuntime.trustedHosts；
 * - `Sec-Fetch-Site: cross-site` 拒绝（跨站防御）；
 * - 带 Origin 时须与 Host 同源。
 *
 * 这是 DNS 重绑定 / 跨站防御，不是认证。
 */
import type { IncomingHttpHeaders } from 'node:http'

/** 栅栏读取的请求事实（IncomingMessage 的结构子集）。 */
interface TrustRequest {
  headers: IncomingHttpHeaders
}

function header(headers: IncomingHttpHeaders, name: string): string | undefined {
  const value = headers[name]
  return typeof value === 'string' ? value : undefined
}

/** 规范化 Host 头为 URL；解析失败返回 undefined。 */
function parseAuthority(authority: string): URL | undefined {
  try {
    return new URL(`http://${authority}`)
  } catch {
    return undefined
  }
}

/** 主机名是否为本地回环。 */
export function isLoopbackHostname(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '[::1]') return true
  const parts = hostname.split('.')
  return parts.length === 4
    && parts[0] === '127'
    && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255)
}

/** 主机是否命中 trustedHosts：无端口条目匹配任意端口，带端口精确匹配。 */
function isTrustedAuthority(hostUrl: URL, trustedHosts: readonly string[]): boolean {
  return trustedHosts.some(entry => {
    const entryUrl = parseAuthority(entry)
    if (entryUrl === undefined) return false
    return entryUrl.port === '' || entryUrl.port === '80' || entryUrl.port === '443'
      ? entryUrl.hostname === hostUrl.hostname
      : entryUrl.host === hostUrl.host
  })
}

/** 判断请求是否可访问本插件桥。 */
export function isTrustedAgendaRequest(request: TrustRequest, trustedHosts: readonly string[]): boolean {
  const host = header(request.headers, 'host')
  if (host === undefined) return false
  const hostUrl = parseAuthority(host)
  if (hostUrl === undefined) return false
  if (!isLoopbackHostname(hostUrl.hostname) && !isTrustedAuthority(hostUrl, trustedHosts)) return false
  if (header(request.headers, 'sec-fetch-site') === 'cross-site') return false
  const origin = header(request.headers, 'origin')
  if (origin === undefined) return true
  try {
    return new URL(origin).hostname === hostUrl.hostname
  } catch {
    return false
  }
}
