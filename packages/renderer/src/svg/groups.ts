import type { LayoutGroup } from '../layout/types.js';
import { DEFAULT_GROUP_STROKE, DEFAULT_GROUP_FILL } from '../styles/defaults.js';
import { escapeXml } from './escape.js';

export function renderGroup(layoutGroup: LayoutGroup): string {
  const { group, x, y, width, height, depth } = layoutGroup;
  const label = group.label ?? group.id;
  const fillOpacity = Math.max(0.3, 1 - depth * 0.15);

  return `<g><rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${DEFAULT_GROUP_FILL}" fill-opacity="${fillOpacity}" stroke="${DEFAULT_GROUP_STROKE}" stroke-width="1.5" stroke-dasharray="6 3" rx="8" ry="8"/><text x="${x + 10}" y="${y + 16}" fill="#555555" font-size="13" font-family="system-ui, sans-serif" font-weight="bold">${escapeXml(label)}</text></g>`;
}
