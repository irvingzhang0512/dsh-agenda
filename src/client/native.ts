/** 公开 Desktop 传输地址；HTTP 页才可回退页面来源。 */
export function agendaSocketUrl(location: { protocol: string, href: string }, transport?: { streamBaseUrl?: string }): string {
  let url: URL
  if (transport?.streamBaseUrl) url = new URL('agenda/ws', transport.streamBaseUrl.replace(/\/+$/, '') + '/')
  else if (location.protocol === 'http:' || location.protocol === 'https:') url = new URL('/agenda/ws', location.href)
  else throw Error('Desktop 未提供有效的日程服务地址。')
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw Error('日程服务地址协议无效。')
  if (location.protocol === 'dsh-app:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw Error('Desktop 日程服务须为回环地址。')
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return url.toString()
}
