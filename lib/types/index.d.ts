import z from '@deepseek-ai/schemastery';
import { stringifyHostMessage } from './shared/wire.ts';
import type { Context } from './context-types.ts';
/** 插件身份（cordis.yml 行 / client-modules 注册名）。 */
export declare const name = "dsh-agenda";
/** 必需服务：工具注册、WebSocket 升级面。Skill 条件注册。 */
export declare const inject: string[];
export declare const Config: z<Schemastery.ObjectS<{}>, Schemastery.ObjectT<{}>, "plain">;
/** 桥路径（与 client 半保持一致）。 */
export declare const BRIDGE_PATH = "/agenda/ws";
/** 插件主体；先完成目录与离线资料初始化，再公开服务。 */
export declare function apply(ctx: Context): Promise<void>;
export { stringifyHostMessage };
