/** 分类路径分隔符。 */
export declare const CATEGORY_SEPARATOR = "/";
/** 校验并归一化一个分类路径；非法抛 AgendaError。 */
export declare function normalizeCategoryPath(path: string): string;
/** 分类树节点（UI 渲染用；纯函数）。 */
export interface CategoryNode {
    name: string;
    path: string;
    children: CategoryNode[];
}
/** 把路径列表构建为树（按层级排序）。 */
export declare function buildCategoryTree(paths: readonly string[]): CategoryNode[];
/** 某分类在树中的全部祖先+自身（含中间层级，用于统计聚合）。 */
export declare function categoryWithAncestors(path: string): string[];
