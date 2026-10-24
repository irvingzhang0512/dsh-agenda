import type { SkillRegistration } from '@deepseek-ai/dsh-skill';
export interface ParsedSkillFrontmatter {
    name: string;
    description: string;
    whenToUse?: string;
    content: string;
}
/** 解析 `---` frontmatter（支持普通与折叠 `>-` 块标量）。 */
export declare function parseSkillFrontmatter(raw: string): ParsedSkillFrontmatter | undefined;
/** 读取捆绑 SKILL.md 为 SkillRegistration；不可用时返回 undefined。 */
export declare function loadBundledSkill(fileUrl?: string | URL): Promise<SkillRegistration | undefined>;
