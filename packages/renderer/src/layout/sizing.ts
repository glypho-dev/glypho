import type { Node, Shape } from '@glypho/parser';

const CHAR_WIDTH = 8;
const LINE_HEIGHT = 18;
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

export function measureText(text: string): { width: number; height: number } {
  const lines = text.split('\n');
  const maxLineLen = Math.max(...lines.map(l => l.length));
  return {
    width: maxLineLen * CHAR_WIDTH,
    height: lines.length * LINE_HEIGHT,
  };
}

export function measureNode(node: Node): { width: number; height: number } {
  const label = node.label ?? node.id;
  const { width: textWidth, height: textHeight } = measureText(label);

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
