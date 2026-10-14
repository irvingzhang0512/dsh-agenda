/** Desktop 回环及普通 HTTP 的可信来源检查；不接受任意 null Origin。 */
import type { IncomingHttpHeaders } from 'node:http'
interface TrustRequest { headers: IncomingHttpHeaders, socket?: { remoteAddress?: string, encrypted?: boolean } }
function header(h: IncomingHttpHeaders, key: string): string | undefined { return typeof h[key] === 'string' ? h[key] as string : undefined }
export function isLoopbackHostname(host: string): boolean {
  if (host === 'localhost' || host === '[::1]' || host === '::1') return true
  const p = host.split('.')
  return p.length === 4 && p[0] === '127' && p.every(x => /^\d{1,3}$/.test(x) && Number(x) <= 255)
}
export function isTrustedAgendaRequest(req: TrustRequest, trustedHosts: readonly string[] = []): boolean {
  const host = header(req.headers, 'host')
  if (!host || header(req.headers, 'sec-fetch-site') === 'cross-site') return false
  let authority: URL
  try { authority = new URL(`${req.socket?.encrypted ? 'https' : 'http'}://${host}`) } catch { return false }
  const local = isLoopbackHostname(authority.hostname)
  const remote = req.socket?.remoteAddress?.replace(/^::ffff:/, '')
  if (remote && !isLoopbackHostname(remote)) return false
  if (!local && !trustedHosts.some(entry => { try { const url = new URL('http://' + entry); return url.port ? url.host === authority.host : url.hostname === authority.hostname } catch { return false } })) return false
  const origin = header(req.headers, 'origin')
  if (origin === 'dsh-app://app') return local
  if (origin === undefined) return true
  try { return new URL(origin).origin === authority.origin } catch { return false }
}
