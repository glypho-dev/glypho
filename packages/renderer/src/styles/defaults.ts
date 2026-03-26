import type { Shape } from '@glypho/parser';

export interface NodeStyle {
  fill: string;
  stroke: string;
  strokeWidth: number;
}

export const SHAPE_DEFAULTS: Record<Shape, NodeStyle> = {
  r: { fill: '#ffffff', stroke: '#222222', strokeWidth: 2 },
  d: { fill: '#fff8e1', stroke: '#f9a825', strokeWidth: 2 },
  c: { fill: '#e8f5e9', stroke: '#43a047', strokeWidth: 2 },
  o: { fill: '#e3f2fd', stroke: '#1e88e5', strokeWidth: 2 },
  p: { fill: '#f3e5f5', stroke: '#8e24aa', strokeWidth: 2 },
  h: { fill: '#fff3e0', stroke: '#ef6c00', strokeWidth: 2 },
};

export const DEFAULT_EDGE_COLOR = '#444444';
export const DEFAULT_GROUP_STROKE = '#888888';
export const DEFAULT_GROUP_FILL = '#f5f5f5';
export const DEFAULT_TEXT_COLOR = '#111111';
