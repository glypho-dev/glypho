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
  members: string[];
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
  selector: string;
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
