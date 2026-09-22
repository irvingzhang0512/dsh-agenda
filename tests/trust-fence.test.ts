/**
 * 信任栅栏测试：回环放行、跨站拒绝、信任主机、Origin 同源校验。
 */
import { describe, expect, it } from 'vitest'
import { isLoopbackHostname, isTrustedAgendaRequest } from '../src/host/trust-fence.ts'

const HEADERS = (host: string, extra: Record<string, string> = {}): { headers: Record<string, string> } => ({
  headers: { host, ...extra },
})

describe('isLoopbackHostname', () => {
  it('回环主机识别', () => {
    expect(isLoopbackHostname('localhost')).toBe(true)
    expect(isLoopbackHostname('[::1]')).toBe(true)
    expect(isLoopbackHostname('127.0.0.1')).toBe(true)
    expect(isLoopbackHostname('127.255.0.1')).toBe(true)
    expect(isLoopbackHostname('192.168.1.10')).toBe(false)
    expect(isLoopbackHostname('dev.example.com')).toBe(false)
  })
})

describe('isTrustedAgendaRequest', () => {
  const trusted = ['dev.example.com', 'agenda.internal:8443']

  it('回环主机直接放行', () => {
    expect(isTrustedAgendaRequest(HEADERS('127.0.0.1:3080'), trusted)).toBe(true)
    expect(isTrustedAgendaRequest(HEADERS('localhost:3080'), trusted)).toBe(true)
  })

  it('非回环主机须命中 trustedHosts', () => {
    expect(isTrustedAgendaRequest(HEADERS('dev.example.com:80'), trusted)).toBe(true)
    expect(isTrustedAgendaRequest(HEADERS('agenda.internal:8443'), trusted)).toBe(true)
    // 端口不匹配（条目带显式端口）
    expect(isTrustedAgendaRequest(HEADERS('agenda.internal:9999'), trusted)).toBe(false)
    expect(isTrustedAgendaRequest(HEADERS('evil.example.com:80'), trusted)).toBe(false)
  })

  it('跨站标记拒绝', () => {
    expect(isTrustedAgendaRequest(HEADERS('127.0.0.1:3080', { 'sec-fetch-site': 'cross-site' }), trusted)).toBe(false)
    expect(isTrustedAgendaRequest(HEADERS('127.0.0.1:3080', { 'sec-fetch-site': 'same-origin' }), trusted)).toBe(true)
  })

  it('Origin 须与 Host 同源', () => {
    expect(isTrustedAgendaRequest(HEADERS('127.0.0.1:3080', { origin: 'http://127.0.0.1:3080' }), trusted)).toBe(true)
    expect(isTrustedAgendaRequest(HEADERS('127.0.0.1:3080', { origin: 'http://evil.example.com' }), trusted)).toBe(false)
    // 无 Origin 的请求放行
    expect(isTrustedAgendaRequest(HEADERS('127.0.0.1:3080'), trusted)).toBe(true)
  })

  it('缺 Host 头拒绝', () => {
    expect(isTrustedAgendaRequest({ headers: {} }, trusted)).toBe(false)
  })
})
