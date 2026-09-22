/**
 * dsh-agenda — CategoryService：多级分类（Path 方式，层数不固定）。
 *
 * 路径以 `/` 分隔，例如 `工作/防干烧/算法`（需求 §9）。规则：
 * - 每段 trim、非空、不含 `/` 与首尾空白；
 * - 首尾不允许 `/`；不允许连续 `//`；
 * - 归一化后存入 categories.yaml，保持稳定排序；
 * - 删除仅影响分类定义；Event/Todo 上的引用保留（展示为普通文本）。
 */
import { AgendaError } from './errors.ts'

/** 分类路径分隔符。 */
export const CATEGORY_SEPARATOR = '/'

/** 校验并归一化一个分类路径；非法抛 AgendaError。 */
export function normalizeCategoryPath(path: string): string {
  const trimmed = path.trim()
  if (trimmed === '') throw new AgendaError('INVALID_CATEGORY', '分类路径不能为空。')
  if (trimmed.startsWith(CATEGORY_SEPARATOR) || trimmed.endsWith(CATEGORY_SEPARATOR)) {
    throw new AgendaError('INVALID_CATEGORY', `分类路径不能以「${CATEGORY_SEPARATOR}」开头或结尾: ${path}`)
  }
  const segments = trimmed.split(CATEGORY_SEPARATOR).map(segment => segment.trim())
  if (segments.some(segment => segment === '')) {
    throw new AgendaError('INVALID_CATEGORY', `分类路径包含空层级: ${path}`)
  }
  return segments.join(CATEGORY_SEPARATOR)
}

/** 分类树节点（UI 渲染用；纯函数）。 */
export interface CategoryNode {
  name: string
  path: string
  children: CategoryNode[]
}

/** 把路径列表构建为树（按层级排序）。 */
export function buildCategoryTree(paths: readonly string[]): CategoryNode[] {
  const root: CategoryNode = { name: '', path: '', children: [] }
  for (const path of [...paths].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))) {
    const segments = path.split(CATEGORY_SEPARATOR)
    let cursor = root
    let prefix = ''
    for (const segment of segments) {
      prefix = prefix === '' ? segment : `${prefix}${CATEGORY_SEPARATOR}${segment}`
      let child = cursor.children.find(node => node.name === segment)
      if (child === undefined) {
        child = { name: segment, path: prefix, children: [] }
        cursor.children.push(child)
      }
      cursor = child
    }
  }
  const sortTree = (node: CategoryNode): void => {
    node.children.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
    for (const child of node.children) sortTree(child)
  }
  for (const child of root.children) sortTree(child)
  return root.children
}

/** 某分类在树中的全部祖先+自身（含中间层级，用于统计聚合）。 */
export function categoryWithAncestors(path: string): string[] {
  const segments = path.split(CATEGORY_SEPARATOR)
  const result: string[] = []
  let prefix = ''
  for (const segment of segments) {
    prefix = prefix === '' ? segment : `${prefix}${CATEGORY_SEPARATOR}${segment}`
    result.push(prefix)
  }
  return result
}
