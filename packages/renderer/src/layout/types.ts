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

export interface LayoutEdge {
  edge: Edge;
  points: Point[];
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
