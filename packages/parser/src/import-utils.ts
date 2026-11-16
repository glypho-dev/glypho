// Shared helpers for the Mermaid and DOT importers. Both formats accept ids
// that `.g` rejects (`_start`, `1`, `my node`), so every imported id goes
// through one mapping that yields valid, unique `.g` ids.

const VALID_ID = /^[A-Za-z](?:[A-Za-z0-9_]|-(?=[A-Za-z0-9_]))*$/;

export function isValidGlyphoId(id: string): boolean {
  return VALID_ID.test(id);
}

/**
 * Turn an arbitrary foreign id into a valid `.g` id:
 * - characters outside `[A-Za-z0-9_-]` become `_`
 * - a hyphen not followed by an id character (`a-`, the first of `a--b`) becomes `_`
 * - leading underscores are dropped (`_start` → `start`), which also undoes
 *   the `_end` rename `graphToMermaid` applies to Mermaid keywords
 * - an id that would start with a digit, or is empty, gets an `n` prefix
 */
export function sanitizeId(raw: string): string {
  if (VALID_ID.test(raw)) return raw;
  let id = raw
    .replace(/[^A-Za-z0-9_-]/g, '_')
    .replace(/-(?![A-Za-z0-9_])/g, '_')
    .replace(/^[_-]+/, '');
  if (!/^[A-Za-z]/.test(id)) id = 'n' + id;
  return id;
}

/** Consistent raw → `.g` id mapping for one import, de-duplicating collisions */
export class IdMap {
  private map = new Map<string, string>();
  private used = new Set<string>();

  get(raw: string): string {
    const existing = this.map.get(raw);
    if (existing !== undefined) return existing;
    const base = sanitizeId(raw);
    let id = base;
    for (let n = 2; this.used.has(id); n++) id = `${base}_${n}`;
    this.map.set(raw, id);
    this.used.add(id);
    return id;
  }
}

// CSS named colors most likely to appear in DOT/Mermaid sources. `.g` only
// accepts hex, so these are converted; anything else is dropped.
const NAMED_COLORS: Record<string, string> = {
  black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000',
  blue: '#0000ff', yellow: '#ffff00', cyan: '#00ffff', aqua: '#00ffff',
  magenta: '#ff00ff', fuchsia: '#ff00ff', gray: '#808080', grey: '#808080',
  silver: '#c0c0c0', maroon: '#800000', olive: '#808000', lime: '#00ff00',
  navy: '#000080', teal: '#008080', purple: '#800080', orange: '#ffa500',
  pink: '#ffc0cb', brown: '#a52a2a', gold: '#ffd700', violet: '#ee82ee',
  indigo: '#4b0082', coral: '#ff7f50', salmon: '#fa8072', khaki: '#f0e68c',
  beige: '#f5f5dc', ivory: '#fffff0', lavender: '#e6e6fa', tan: '#d2b48c',
  lightgray: '#d3d3d3', lightgrey: '#d3d3d3', darkgray: '#a9a9a9', darkgrey: '#a9a9a9',
  lightblue: '#add8e6', darkblue: '#00008b', lightgreen: '#90ee90', darkgreen: '#006400',
  lightyellow: '#ffffe0', lightpink: '#ffb6c1', darkred: '#8b0000', darkorange: '#ff8c00',
  skyblue: '#87ceeb', steelblue: '#4682b4', tomato: '#ff6347', crimson: '#dc143c',
};

/**
 * Normalize a foreign color to `#rgb` / `#rrggbb`, or undefined when it has
 * no hex equivalent (gradients, HSV triples, unknown names). Writing a named
 * color through unchanged would re-parse as a node label.
 */
export function normalizeColor(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  const c = raw.trim();
  if (/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(c)) return c;
  // Drop the alpha channel of #rgba / #rrggbbaa
  if (/^#[0-9a-fA-F]{4}$/.test(c)) return c.slice(0, 4);
  if (/^#[0-9a-fA-F]{8}$/.test(c)) return c.slice(0, 7);
  return NAMED_COLORS[c.toLowerCase()];
}

const NAMED_ENTITIES: Record<string, string> = {
  quot: '"', amp: '&', lt: '<', gt: '>', apos: "'", nbsp: ' ',
};

/**
 * Decode HTML entities (`&quot;`, `&#35;`, `&#x23;`) and Mermaid's own
 * entity codes (`#quot;`, `#35;`). Unknown names are left as written.
 */
export function decodeEntities(s: string): string {
  return s.replace(
    /&#x([0-9a-fA-F]+);|&#(\d+);|&([A-Za-z]+);|#x([0-9a-fA-F]+);|#(\d+);|#([A-Za-z]+);/g,
    (whole, hex?: string, dec?: string, name?: string, mHex?: string, mDec?: string, mName?: string) => {
      const h = hex ?? mHex;
      const d = dec ?? mDec;
      const code = h !== undefined ? parseInt(h, 16) : d !== undefined ? parseInt(d, 10) : undefined;
      if (code !== undefined) return code <= 0x10ffff ? String.fromCodePoint(code) : whole;
      return NAMED_ENTITIES[(name ?? mName)!.toLowerCase()] ?? whole;
    },
  );
}
