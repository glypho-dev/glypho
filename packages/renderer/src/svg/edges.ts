import type { EdgeOp } from '@glypho/parser';
import type { LayoutEdge } from '../layout/types.js';
import { pointsToPath, shortenEnd, shortenStart, ARROW_END_LENGTH, ARROW_START_LENGTH } from '../edges/paths.js';
import { resolveEdgeColor } from '../styles/resolve.js';
import { escapeXml } from './escape.js';
import { markerEndId, markerStartId } from './markers.js';
import { EDGE_LABEL_FONT_SIZE, EDGE_LABEL_LINE_HEIGHT } from '../layout/sizing.js';

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

export function renderEdgePath(layoutEdge: LayoutEdge, suffixMap: Map<string, string>, markerPrefix: string): string {
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

  const end = markerEndId(edge.op, markerPrefix, suffix);
  const start = markerStartId(edge.op, markerPrefix, suffix);
  if (end) attrs += ` marker-end="url(#${end})"`;
  if (start) attrs += ` marker-start="url(#${start})"`;

  return `<path ${attrs}/>`;
}

export function renderEdgeLabel(layoutEdge: LayoutEdge): string {
  const box = layoutEdge.labelBox;
  if (!box) return '';

  const text = box.lines.map((line, i) => {
    const dy = (i - (box.lines.length - 1) / 2) * EDGE_LABEL_LINE_HEIGHT;
    return `<text y="${dy}" text-anchor="middle" dominant-baseline="central" fill="#333333" font-size="${EDGE_LABEL_FONT_SIZE}" font-family="system-ui, sans-serif">${escapeXml(line)}</text>`;
  }).join('');

  return `<g transform="translate(${box.x}, ${box.y})"><rect x="${-box.width / 2}" y="${-box.height / 2}" width="${box.width}" height="${box.height}" fill="white" stroke="#bbb" stroke-width="0.5" rx="3"/>${text}</g>`;
}
