import type { Point } from '../layout/types.js';

/**
 * Convert an array of points to an SVG path d-string.
 * 2 points → straight line, 3+ → quadratic bezier curves through midpoints.
 */
export function pointsToPath(points: Point[]): string {
  if (points.length < 2) return '';

  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  // Smooth curve through control points
  let d = `M ${points[0].x} ${points[0].y}`;

  // First segment: quadratic to midpoint of first two control points
  const mid0 = midpoint(points[0], points[1]);
  d += ` L ${mid0.x} ${mid0.y}`;

  // Middle segments: quadratic bezier curves
  for (let i = 1; i < points.length - 1; i++) {
    const mid = midpoint(points[i], points[i + 1]);
    d += ` Q ${points[i].x} ${points[i].y} ${mid.x} ${mid.y}`;
  }

  // Last segment: line to end
  d += ` L ${points[points.length - 1].x} ${points[points.length - 1].y}`;

  return d;
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// Arrowhead lengths must match markerWidth in markers
export const ARROW_END_LENGTH: Record<string, number> = { '>': 10, '~': 10, '=': 14, '<>': 10 };
export const ARROW_START_LENGTH: Record<string, number> = { '<>': 10 };

export function shortenEnd(pts: Point[], amount: number): Point[] {
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

export function shortenStart(pts: Point[], amount: number): Point[] {
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

/** Get the midpoint of a path (for label placement) */
export function pathMidpoint(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0];

  const mid = Math.floor(points.length / 2);
  if (points.length % 2 === 0) {
    return midpoint(points[mid - 1], points[mid]);
  }
  return points[mid];
}
