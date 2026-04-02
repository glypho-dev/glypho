// Default entry point: parser + SVG renderer (no React dependency)

// Parser
export {
  parse, parseMermaid, parseDot,
  graphToMermaid, graphToGlypho, graphToDot, graphToJsonCanvas,
  flattenGroups,
  GlyphoParseError, Lexer, TokenType, Parser,
} from '@glypho/parser';

export type {
  Graph, Node, Edge, Group, Position, Style,
  Direction, Shape, EdgeOp, ParseError, ParseResult, Token,
} from '@glypho/parser';

// Renderer (SVG-only, no React)
export {
  render, renderSvg,
  computeLayout,
  measureNode, measureText,
  resolveNodeStyle, resolveEdgeColor,
} from '@glypho/renderer/svg';

export type {
  RenderSvgOptions,
  LayoutNode, LayoutEdge, LayoutGroup, LayoutResult, Point, NodeStyle,
} from '@glypho/renderer/svg';
