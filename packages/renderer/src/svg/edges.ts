import type { EdgeOp } from '@glypho/parser';
import type { LayoutEdge } from '../layout/types.js';
import type { Point } from '../layout/types.js';
import { pointsToPath, pathMidpoint } from '../edges/paths.js';
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

// Arrowhead lengths must match markerWidth in markers.ts
const ARROW_END_LENGTH: Record<string, number> = { '>': 10, '~': 10, '=': 14, '<>': 10 };
const ARROW_START_LENGTH: Record<string, number> = { '<>': 10 };

function shortenEnd(pts: Point[], amount: number): Point[] {
  if (pts.length < 2) return pts;
  const result = pts.map(p => ({ ...p }));
  const last = result[result.length - 1];
  const prev = result[result.length - 2];
  const dx = last.x - prev.x;
  const dy = last.y - prev.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len <= amount) return result;
  const r = (len - amount) / len;
  result[result.length - 1] = { x: prev.x + dx * r, y: prev.y + dy * r };
  return result;
}

function shortenStart(pts: Point[], amount: number): Point[] {
  if (pts.length < 2) return pts;
  const result = pts.map(p => ({ ...p }));
  const first = result[0];
  const next = result[1];
  const dx = next.x - first.x;
  const dy = next.y - first.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len <= amount) return result;
  const r = amount / len;
  result[0] = { x: first.x + dx * r, y: first.y + dy * r };
  return result;
}

export function renderEdgePath(layoutEdge: LayoutEdge): string {
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

  let attrs = `d="${d}" fill="none" stroke="${escapeXml(color)}" stroke-width="${visual.strokeWidth}"`;
  if (visual.strokeDasharray) attrs += ` stroke-dasharray="${visual.strokeDasharray}"`;

  const end = markerEndId(edge.op, color);
  const start = markerStartId(edge.op, color);
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
