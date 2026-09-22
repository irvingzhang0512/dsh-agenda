/**
 * dsh-agenda — 捆绑 SKILL.md 的自注册。
 *
 * 插件随包携带 `skills/agenda/SKILL.md`（人工维护的权威文本），挂载时解析
 * frontmatter 并通过 `ctx.skills.register` 注册，安装插件即安装 Skill。
 * 缺文件 / 不可读 / frontmatter 非法时优雅降级（返回 undefined），不阻断挂载。
 */
import { readFile } from 'node:fs/promises'
import type { SkillRegistration } from '@deepseek-ai/dsh-skill'

/** 捆绑 Skill 目录（相对本模块的深度：src/host/ 与 lib/host/ 同级）。 */
const BUNDLED_SKILL_URL = new URL('../../skills/agenda/SKILL.md', import.meta.url)

export interface ParsedSkillFrontmatter {
  name: string
  description: string
  whenToUse?: string
  content: string
}

/** 解析 `---` frontmatter（支持普通与折叠 `>-` 块标量）。 */
export function parseSkillFrontmatter(raw: string): ParsedSkillFrontmatter | undefined {
  let text = raw
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  if (!text.startsWith('---')) return undefined
  const firstLf = text.indexOf('\n')
  if (firstLf === -1) return undefined
  const rest = text.slice(firstLf + 1)
  const close = /^---[ \t]*$/m.exec(rest)
  if (close === null) return undefined
  const front = rest.slice(0, close.index)
  const content = rest.slice(close.index + close[0].length)

  const fields = new Map<string, string>()
  const lines = front.split(/\r?\n/)
  let i = 0
  while (i < lines.length) {
    const line = lines[i]!
    if (line.trim() === '' || /^\s*#/.test(line)) {
      i += 1
      continue
    }
    const match = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line)
    if (match === null) {
      i += 1
      continue
    }
    const key = match[1]!
    let value = match[2]!.trim()
    const block = /^([>|-])(-)?$/.exec(value)
    if (block !== null) {
      const parts: string[] = []
      i += 1
      while (i < lines.length && /^[ \t]/.test(lines[i]!)) {
        parts.push(lines[i]!.replace(/^[ \t]+/, ''))
        i += 1
      }
      value = block[1] === '|' ? parts.join('\n') : parts.join(' ')
    } else {
      i += 1
    }
    fields.set(key, value)
  }

  const name = fields.get('name')
  const description = fields.get('description')
  if (name === undefined || name === '' || description === undefined || description === '') return undefined
  const result: ParsedSkillFrontmatter = {
    name,
    description,
    content: content.replace(/^\r?\n/, '').replace(/\s+$/, ''),
  }
  const whenToUse = fields.get('whenToUse')
  if (whenToUse !== undefined && whenToUse !== '') result.whenToUse = whenToUse
  return result
}

/** 读取捆绑 SKILL.md 为 SkillRegistration；不可用时返回 undefined。 */
export async function loadBundledSkill(fileUrl: string | URL = BUNDLED_SKILL_URL): Promise<SkillRegistration | undefined> {
  try {
    const raw = await readFile(fileUrl, 'utf8')
    const parsed = parseSkillFrontmatter(raw)
    if (parsed === undefined) return undefined
    const registration: SkillRegistration = {
      name: parsed.name,
      description: parsed.description,
      content: parsed.content,
      source: 'bundled',
      provider: 'dsh-agenda',
      invocation: { modelInvocable: true, userInvocable: true },
      ...(parsed.whenToUse !== undefined ? { whenToUse: parsed.whenToUse } : {}),
    }
    return registration
  } catch {
    return undefined
  }
}
