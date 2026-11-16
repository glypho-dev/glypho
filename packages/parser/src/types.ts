export type Direction = 'LR' | 'TB' | 'RL' | 'BT';
export type Shape = 'r' | 'd' | 'c' | 'o' | 'p' | 'h';
export type EdgeOp = '>' | '~' | '=' | '--' | '<>';

export interface Graph {
  direction?: Direction;
  nodes: Node[];
  edges: Edge[];
  groups: Group[];
  positions: Position[];
  styles: Style[];
}

export interface Node {
  /** Created by a node statement, or implicitly by an edge, group member, class assignment or position */
  id: string;
  shape?: Shape;
  label?: string;
  color?: string;
  classes?: string[];
  line?: number;
}

export interface Edge {
  from: string;
  to: string;
  op: EdgeOp;
  label?: string;
  color?: string;
  line?: number;
}

export interface Group {
  id: string;
  label?: string;
  /** Direct node members; each is also present in `Graph.nodes` */
  members: string[];
  /** Nested groups (at most 100 levels deep) */
  children?: Group[];
  line?: number;
}

export interface Position {
  id: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  line?: number;
}

export interface Style {
  /** `:shape` (one of the six shapes), `.class` or `#id` */
  selector: string;
  /** Raw values: hex colors, numbers with optional units (`1.5`, `12px`), words, or the content of a quoted value */
  properties: Record<string, string>;
  line?: number;
}

export interface ParseError {
  message: string;
  line: number;
  column?: number;
}

export interface ParseResult {
  graph: Graph;
  errors: ParseError[];
}
