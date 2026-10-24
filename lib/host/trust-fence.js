function header(h, key) { return typeof h[key] === 'string' ? h[key] : undefined; }
export function isLoopbackHostname(host) {
    if (host === 'localhost' || host === '[::1]' || host === '::1')
        return true;
    const p = host.split('.');
    return p.length === 4 && p[0] === '127' && p.every(x => /^\d{1,3}$/.test(x) && Number(x) <= 255);
}
export function isTrustedAgendaRequest(req, trustedHosts = []) {
    const host = header(req.headers, 'host');
    if (!host || header(req.headers, 'sec-fetch-site') === 'cross-site')
        return false;
    let authority;
    try {
        authority = new URL(`${req.socket?.encrypted ? 'https' : 'http'}://${host}`);
    }
    catch {
        return false;
    }
    const local = isLoopbackHostname(authority.hostname);
    const remote = req.socket?.remoteAddress?.replace(/^::ffff:/, '');
    if (remote && !isLoopbackHostname(remote))
        return false;
    if (!local && !trustedHosts.some(entry => { try {
        const url = new URL('http://' + entry);
        return url.port ? url.host === authority.host : url.hostname === authority.hostname;
    }
    catch {
        return false;
    } }))
        return false;
    const origin = header(req.headers, 'origin');
    if (origin === 'dsh-app://app')
        return local;
    if (origin === undefined)
        return true;
    try {
        return new URL(origin).origin === authority.origin;
    }
    catch {
        return false;
    }
}
