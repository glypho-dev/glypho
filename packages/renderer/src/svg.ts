// React-free entry point: import from '@glypho/renderer/svg'
export { renderSvg, render } from './svg/render-svg.js';
export type { RenderSvgOptions } from './svg/render-svg.js';
export { computeLayout } from './layout/layout.js';
export { measureNode, measureText } from './layout/sizing.js';
export { resolveNodeStyle, resolveEdgeColor } from './styles/resolve.js';
export type { LayoutNode, LayoutEdge, LayoutGroup, LayoutResult, Point } from './layout/types.js';
export type { NodeStyle } from './styles/defaults.js';
