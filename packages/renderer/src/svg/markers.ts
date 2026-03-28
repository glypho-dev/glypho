import { escapeXml } from './escape.js';

const DEFAULT_COLOR = '#444444';

function markerId(base: string, color: string): string {
  if (color === DEFAULT_COLOR) return base;
  return `${base}-${color.replace('#', '')}`;
}

function markerTriple(color: string): string {
  const esc = escapeXml(color);
  const suffix = color === DEFAULT_COLOR ? '' : `-${color.replace('#', '')}`;
  return `<marker id="arrowhead${suffix}" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto" markerUnits="userSpaceOnUse">\
<polygon points="0 0, 10 3.5, 0 7" fill="${esc}"/>\
</marker>\
<marker id="arrowhead-thick${suffix}" markerWidth="14" markerHeight="10" refX="0" refY="5" orient="auto" markerUnits="userSpaceOnUse">\
<polygon points="0 0, 14 5, 0 10" fill="${esc}"/>\
</marker>\
<marker id="arrowhead-reverse${suffix}" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto" markerUnits="userSpaceOnUse">\
<polygon points="10 0, 0 3.5, 10 7" fill="${esc}"/>\
</marker>`;
}

export function buildMarkerDefs(colors: string[]): string {
  const unique = [DEFAULT_COLOR, ...colors.filter(c => c !== DEFAULT_COLOR)];
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const c of unique) {
    if (seen.has(c)) continue;
    seen.add(c);
    parts.push(markerTriple(c));
  }
  return `<defs>${parts.join('')}</defs>`;
}

export function markerEndId(op: string, color: string): string {
  if (op === '--') return '';
  const base = op === '=' ? 'arrowhead-thick' : 'arrowhead';
  return markerId(base, color);
}

export function markerStartId(op: string, color: string): string {
  if (op !== '<>') return '';
  return markerId('arrowhead-reverse', color);
}
