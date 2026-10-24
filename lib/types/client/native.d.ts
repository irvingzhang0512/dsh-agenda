/** 公开 Desktop 传输地址；HTTP 页才可回退页面来源。 */
export declare function agendaSocketUrl(location: {
    protocol: string;
    href: string;
}, transport?: {
    streamBaseUrl?: string;
}): string;
