import { escapeXml } from './escape.js';

const DEFAULT_COLOR = '#444444';

/**
 * Reduce an arbitrary string to a safe marker-ID prefix. IDs must be unique
 * per document, so every render namespaces its markers; the prefix ends up
 * inside `id="…"` and `url(#…)`, so only [A-Za-z0-9_-] survive, and it always
 * starts with a letter so the result is a valid XML name.
 */
export function sanitizeIdPrefix(raw: string): string {
  const cleaned = raw.replace(/[^A-Za-z0-9_-]/g, '');
  return /^[A-Za-z]/.test(cleaned) ? cleaned : `g${cleaned}`;
}

/** Deterministic 32-bit FNV-1a hash, base-36 encoded. */
export function hashString(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function markerTriple(color: string, prefix: string, suffix: string): string {
  const esc = escapeXml(color);
  return `<marker id="${prefix}-arrowhead${suffix}" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto" markerUnits="userSpaceOnUse">\
<polygon points="0 0, 10 3.5, 0 7" fill="${esc}"/>\
</marker>\
<marker id="${prefix}-arrowhead-thick${suffix}" markerWidth="14" markerHeight="10" refX="0" refY="5" orient="auto" markerUnits="userSpaceOnUse">\
<polygon points="0 0, 14 5, 0 10" fill="${esc}"/>\
</marker>\
<marker id="${prefix}-arrowhead-reverse${suffix}" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto" markerUnits="userSpaceOnUse">\
<polygon points="10 0, 0 3.5, 10 7" fill="${esc}"/>\
</marker>`;
}

/**
 * Build marker defs for all unique edge colors.
 * Returns the <defs> block and a color→suffix lookup for referencing markers.
 * `prefix` must already be sanitized (see sanitizeIdPrefix).
 */
export function buildMarkerDefs(colors: string[], prefix: string): { defs: string; suffixMap: Map<string, string> } {
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
    parts.push(markerTriple(ordered[i], prefix, suffix));
  }

  return { defs: `<defs>${parts.join('')}</defs>`, suffixMap };
}

export function markerEndId(op: string, prefix: string, suffix: string): string {
  if (op === '--') return '';
  const base = op === '=' ? 'arrowhead-thick' : 'arrowhead';
  return `${prefix}-${base}${suffix}`;
}

export function markerStartId(op: string, prefix: string, suffix: string): string {
  if (op !== '<>') return '';
  return `${prefix}-arrowhead-reverse${suffix}`;
}
