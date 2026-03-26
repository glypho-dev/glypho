import type { Graph, ParseError } from '@glypho/parser';
import { parse } from '@glypho/parser';
import { computeLayout } from '../layout/layout.js';
import { MARKER_DEFS } from './markers.js';
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

  const allX = [
    ...layout.nodes.map(n => n.x),
    ...layout.nodes.map(n => n.x + n.width),
    ...layout.groups.map(g => g.x),
    ...layout.groups.map(g => g.x + g.width),
  ];
  const allY = [
    ...layout.nodes.map(n => n.y),
    ...layout.nodes.map(n => n.y + n.height),
    ...layout.groups.map(g => g.y),
    ...layout.groups.map(g => g.y + g.height),
  ];

  const minX = allX.length > 0 ? Math.min(...allX) : 0;
  const minY = allY.length > 0 ? Math.min(...allY) : 0;
  const maxX = allX.length > 0 ? Math.max(...allX) : 100;
  const maxY = allY.length > 0 ? Math.max(...allY) : 100;

  const viewBox = `${minX - padding} ${minY - padding} ${maxX - minX + padding * 2} ${maxY - minY + padding * 2}`;

  const widthAttr = width != null ? ` width="${width}"` : '';
  const heightAttr = height != null ? ` height="${height}"` : '';

  const parts: string[] = [];
  parts.push(`<svg viewBox="${viewBox}"${widthAttr}${heightAttr} style="max-width:100%" xmlns="http://www.w3.org/2000/svg">`);
  parts.push(MARKER_DEFS);

  for (const g of layout.groups) {
    parts.push(renderGroup(g));
  }
  for (const e of layout.edges) {
    parts.push(renderEdgePath(e));
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
