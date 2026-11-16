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

/**
 * Trim `amount` of length off the end of a polyline, so an arrowhead drawn
 * from the new end lands on the node border. The trim walks back across as
 * many segments as it needs — dense routes can end in segments shorter than
 * the arrowhead, and trimming only the last one left the arrow under the node.
 */
export function shortenEnd(pts: Point[], amount: number): Point[] {
  if (pts.length < 2) return pts;
  return trimFromStart([...pts].reverse(), amount).reverse();
}

/** Trim `amount` of length off the start of a polyline (see shortenEnd) */
export function shortenStart(pts: Point[], amount: number): Point[] {
  if (pts.length < 2) return pts;
  return trimFromStart(pts, amount);
}

function trimFromStart(pts: Point[], amount: number): Point[] {
  const total = pts.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - pts[i].x, p.y - pts[i].y), 0);
  // Never trim a path away entirely
  if (total <= amount) return pts.map(p => ({ ...p }));
  let remaining = amount;
  let i = 0;
  for (; i + 1 < pts.length; i++) {
    const len = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    if (len > remaining) break;
    remaining -= len;
  }
  const a = pts[i];
  const b = pts[i + 1];
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const r = remaining / len;
  const first = { x: a.x + (b.x - a.x) * r, y: a.y + (b.y - a.y) * r };
  return [first, ...pts.slice(i + 1).map(p => ({ ...p }))];
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
