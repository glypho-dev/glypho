import type { Node, Style, Shape } from '@glypho/parser';
import { SHAPE_DEFAULTS, type NodeStyle } from './defaults.js';

/** Parse a 3 or 6 digit hex color to full 6-digit form */
function normalizeHex(hex: string): string {
  const h = hex.startsWith('#') ? hex.slice(1) : hex;
  if (h.length === 3) {
    return '#' + h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  return '#' + h;
}

/** Derive a light tinted fill from a stroke color */
function tintFill(hex: string): string {
  const h = normalizeHex(hex).slice(1);
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // Blend 80% toward white
  const tr = Math.round(r + (255 - r) * 0.8);
  const tg = Math.round(g + (255 - g) * 0.8);
  const tb = Math.round(b + (255 - b) * 0.8);
  return '#' + [tr, tg, tb].map(c => c.toString(16).padStart(2, '0')).join('');
}

/**
 * Resolve the final visual style for a node.
 * Cascade: shape defaults → $:shape styles → $.class styles → $#id styles → inline color
 */
export function resolveNodeStyle(
  node: Node,
  styles: Style[],
): NodeStyle {
  const shape: Shape = node.shape ?? 'r';
  const result = { ...SHAPE_DEFAULTS[shape] };

  // Apply $:shape styles
  for (const style of styles) {
    if (style.selector === ':' + shape) {
      applyStyleProperties(result, style.properties);
    }
  }

  // Apply $.class styles in declaration order.
  for (const style of styles) {
    if (style.selector.startsWith('.') && node.classes?.includes(style.selector.slice(1))) {
      applyStyleProperties(result, style.properties);
    }
  }

  // Apply $#id styles
  for (const style of styles) {
    if (style.selector === '#' + node.id) {
      applyStyleProperties(result, style.properties);
    }
  }

  // Apply inline color (sets stroke, derives fill)
  if (node.color) {
    result.stroke = normalizeHex(node.color);
    result.fill = tintFill(node.color);
  }

  return result;
}

function applyStyleProperties(
  style: NodeStyle,
  properties: Record<string, string>,
): void {
  if (properties.fill) style.fill = normalizeHex(properties.fill);
  if (properties.stroke) style.stroke = normalizeHex(properties.stroke);
  if (properties['stroke-width']) style.strokeWidth = parseFloat(properties['stroke-width']);
}

/** Resolve edge color: inline color or default */
export function resolveEdgeColor(color?: string): string {
  return color ? normalizeHex(color) : '#444444';
}
