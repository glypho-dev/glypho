import type { EdgeOp } from '@glypho/parser';
import type { LayoutEdge } from '../layout/types.js';
import { pointsToPath, pathMidpoint } from '../edges/paths.js';
import { resolveEdgeColor } from '../styles/resolve.js';
import { escapeXml } from './escape.js';

interface EdgeVisual {
  strokeDasharray?: string;
  strokeWidth: number;
  markerEnd?: string;
  markerStart?: string;
}

const EDGE_VISUALS: Record<EdgeOp, EdgeVisual> = {
  '>': { strokeWidth: 2, markerEnd: 'url(#arrowhead)' },
  '~': { strokeWidth: 2, strokeDasharray: '6 4', markerEnd: 'url(#arrowhead)' },
  '=': { strokeWidth: 4, markerEnd: 'url(#arrowhead-thick)' },
  '--': { strokeWidth: 2 },
  '<>': { strokeWidth: 2, markerEnd: 'url(#arrowhead)', markerStart: 'url(#arrowhead-reverse)' },
};

export function renderEdgePath(layoutEdge: LayoutEdge): string {
  const { edge, points } = layoutEdge;
  const color = resolveEdgeColor(edge.color);
  const visual = EDGE_VISUALS[edge.op];
  const d = pointsToPath(points);

  let attrs = `d="${d}" fill="none" stroke="${escapeXml(color)}" stroke-width="${visual.strokeWidth}"`;
  if (visual.strokeDasharray) attrs += ` stroke-dasharray="${visual.strokeDasharray}"`;
  if (visual.markerEnd) attrs += ` marker-end="${visual.markerEnd}"`;
  if (visual.markerStart) attrs += ` marker-start="${visual.markerStart}"`;

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
