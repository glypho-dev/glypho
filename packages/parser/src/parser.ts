import { TokenType, type Token } from './lexer.js';
import type {
  Graph, Node, Edge, Group, Position, Style,
  Direction, Shape, EdgeOp, ParseError, ParseResult,
} from './types.js';

const DIRECTIONS = new Set<string>(['LR', 'TB', 'RL', 'BT']);
const SHAPES = new Set<string>(['r', 'd', 'c', 'o', 'p', 'h']);
const EDGE_OPS = new Set<TokenType>([
  TokenType.GT, TokenType.TILDE, TokenType.EQUALS,
  TokenType.DASH_DASH, TokenType.DIAMOND,
]);

function edgeOpFromToken(type: TokenType): EdgeOp {
  switch (type) {
    case TokenType.GT: return '>';
    case TokenType.TILDE: return '~';
    case TokenType.EQUALS: return '=';
    case TokenType.DASH_DASH: return '--';
    case TokenType.DIAMOND: return '<>';
    default: throw new Error(`Not an edge op: ${type}`);
  }
}

export class Parser {
  private tokens: Token[];
  private pos = 0;
  private errors: ParseError[] = [];
  private nodeMap = new Map<string, Node>();
  private edges: Edge[] = [];
  private groups: Group[] = [];
  private positions: Position[] = [];
  private styles: Style[] = [];
  private direction?: Direction;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): ParseResult {
    while (!this.isAtEnd()) {
      this.skipNewlines();
      if (this.isAtEnd()) break;

      try {
        this.parseStatement();
      } catch {
        // Error already recorded — skip to next line
        this.skipToNextLine();
      }
    }

    const graph: Graph = {
      nodes: Array.from(this.nodeMap.values()),
      edges: this.edges,
      groups: this.groups,
      positions: this.positions,
      styles: this.styles,
    };
    if (this.direction) graph.direction = this.direction;
    return { graph, errors: this.errors };
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  private current(): Token {
    return this.tokens[this.pos];
  }

  private peek(offset = 1): Token {
    return this.tokens[this.pos + offset] ?? this.tokens[this.tokens.length - 1];
  }

  private advance(): Token {
    const tok = this.tokens[this.pos];
    this.pos++;
    return tok;
  }

  private expect(type: TokenType): Token {
    const tok = this.current();
    if (tok.type !== type) {
      this.addError(`Expected ${type} but got ${tok.type}`, tok);
      throw new Error('parse error');
    }
    return this.advance();
  }

  private check(type: TokenType): boolean {
    return this.current().type === type;
  }

  private match(type: TokenType): Token | null {
    if (this.check(type)) return this.advance();
    return null;
  }

  private isAtEnd(): boolean {
    return this.current().type === TokenType.EOF;
  }

  private isEndOfStatement(): boolean {
    const t = this.current().type;
    return t === TokenType.NEWLINE || t === TokenType.EOF;
  }

  private skipNewlines(): void {
    while (this.check(TokenType.NEWLINE)) this.advance();
  }

  private skipToNextLine(): void {
    while (!this.isAtEnd() && !this.check(TokenType.NEWLINE)) {
      this.advance();
    }
  }

  private addError(message: string, tok: Token): void {
    this.errors.push({ message, line: tok.line, column: tok.column });
  }

  private ensureNode(id: string, line: number): Node {
    let node = this.nodeMap.get(id);
    if (!node) {
      node = { id, line };
      this.nodeMap.set(id, node);
    }
    return node;
  }

  private addNodeClass(node: Node, className: string): void {
    if (!node.classes) {
      node.classes = [className];
      return;
    }
    if (!node.classes.includes(className)) {
      node.classes.push(className);
    }
  }

  // ── Statement Dispatch ───────────────────────────────────────────────

  private parseStatement(): void {
    const tok = this.current();

    switch (tok.type) {
      case TokenType.SLASH_SLASH:
        // Comment — skip rest of line
        this.skipToNextLine();
        return;

      case TokenType.GT:
        this.parseDirection();
        return;

      case TokenType.DOLLAR:
        this.parseStyleBlock();
        return;

      case TokenType.AT:
        this.groups.push(this.parseGroup());
        return;

      case TokenType.DOT:
        this.parseClassAssignment();
        return;

      case TokenType.ID:
        this.parseIdStatement();
        return;

      default:
        this.addError(`Unexpected token: ${tok.type}`, tok);
        this.skipToNextLine();
    }
  }

  // ── Direction ────────────────────────────────────────────────────────

  private parseDirection(): void {
    const gt = this.advance(); // consume >
    const tok = this.current();

    if (tok.type !== TokenType.ID || !DIRECTIONS.has(tok.value)) {
      this.addError(`Expected direction (LR, TB, RL, BT)`, tok);
      throw new Error('parse error');
    }

    if (this.direction) {
      this.addError('Duplicate direction declaration', gt);
    }

    this.direction = tok.value as Direction;
    this.advance();
  }

  // ── ID-initiated statements (node, edge, chain, position) ──────────

  private parseIdStatement(): void {
    const idTok = this.advance(); // consume first ID
    const id = idTok.value;
    const next = this.current();

    // Position: id @ x , y
    if (next.type === TokenType.AT) {
      this.parsePosition(id, idTok.line);
      return;
    }

    // Edge or chain: id op id ...
    if (EDGE_OPS.has(next.type)) {
      this.parseEdgeOrChain(id, idTok.line);
      return;
    }

    // Node definition: id [:shape] [label] [#color]
    this.parseNodeDef(id, idTok.line);
  }

  // ── Node ─────────────────────────────────────────────────────────────

  private parseNodeDef(id: string, line: number): void {
    const node = this.ensureNode(id, line);

    // Optional shape
    if (this.check(TokenType.COLON)) {
      this.advance(); // consume :
      const shapeTok = this.current();
      if (shapeTok.type === TokenType.ID && SHAPES.has(shapeTok.value)) {
        node.shape = shapeTok.value as Shape;
        this.advance();
      } else {
        this.addError(`Expected shape (r, d, c, o, p, h)`, shapeTok);
      }
    }

    // Optional label
    const label = this.tryParseLabel();
    if (label !== undefined) node.label = label;

    // Optional color
    const color = this.tryParseColor();
    if (color !== undefined) node.color = color;
  }

  // ── Edge / Chain ─────────────────────────────────────────────────────

  private parseEdgeOrChain(fromId: string, line: number): void {
    this.ensureNode(fromId, line);

    const opTok = this.advance(); // consume operator
    const op = edgeOpFromToken(opTok.type);
    const toTok = this.expect(TokenType.ID);
    const toId = toTok.value;
    this.ensureNode(toId, toTok.line);

    // Check if this is a chain (next token is another edge op)
    if (!this.isEndOfStatement() && EDGE_OPS.has(this.current().type)) {
      // It's a chain — first edge has no label/color
      this.edges.push({ from: fromId, to: toId, op, line });
      this.parseChainContinuation(toId, line);
      return;
    }

    // Single edge — optional label and color
    const label = this.tryParseLabel();
    const color = this.tryParseColor();

    const edge: Edge = { from: fromId, to: toId, op, line };
    if (label !== undefined) edge.label = label;
    if (color !== undefined) edge.color = color;
    this.edges.push(edge);
  }

  private parseChainContinuation(prevId: string, line: number): void {
    while (!this.isEndOfStatement() && EDGE_OPS.has(this.current().type)) {
      const opTok = this.advance();
      const op = edgeOpFromToken(opTok.type);
      const toTok = this.expect(TokenType.ID);
      this.ensureNode(toTok.value, toTok.line);
      this.edges.push({ from: prevId, to: toTok.value, op, line });
      prevId = toTok.value;
    }
  }

  // ── Group ────────────────────────────────────────────────────────────

  private parseGroup(): Group {
    const atTok = this.advance(); // consume @
    const idTok = this.expect(TokenType.ID);

    // Optional label (before {)
    let label: string | undefined;
    if (!this.check(TokenType.LBRACE)) {
      label = this.tryParseLabel();
    }

    this.expect(TokenType.LBRACE);

    const members: string[] = [];
    const children: Group[] = [];
    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      this.skipNewlines();
      if (this.check(TokenType.RBRACE) || this.isAtEnd()) break;
      if (this.check(TokenType.AT)) {
        children.push(this.parseGroup());
      } else {
        const memberTok = this.expect(TokenType.ID);
        members.push(memberTok.value);
      }
    }

    this.expect(TokenType.RBRACE);

    const group: Group = { id: idTok.value, members, line: atTok.line };
    if (label !== undefined) group.label = label;
    if (children.length > 0) group.children = children;
    return group;
  }

  // ── Class Assignments ───────────────────────────────────────────────

  private parseClassAssignment(): void {
    this.advance(); // consume .
    const classTok = this.expect(TokenType.ID);
    this.expect(TokenType.LBRACE);

    while (!this.check(TokenType.RBRACE) && !this.isEndOfStatement() && !this.isAtEnd()) {
      const memberTok = this.expect(TokenType.ID);
      const node = this.ensureNode(memberTok.value, memberTok.line);
      this.addNodeClass(node, classTok.value);
    }

    this.expect(TokenType.RBRACE);
  }

  // ── Position ─────────────────────────────────────────────────────────

  private parsePosition(id: string, line: number): void {
    this.advance(); // consume @

    const negative_x = this.tryParseNegativeSign();
    const xTok = this.expect(TokenType.INTEGER);
    const x = (negative_x ? -1 : 1) * parseInt(xTok.value, 10);

    this.expect(TokenType.COMMA);

    const negative_y = this.tryParseNegativeSign();
    const yTok = this.expect(TokenType.INTEGER);
    const y = (negative_y ? -1 : 1) * parseInt(yTok.value, 10);

    const pos: Position = { id, x, y, line };

    // Optional size: ^widthxheight
    if (this.match(TokenType.CARET)) {
      const wTok = this.expect(TokenType.INTEGER);
      pos.width = parseInt(wTok.value, 10);

      // The "x" separator + height: lexer produces ID like "x40"
      const xSepTok = this.current();
      if (xSepTok.type === TokenType.ID && xSepTok.value.startsWith('x')) {
        const heightStr = xSepTok.value.slice(1);
        if (heightStr.length > 0 && /^\d+$/.test(heightStr)) {
          pos.height = parseInt(heightStr, 10);
          this.advance();
        } else {
          this.addError('Expected height after "x" in size', xSepTok);
        }
      } else {
        this.addError('Expected "x" separator in size', xSepTok);
      }
    }

    this.positions.push(pos);
  }

  private tryParseNegativeSign(): boolean {
    // Negative coordinates are not yet supported (spec §Edge Cases).
    // The lexer doesn't emit a single DASH token, so there's nothing to consume here.
    return false;
  }

  // ── Style ────────────────────────────────────────────────────────────

  private parseStyleBlock(): void {
    const dollarTok = this.advance(); // consume $

    // Parse selector: :shape, .class, or #id
    let selector: string;
    if (this.check(TokenType.COLON)) {
      this.advance();
      const shapeTok = this.expect(TokenType.ID);
      selector = ':' + shapeTok.value;
    } else if (this.check(TokenType.DOT)) {
      this.advance();
      const classTok = this.expect(TokenType.ID);
      selector = '.' + classTok.value;
    } else if (this.check(TokenType.HASH)) {
      this.advance();
      const idTok = this.expect(TokenType.ID);
      selector = '#' + idTok.value;
    } else {
      this.addError('Expected selector (:shape, .class, or #id)', this.current());
      throw new Error('parse error');
    }

    this.expect(TokenType.LBRACE);

    const properties: Record<string, string> = {};
    while (!this.check(TokenType.RBRACE) && !this.isEndOfStatement() && !this.isAtEnd()) {
      const nameTok = this.expect(TokenType.ID);
      this.expect(TokenType.COLON);
      const value = this.parsePropertyValue();
      properties[nameTok.value] = value;
    }

    this.expect(TokenType.RBRACE);

    this.styles.push({ selector, properties, line: dollarTok.line });
  }

  private parsePropertyValue(): string {
    const tok = this.current();

    // Quoted value
    if (tok.type === TokenType.QUOTED_STRING) {
      this.advance();
      return tok.value;
    }

    // Color value: #hex
    if (tok.type === TokenType.HASH) {
      this.advance();
      const colorTok = this.current();
      if (colorTok.type === TokenType.HEX_COLOR) {
        this.advance();
        return '#' + colorTok.value;
      }
      return '#';
    }

    // Integer value
    if (tok.type === TokenType.INTEGER) {
      this.advance();
      return tok.value;
    }

    // ID value (like a bare word)
    if (tok.type === TokenType.ID) {
      this.advance();
      return tok.value;
    }

    this.addError('Expected property value', tok);
    this.advance();
    return '';
  }

  // ── Label & Color helpers ────────────────────────────────────────────

  private tryParseLabel(): string | undefined {
    if (this.isEndOfStatement()) return undefined;

    const tok = this.current();

    if (tok.type === TokenType.QUOTED_STRING || tok.type === TokenType.MULTILINE_STRING) {
      this.advance();
      return tok.value;
    }

    if (tok.type === TokenType.INTEGER) {
      // Bare number as label — only if not followed by comma (which would be position)
      this.advance();
      return tok.value;
    }

    // Bare word label: an ID that's not a color and not a structural token
    if (tok.type === TokenType.ID) {
      // Don't consume if this looks like a color is coming (#)
      // The label is the ID value
      this.advance();
      return tok.value;
    }

    return undefined;
  }

  private tryParseColor(): string | undefined {
    if (this.isEndOfStatement()) return undefined;

    if (this.check(TokenType.HASH)) {
      this.advance();
      if (this.check(TokenType.HEX_COLOR)) {
        const tok = this.advance();
        return '#' + tok.value;
      }
    }

    return undefined;
  }
}
