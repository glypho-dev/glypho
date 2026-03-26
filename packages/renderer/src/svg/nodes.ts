import type { Shape, Style } from '@glypho/parser';
import type { LayoutNode } from '../layout/types.js';
import { resolveNodeStyle } from '../styles/resolve.js';
import { DEFAULT_TEXT_COLOR } from '../styles/defaults.js';
import { renderShape } from './shapes.js';
import { escapeXml } from './escape.js';

export function renderNode(layoutNode: LayoutNode, styles: Style[]): string {
  const { node, x, y, width, height } = layoutNode;
  const shape: Shape = node.shape ?? 'r';
  const style = resolveNodeStyle(node, styles);
  const label = node.label ?? node.id;
  const lines = label.split('\n');

  const textLines = lines.map((line, i) => {
    const dy = height / 2 + (i - (lines.length - 1) / 2) * 20;
    return `<text x="${width / 2}" y="${dy}" text-anchor="middle" dominant-baseline="central" fill="${DEFAULT_TEXT_COLOR}" font-size="14" font-family="system-ui, sans-serif">${escapeXml(line)}</text>`;
  }).join('');

  return `<g transform="translate(${x}, ${y})" data-node-id="${escapeXml(node.id)}">${renderShape(shape, width, height, style)}${textLines}</g>`;
}
