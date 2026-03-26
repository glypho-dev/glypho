import { describe, it, expect } from 'vitest';
import { measureNode, measureText } from '../src/layout/sizing.js';
import type { Node } from '@glypho/parser';

describe('measureText', () => {
  it('measures single line', () => {
    const { width, height } = measureText('Hello');
    expect(width).toBe(40); // 5 chars * 8
    expect(height).toBe(18); // 1 line * 18
  });

  it('measures multiline text', () => {
    const { width, height } = measureText('Hello\nWorld!');
    expect(width).toBe(48); // 6 chars * 8 (longest line)
    expect(height).toBe(36); // 2 lines * 18
  });
});

describe('measureNode', () => {
  it('uses id as label when no label set', () => {
    const node: Node = { id: 'a' };
    const { width, height } = measureNode(node);
    expect(width).toBeGreaterThanOrEqual(50); // min width
    expect(height).toBeGreaterThanOrEqual(32); // min height
  });

  it('sizes rectangle based on label', () => {
    const node: Node = { id: 'x', shape: 'r', label: 'Long Label Here' };
    const { width } = measureNode(node);
    // 15 chars * 8 = 120 + 40 padding = 160
    expect(width).toBe(160);
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
