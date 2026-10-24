/**
 * dsh-agenda — client 半入口（浏览器）。
 *
 * 注册：
 * - main 面板（key 'agenda'）：AgendaApp 主界面；
 * - sidebar.panellist（id 'agenda'）：侧栏图标。
 * 连接 WS 桥并与宿主共享同一套 AgendaService。
 */
import type { ReactElement } from 'react';
/** client 侧需要的服务。 */
export declare const inject: string[];
/** client 入口。 */
export declare function apply(ctx: {
    slots: {
        inject(name: string, register: () => () => void): void;
        register(options: {
            name: string;
            key?: string;
            id?: string;
            order?: number;
            label?: () => string;
        }, component: (props: never) => ReactElement | null): () => void;
    };
    effect(fn: () => () => void, label?: string): void;
}): void;
