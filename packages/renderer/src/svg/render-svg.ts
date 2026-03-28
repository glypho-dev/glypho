import type { Graph, ParseError } from '@glypho/parser';
import { parse } from '@glypho/parser';
import { computeLayout } from '../layout/layout.js';
import { computeViewBox } from '../layout/viewbox.js';
import { buildMarkerDefs } from './markers.js';
import { resolveEdgeColor } from '../styles/resolve.js';
import { renderGroup } from './groups.js';
import { renderEdgePath, renderEdgeLabel } from './edges.js';
import { renderNode } from './nodes.js';

export interface RenderSvgOptions {
  width?: number;
  height?: number;
  padding?: number;
}

export function renderSvg(graph: Graph, options: RenderSvgOptions = {}): string {
  const { width, height, padding = 40 } = options;
  const layout = computeLayout(graph);

  const viewBox = computeViewBox(layout, padding);

  const widthAttr = width != null ? ` width="${width}"` : '';
  const heightAttr = height != null ? ` height="${height}"` : '';

  const edgeColors = layout.edges.map(e => resolveEdgeColor(e.edge.color));
  const { defs, suffixMap } = buildMarkerDefs(edgeColors);
  const parts: string[] = [];
  parts.push(`<svg viewBox="${viewBox}"${widthAttr}${heightAttr} style="max-width:100%" xmlns="http://www.w3.org/2000/svg">`);
  parts.push(defs);

  for (const g of layout.groups) {
    parts.push(renderGroup(g));
  }
  for (const e of layout.edges) {
    parts.push(renderEdgePath(e, suffixMap));
  }
  for (const n of layout.nodes) {
    parts.push(renderNode(n, graph.styles));
  }
  for (const e of layout.edges) {
    parts.push(renderEdgeLabel(e));
  }

  parts.push('</svg>');
  return parts.join('');
}

export function render(
  source: string,
  options?: RenderSvgOptions,
): { svg: string; errors: ParseError[] } {
  const { graph, errors } = parse(source);
  const svg = renderSvg(graph, options);
  return { svg, errors };
}
