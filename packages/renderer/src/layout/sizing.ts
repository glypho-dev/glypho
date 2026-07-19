import type { Node, Shape } from '@glypho/parser';

/** Vertical distance between label lines — must match the SVG/React text renderers */
export const LINE_HEIGHT = 18;
/** Labels wider than this (px) are auto-wrapped at word boundaries (~30 average chars) */
export const MAX_LABEL_WIDTH = 240;

const PADDING_X = 20;
const PADDING_Y = 12;
const MIN_WIDTH = 50;
const MIN_HEIGHT = 32;

const SHAPE_WIDTH_MULTIPLIER: Record<Shape, number> = {
  r: 1,
  d: 1.4,
  c: 1,
  o: 1.15,
  p: 1.1,
  h: 1.3,
};

const SHAPE_HEIGHT_MULTIPLIER: Record<Shape, number> = {
  r: 1,
  d: 1.4,
  c: 1,
  o: 1.3,
  p: 1,
  h: 1,
};

// Approximate glyph advance widths at font-size 14 for a generic sans-serif.
// Buckets, not metrics: the goal is that wide scripts (CJK ≈ 1em) and narrow
// ASCII no longer share one flat 8px estimate.
const NARROW_CHARS = new Set("ijlftr.,:;!'\"|()[]{} -".split(''));
const WIDE_CHARS = new Set('mwMW@%&'.split(''));
const NARROW_WIDTH = 5;
const REGULAR_WIDTH = 8;
const UPPERCASE_WIDTH = 9.5;
const WIDE_WIDTH = 12;
const CJK_WIDTH = 14;
const EMOJI_WIDTH = 16;

function isCjk(cp: number): boolean {
  return (cp >= 0x1100 && cp <= 0x115f)   // Hangul Jamo
    || (cp >= 0x2e80 && cp <= 0x303e)     // CJK radicals, punctuation
    || (cp >= 0x3041 && cp <= 0x33ff)     // Kana, CJK misc
    || (cp >= 0x3400 && cp <= 0x4dbf)     // CJK ext A
    || (cp >= 0x4e00 && cp <= 0x9fff)     // CJK unified
    || (cp >= 0xa000 && cp <= 0xa4cf)     // Yi
    || (cp >= 0xac00 && cp <= 0xd7a3)     // Hangul syllables
    || (cp >= 0xf900 && cp <= 0xfaff)     // CJK compat
    || (cp >= 0xfe30 && cp <= 0xfe4f)     // CJK compat forms
    || (cp >= 0xff00 && cp <= 0xff60)     // Fullwidth forms
    || (cp >= 0xffe0 && cp <= 0xffe6)     // Fullwidth signs
    || (cp >= 0x20000 && cp <= 0x3fffd);  // CJK ext B+
}

function isEmoji(cp: number): boolean {
  return (cp >= 0x1f000)                  // Emoji, symbols, pictographs
    || (cp >= 0x2600 && cp <= 0x27bf)     // Misc symbols, dingbats
    || (cp >= 0x2b00 && cp <= 0x2bff);    // Misc symbols and arrows
}

function charWidth(ch: string): number {
  const cp = ch.codePointAt(0)!;
  if (cp === 0x200d || cp === 0xfe0f) return 0; // ZWJ, variation selector
  if (cp < 0x80) {
    if (NARROW_CHARS.has(ch)) return NARROW_WIDTH;
    if (WIDE_CHARS.has(ch)) return WIDE_WIDTH;
    if (cp >= 0x41 && cp <= 0x5a) return UPPERCASE_WIDTH;
    return REGULAR_WIDTH;
  }
  if (isCjk(cp)) return CJK_WIDTH;
  if (isEmoji(cp)) return EMOJI_WIDTH;
  return REGULAR_WIDTH;
}

/** Approximate rendered width in px of a single line of label text */
export function measureLine(line: string): number {
  let width = 0;
  for (const ch of line) width += charWidth(ch);
  return width;
}

/**
 * Split a label into display lines: manual newlines are respected, and any
 * line wider than MAX_LABEL_WIDTH is greedily word-wrapped (glyph-wrapped for
 * unbroken runs like CJK or long tokens). The layout sizing and the SVG/React
 * node renderers must both use this so text stays inside its node.
 */
export function wrapLabel(label: string): string[] {
  const out: string[] = [];
  for (const manual of label.split('\n')) {
    if (measureLine(manual) <= MAX_LABEL_WIDTH) {
      out.push(manual);
    } else {
      out.push(...wrapLine(manual));
    }
  }
  return out;
}

function wrapLine(line: string): string[] {
  const lines: string[] = [];
  let current = '';

  const flush = () => {
    if (current) {
      lines.push(current);
      current = '';
    }
  };

  for (const word of line.split(' ')) {
    const candidate = current ? current + ' ' + word : word;
    if (measureLine(candidate) <= MAX_LABEL_WIDTH) {
      current = candidate;
      continue;
    }
    flush();
    if (measureLine(word) <= MAX_LABEL_WIDTH) {
      current = word;
      continue;
    }
    // Single run wider than the limit (e.g. CJK, long identifier) — break by glyph
    for (const ch of word) {
      if (current && measureLine(current + ch) > MAX_LABEL_WIDTH) flush();
      current += ch;
    }
  }
  flush();
  return lines.length > 0 ? lines : [''];
}

export function measureText(text: string): { width: number; height: number } {
  const lines = text.split('\n');
  return {
    width: Math.max(...lines.map(measureLine)),
    height: lines.length * LINE_HEIGHT,
  };
}

export function measureNode(node: Node): { width: number; height: number } {
  const label = node.label ?? node.id;
  const lines = wrapLabel(label);
  const textWidth = Math.max(...lines.map(measureLine));
  const textHeight = lines.length * LINE_HEIGHT;

  const shape: Shape = node.shape ?? 'r';
  const wMul = SHAPE_WIDTH_MULTIPLIER[shape];
  const hMul = SHAPE_HEIGHT_MULTIPLIER[shape];

  let width = Math.max((textWidth + PADDING_X * 2) * wMul, MIN_WIDTH);
  let height = Math.max((textHeight + PADDING_Y * 2) * hMul, MIN_HEIGHT);

  // Circle: make it square (use max dimension)
  if (shape === 'c') {
    const size = Math.max(width, height);
    width = size;
    height = size;
  }

  return { width: Math.ceil(width), height: Math.ceil(height) };
}
