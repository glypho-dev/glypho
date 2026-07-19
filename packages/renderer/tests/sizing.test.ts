import { describe, it, expect } from 'vitest';
import {
  measureNode, measureText, measureLine, wrapLabel, LINE_HEIGHT, MAX_LABEL_WIDTH,
} from '../src/layout/sizing.js';
import type { Node } from '@glypho/parser';

describe('measureLine', () => {
  it('gives narrow glyphs less width than regular glyphs', () => {
    expect(measureLine('illi')).toBeLessThan(measureLine('anon'));
  });

  it('gives uppercase more width than lowercase', () => {
    expect(measureLine('HELLO')).toBeGreaterThan(measureLine('hello'));
  });

  it('measures CJK glyphs at full width (14px each)', () => {
    expect(measureLine('日本語')).toBe(42);
  });

  it('measures fullwidth forms at full width', () => {
    expect(measureLine('ＡＢ')).toBe(28);
  });

  it('gives zero width to ZWJ and variation selectors', () => {
    expect(measureLine('\u200d\ufe0f')).toBe(0);
  });
});

describe('measureText', () => {
  it('measures single line', () => {
    const { width, height } = measureText('Hello');
    // H(9.5) + e(8) + l(5) + l(5) + o(8)
    expect(width).toBe(35.5);
    expect(height).toBe(LINE_HEIGHT);
  });

  it('measures multiline text using the longest line', () => {
    const { width, height } = measureText('Hello\nWorld!');
    expect(width).toBe(Math.max(measureLine('Hello'), measureLine('World!')));
    expect(height).toBe(2 * LINE_HEIGHT);
  });

  it('does not auto-wrap (wrapping is wrapLabel concern)', () => {
    const long = 'x'.repeat(100);
    expect(measureText(long).height).toBe(LINE_HEIGHT);
  });
});

describe('wrapLabel', () => {
  it('leaves short labels untouched', () => {
    expect(wrapLabel('Short label')).toEqual(['Short label']);
  });

  it('respects manual newlines', () => {
    expect(wrapLabel('one\ntwo')).toEqual(['one', 'two']);
  });

  it('wraps long labels at word boundaries under the max width', () => {
    const label = 'This is a rather long single line label that should wrap into multiple lines';
    const lines = wrapLabel(label);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(measureLine(line)).toBeLessThanOrEqual(MAX_LABEL_WIDTH);
    }
    expect(lines.join(' ')).toBe(label);
  });

  it('glyph-breaks unbroken runs longer than the max width', () => {
    const label = '日'.repeat(40);
    const lines = wrapLabel(label);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(measureLine(line)).toBeLessThanOrEqual(MAX_LABEL_WIDTH);
    }
    expect(lines.join('')).toBe(label);
  });

  it('only wraps the manual lines that exceed the max width', () => {
    const long = 'a very long line that definitely goes past the two hundred forty pixel limit for sure';
    const lines = wrapLabel(`short\n${long}`);
    expect(lines[0]).toBe('short');
    expect(lines.length).toBeGreaterThan(2);
  });
});

describe('measureNode', () => {
  it('uses id as label when no label set', () => {
    const node: Node = { id: 'a' };
    const { width, height } = measureNode(node);
    expect(width).toBeGreaterThanOrEqual(50); // min width
    expect(height).toBeGreaterThanOrEqual(32); // min height
  });

  it('sizes rectangle based on measured label width', () => {
    const node: Node = { id: 'x', shape: 'r', label: 'Long Label Here' };
    const { width } = measureNode(node);
    expect(width).toBe(Math.ceil(measureText('Long Label Here').width + 40));
  });

  it('sizes CJK labels wider than same-length ASCII labels', () => {
    const ascii: Node = { id: 'a', shape: 'r', label: 'abcdef' };
    const cjk: Node = { id: 'b', shape: 'r', label: '日本語日本語' };
    expect(measureNode(cjk).width).toBeGreaterThan(measureNode(ascii).width);
  });

  it('grows height instead of width for auto-wrapped labels', () => {
    const long: Node = {
      id: 'x', shape: 'r',
      label: 'This is a rather long single line label that should wrap into multiple lines',
    };
    const { width, height } = measureNode(long);
    expect(width).toBeLessThanOrEqual(MAX_LABEL_WIDTH + 40);
    expect(height).toBeGreaterThan(measureNode({ id: 'y', shape: 'r', label: 'short' }).height);
  });

  it('applies diamond multiplier', () => {
    const rect: Node = { id: 'a', shape: 'r', label: 'Test' };
    const diamond: Node = { id: 'b', shape: 'd', label: 'Test' };
    const rectSize = measureNode(rect);
    const diamondSize = measureNode(diamond);
    expect(diamondSize.width).toBeGreaterThan(rectSize.width);
  });

  it('makes circle square', () => {
    const node: Node = { id: 'x', shape: 'c', label: 'A very long label' };
    const { width, height } = measureNode(node);
    expect(width).toBe(height);
  });

  it('applies hexagon multiplier', () => {
    const rect: Node = { id: 'a', shape: 'r', label: 'Test' };
    const hex: Node = { id: 'b', shape: 'h', label: 'Test' };
    const rectSize = measureNode(rect);
    const hexSize = measureNode(hex);
    expect(hexSize.width).toBeGreaterThan(rectSize.width);
  });
});
