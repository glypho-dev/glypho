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
