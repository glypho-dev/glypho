import type { LayoutResult } from './types.js';
import { pathMidpoint } from '../edges/paths.js';

/**
 * Compute viewBox bounds from the full layout, including nodes, groups,
 * edge control points, and edge labels.
 */
export function computeViewBox(layout: LayoutResult, padding: number): string {
  const allX: number[] = [];
  const allY: number[] = [];

  for (const n of layout.nodes) {
    allX.push(n.x, n.x + n.width);
    allY.push(n.y, n.y + n.height);
  }

  for (const g of layout.groups) {
    allX.push(g.x, g.x + g.width);
    allY.push(g.y, g.y + g.height);
  }

  for (const e of layout.edges) {
    // Edge path control points
    for (const p of e.points) {
      allX.push(p.x);
      allY.push(p.y);
    }

    // Edge label bounds
    if (e.edge.label) {
      const mid = pathMidpoint(e.points);
      const labelHalfW = (e.edge.label.length * 7 + 16) / 2;
      allX.push(mid.x - labelHalfW, mid.x + labelHalfW);
      allY.push(mid.y - 24, mid.y - 4); // label is translated to (mid.x, mid.y - 14), rect y=-10..+10
    }
  }

  const minX = allX.length > 0 ? Math.min(...allX) : 0;
  const minY = allY.length > 0 ? Math.min(...allY) : 0;
  const maxX = allX.length > 0 ? Math.max(...allX) : 100;
  const maxY = allY.length > 0 ? Math.max(...allY) : 100;

  return `${minX - padding} ${minY - padding} ${maxX - minX + padding * 2} ${maxY - minY + padding * 2}`;
}
