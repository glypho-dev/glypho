// React entry point — requires React peer dependency.
// For the pure SVG string renderer (no React), use '@glypho/renderer/svg'.
export { GlyphoGraph } from './GlyphoGraph.js';
export type { GlyphoGraphProps } from './GlyphoGraph.js';
export { computeLayout } from './layout/layout.js';
export { measureNode, measureText } from './layout/sizing.js';
export { resolveNodeStyle, resolveEdgeColor } from './styles/resolve.js';
export type { LayoutNode, LayoutEdge, LayoutGroup, LayoutResult, Point } from './layout/types.js';
export type { NodeStyle } from './styles/defaults.js';
