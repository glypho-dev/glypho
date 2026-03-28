import { escapeXml } from './escape.js';

const DEFAULT_COLOR = '#444444';

function markerTriple(color: string, suffix: string): string {
  const esc = escapeXml(color);
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

/**
 * Build marker defs for all unique edge colors.
 * Returns the <defs> block and a color→suffix lookup for referencing markers.
 */
export function buildMarkerDefs(colors: string[]): { defs: string; suffixMap: Map<string, string> } {
  const unique = [DEFAULT_COLOR, ...colors.filter(c => c !== DEFAULT_COLOR)];
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const c of unique) {
    if (seen.has(c)) continue;
    seen.add(c);
    ordered.push(c);
  }

  const suffixMap = new Map<string, string>();
  const parts: string[] = [];
  for (let i = 0; i < ordered.length; i++) {
    const suffix = i === 0 ? '' : `-${i}`;
    suffixMap.set(ordered[i], suffix);
    parts.push(markerTriple(ordered[i], suffix));
  }

  return { defs: `<defs>${parts.join('')}</defs>`, suffixMap };
}

export function markerEndId(op: string, suffix: string): string {
  if (op === '--') return '';
  const base = op === '=' ? 'arrowhead-thick' : 'arrowhead';
  return `${base}${suffix}`;
}

export function markerStartId(op: string, suffix: string): string {
  if (op !== '<>') return '';
  return `arrowhead-reverse${suffix}`;
}
