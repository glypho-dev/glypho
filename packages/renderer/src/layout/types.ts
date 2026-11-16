import type { Node, Edge, Group } from '@glypho/parser';

export interface Point {
  x: number;
  y: number;
}

export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  node: Node;
}

export interface EdgeLabelBox {
  /** Center of the label box */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Display lines (manual `\n` breaks plus auto-wrap) */
  lines: string[];
}

export interface LayoutEdge {
  edge: Edge;
  points: Point[];
  /** Present when the edge has a label */
  labelBox?: EdgeLabelBox;
}

export interface LayoutGroup {
  group: Group;
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
}

export interface LayoutResult {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  groups: LayoutGroup[];
  width: number;
  height: number;
}
