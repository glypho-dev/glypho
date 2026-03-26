export type {
  Graph, Node, Edge, Group, Position, Style,
  Direction, Shape, EdgeOp, ParseError, ParseResult,
} from './types.js';

export { GlyphoParseError } from './errors.js';
export { Lexer, TokenType } from './lexer.js';
export type { Token } from './lexer.js';
export { Parser } from './parser.js';

import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import type { Group, ParseResult } from './types.js';

export { graphToMermaid } from './mermaid.js';
export { graphToGlypho } from './serialize.js';
export { graphToDot } from './dot.js';
export { graphToJsonCanvas } from './json-canvas.js';
export { parseMermaid } from './mermaid-to-glypho.js';
export { parseDot } from './dot-to-glypho.js';

export function flattenGroups(groups: Group[]): Group[] {
  const result: Group[] = [];
  for (const group of groups) {
    result.push(group);
    if (group.children) {
      result.push(...flattenGroups(group.children));
    }
  }
  return result;
}

export function parse(input: string): ParseResult {
  const tokens = new Lexer(input).tokenize();
  return new Parser(tokens).parse();
}
