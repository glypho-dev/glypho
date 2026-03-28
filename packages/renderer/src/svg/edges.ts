import type { EdgeOp } from '@glypho/parser';
import type { LayoutEdge } from '../layout/types.js';
import { pointsToPath, pathMidpoint, shortenEnd, shortenStart, ARROW_END_LENGTH, ARROW_START_LENGTH } from '../edges/paths.js';
import { resolveEdgeColor } from '../styles/resolve.js';
import { escapeXml } from './escape.js';
import { markerEndId, markerStartId } from './markers.js';

interface EdgeVisual {
  strokeDasharray?: string;
  strokeWidth: number;
}

const EDGE_VISUALS: Record<EdgeOp, EdgeVisual> = {
  '>': { strokeWidth: 2 },
  '~': { strokeWidth: 2, strokeDasharray: '6 4' },
  '=': { strokeWidth: 4 },
  '--': { strokeWidth: 2 },
  '<>': { strokeWidth: 2 },
};

export function renderEdgePath(layoutEdge: LayoutEdge, suffixMap: Map<string, string>): string {
  const { edge } = layoutEdge;
  let points = layoutEdge.points;
  const color = resolveEdgeColor(edge.color);
  const visual = EDGE_VISUALS[edge.op];

  // Shorten path so stroke ends behind the arrowhead base
  const endLen = ARROW_END_LENGTH[edge.op];
  if (endLen) points = shortenEnd(points, endLen);
  const startLen = ARROW_START_LENGTH[edge.op];
  if (startLen) points = shortenStart(points, startLen);

  const d = pointsToPath(points);
  const suffix = suffixMap.get(color) ?? '';

  let attrs = `d="${d}" fill="none" stroke="${escapeXml(color)}" stroke-width="${visual.strokeWidth}"`;
  if (visual.strokeDasharray) attrs += ` stroke-dasharray="${visual.strokeDasharray}"`;

  const end = markerEndId(edge.op, suffix);
  const start = markerStartId(edge.op, suffix);
  if (end) attrs += ` marker-end="url(#${end})"`;
  if (start) attrs += ` marker-start="url(#${start})"`;

  return `<path ${attrs}/>`;
}

export function renderEdgeLabel(layoutEdge: LayoutEdge): string {
  const { edge, points } = layoutEdge;
  if (!edge.label) return '';

  const mid = pathMidpoint(points);
  const labelWidth = edge.label.length * 7 + 16;
  const labelX = -(edge.label.length * 3.5 + 8);

  return `<g transform="translate(${mid.x}, ${mid.y - 14})"><rect x="${labelX}" y="-10" width="${labelWidth}" height="20" fill="white" stroke="#bbb" stroke-width="0.5" rx="3"/><text text-anchor="middle" dominant-baseline="central" fill="#333333" font-size="13" font-family="system-ui, sans-serif">${escapeXml(edge.label)}</text></g>`;
}
