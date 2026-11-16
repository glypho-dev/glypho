import type {
  Graph, Node, Edge, Group, Style, Direction, Shape, EdgeOp,
  ParseError, ParseResult,
} from './types.js';
import { IdMap, normalizeColor } from './import-utils.js';

// ---------------------------------------------------------------------------
// DOT shape → Glyph shape mapping
// ---------------------------------------------------------------------------

const SHAPE_MAP: Record<string, Shape> = {
  box: 'r',
  rect: 'r',
  rectangle: 'r',
  square: 'r',
  diamond: 'd',
  circle: 'c',
  ellipse: 'o',
  oval: 'o',
  hexagon: 'h',
  Msquare: 'r',
  Mrecord: 'r',
  record: 'r',
};

// ---------------------------------------------------------------------------
// Attribute parsing: [key=value, key="value", ...]
// ---------------------------------------------------------------------------

function parseAttrs(text: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  let i = 0;

  while (i < text.length) {
    // Skip whitespace and commas/semicolons
    while (i < text.length && /[\s,;]/.test(text[i])) i++;
    if (i >= text.length) break;

    // Read key
    const keyStart = i;
    while (i < text.length && text[i] !== '=' && !/[\s,;\]]/.test(text[i])) i++;
    const key = text.slice(keyStart, i).trim();
    if (!key) break;

    // Skip whitespace around =
    while (i < text.length && /\s/.test(text[i])) i++;
    if (i >= text.length || text[i] !== '=') {
      // Boolean attribute (no value)
      attrs[key] = 'true';
      continue;
    }
    i++; // skip =
    while (i < text.length && /\s/.test(text[i])) i++;

    // Read value
    if (i < text.length && text[i] === '"') {
      // Quoted value
      i++; // skip opening quote
      let value = '';
      while (i < text.length && text[i] !== '"') {
        if (text[i] === '\\' && i + 1 < text.length) {
          const next = text[i + 1];
          if (next === 'n') { value += '\n'; i += 2; continue; }
          if (next === '"') { value += '"'; i += 2; continue; }
          if (next === '\\') { value += '\\'; i += 2; continue; }
        }
        value += text[i];
        i++;
      }
      if (i < text.length) i++; // skip closing quote
      attrs[key] = value;
    } else {
      // Unquoted value
      const valStart = i;
      while (i < text.length && !/[\s,;\]]/.test(text[i])) i++;
      attrs[key] = text.slice(valStart, i);
    }
  }

  return attrs;
}

// ---------------------------------------------------------------------------
// Extract bracketed attribute block: returns [attrs, rest]
// ---------------------------------------------------------------------------

function extractAttrBlock(text: string): [Record<string, string>, string] {
  const trimmed = text.trim();
  if (!trimmed.startsWith('[')) return [{}, trimmed];

  // Find matching ]
  let depth = 0;
  let i = 0;
  for (; i < trimmed.length; i++) {
    if (trimmed[i] === '[') depth++;
    else if (trimmed[i] === ']') {
      depth--;
      if (depth === 0) { i++; break; }
    }
  }

  const attrStr = trimmed.slice(1, i - 1);
  const rest = trimmed.slice(i).trim();
  return [parseAttrs(attrStr), rest];
}

// ---------------------------------------------------------------------------
// Node registry
// ---------------------------------------------------------------------------

class NodeRegistry {
  private map = new Map<string, Node>();
  private order: string[] = [];
  private ids = new IdMap();
  readonly groupIds = new IdMap();
  /** Original DOT id for nodes whose id had to be rewritten, used as the label if none is given */
  private fallbackLabels = new Map<string, string>();

  /** Map a DOT id to its `.g` id */
  resolve(raw: string): string {
    const id = this.ids.get(raw);
    if (id !== raw) this.fallbackLabels.set(id, raw);
    return id;
  }

  ensure(id: string, shape?: Shape, label?: string, color?: string): void {
    if (this.map.has(id)) {
      const existing = this.map.get(id)!;
      if (shape && !existing.shape) existing.shape = shape;
      if (label && !existing.label) existing.label = label;
      if (color && !existing.color) existing.color = color;
    } else {
      const node: Node = { id };
      if (shape) node.shape = shape;
      if (label) node.label = label;
      if (color) node.color = color;
      this.map.set(id, node);
      this.order.push(id);
    }
  }

  get(id: string): Node | undefined {
    return this.map.get(id);
  }

  toArray(): Node[] {
    return this.order.map(id => {
      const node = this.map.get(id)!;
      const fallback = this.fallbackLabels.get(id);
      if (fallback !== undefined && node.label === undefined) node.label = fallback;
      return node;
    });
  }
}

// ---------------------------------------------------------------------------
// Apply DOT attributes to a node
// ---------------------------------------------------------------------------

function applyNodeAttrs(nodes: NodeRegistry, id: string, attrs: Record<string, string>): void {
  let shape: Shape | undefined;
  let label: string | undefined;
  let color: string | undefined;

  if (attrs.shape) {
    // Check for rounded style + box = pill
    const dotShape = attrs.shape.toLowerCase();
    if (dotShape === 'box' && attrs.style?.includes('rounded')) {
      shape = 'p';
    } else {
      shape = SHAPE_MAP[dotShape];
    }
  }

  if (attrs.label !== undefined) {
    label = attrs.label;
  }

  // Only hex survives into .g — a named color written through would re-parse as a label
  if (attrs.fillcolor) {
    color = normalizeColor(attrs.fillcolor);
  } else if (attrs.color && attrs.style?.includes('filled')) {
    color = normalizeColor(attrs.color);
  }

  // Ensure node exists first, then apply attrs
  nodes.ensure(id);
  const node = nodes.get(id)!;
  if (shape && !node.shape) node.shape = shape;
  if (label && !node.label) node.label = label;
  if (color && !node.color) node.color = color;
}

// ---------------------------------------------------------------------------
// Determine Glyph edge op from DOT attributes
// ---------------------------------------------------------------------------

function edgeOpFromAttrs(attrs: Record<string, string>, isDirected: boolean): EdgeOp {
  if (attrs.dir === 'both') return '<>';
  if (attrs.dir === 'none') return '--';
  if (attrs.style === 'dashed' || attrs.style === 'dotted') return '~';
  if (attrs.style === 'bold') return '=';
  if (!isDirected) return '--';
  return '>';
}

// ---------------------------------------------------------------------------
// Strip C/C++ style comments and # line comments
// ---------------------------------------------------------------------------

function stripComments(input: string): string {
  // Remove /* ... */ block comments
  // (newlines inside are kept so statement line numbers stay accurate)
  let result = input.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ''));
  // Remove // and # line comments, but not inside quoted strings
  let output = '';
  let inQuotes = false;
  for (let i = 0; i < result.length; i++) {
    const ch = result[i];
    if (ch === '\\' && inQuotes && i + 1 < result.length) {
      output += ch + result[i + 1];
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      output += ch;
      continue;
    }
    if (!inQuotes) {
      if (ch === '/' && result[i + 1] === '/') {
        // Skip to end of line
        while (i < result.length && result[i] !== '\n') i++;
        if (i < result.length) output += '\n';
        continue;
      }
      if (ch === '#') {
        // Skip to end of line
        while (i < result.length && result[i] !== '\n') i++;
        if (i < result.length) output += '\n';
        continue;
      }
    }
    output += ch;
  }
  return output;
}

// ---------------------------------------------------------------------------
// Tokenize DOT into logical statements
// We split on semicolons and newlines, but respect braces for subgraphs
// ---------------------------------------------------------------------------

interface Statement {
  text: string;
  /** 1-based source line where the statement starts */
  line: number;
}

function tokenizeStatements(body: string, firstLine: number): Statement[] {
  const statements: Statement[] = [];
  let current = '';
  let depth = 0;
  let inQuotes = false;
  let line = firstLine;
  let startLine = firstLine;

  const flush = () => {
    const text = current.trim();
    if (text.length > 0) {
      // Count newlines before the first non-space character
      const lead = current.length - current.trimStart().length;
      const leadingNewlines = (current.slice(0, lead).match(/\n/g) ?? []).length;
      statements.push({ text, line: startLine + leadingNewlines });
    }
    current = '';
    startLine = line;
  };

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '\n') line++;

    if (ch === '\\' && inQuotes && i + 1 < body.length) {
      current += ch + body[i + 1];
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
      continue;
    }

    if (inQuotes) {
      current += ch;
      continue;
    }

    if (ch === '{') {
      depth++;
      current += ch;
      continue;
    }

    if (ch === '}') {
      depth--;
      current += ch;
      // A closed block ends its statement unless an edge or attribute list
      // continues it: `{ a b } c` is two statements, no separator required
      if (depth === 0 && !/^\s*(->|--|\[)/.test(body.slice(i + 1))) flush();
      continue;
    }

    if (depth === 0 && (ch === ';' || ch === '\n')) {
      flush();
      continue;
    }

    current += ch;
  }

  flush();
  return statements;
}

// ---------------------------------------------------------------------------
// Shared parse state
// ---------------------------------------------------------------------------

interface DotContext {
  nodes: NodeRegistry;
  edges: Edge[];
  groups: Group[];
  isDirected: boolean;
  errors: ParseError[];
}

// ---------------------------------------------------------------------------
// Parse a subgraph block
// ---------------------------------------------------------------------------

function parseSubgraph(stmt: Statement, ctx: DotContext, parentGroup?: Group): void {
  // Match: subgraph [name] { ... }
  const match = stmt.text.match(/^subgraph(?:\s+("(?:[^"\\]|\\.)*"|[^\s{]+))?\s*\{([\s\S]*)\}\s*$/);
  if (!match) {
    ctx.errors.push({ message: `Could not parse subgraph: "${stmt.text.split('\n')[0]}"`, line: stmt.line });
    return;
  }

  const bodyLine = stmt.line + (stmt.text.slice(0, stmt.text.indexOf('{')).match(/\n/g) ?? []).length;
  const innerStatements = tokenizeStatements(match[2], bodyLine);

  // An anonymous subgraph (`subgraph { rank=same; a b }`) only scopes
  // attributes — its nodes belong to the enclosing group
  if (match[1] === undefined) {
    for (const inner of innerStatements) parseStatement(inner, ctx, parentGroup);
    return;
  }

  let rawId = match[1];
  if (rawId.startsWith('"')) rawId = rawId.slice(1, -1).replace(/\\"/g, '"');
  // Strip cluster_ prefix for group ID
  const strippedId = rawId.startsWith('cluster_') ? rawId.slice(8) : rawId;
  const id = ctx.nodes.groupIds.get(strippedId);

  const group: Group = { id, members: [], line: stmt.line };
  let label: string | undefined;

  for (const inner of innerStatements) {
    // Subgraph label: `label="..."` or `graph [label="..."]`
    const graphAttrs = inner.text.match(/^graph\s*(\[[\s\S]*\])\s*$/);
    if (graphAttrs) {
      const [attrs] = extractAttrBlock(graphAttrs[1]);
      if (attrs.label !== undefined) label = attrs.label;
      continue;
    }
    if (ATTR_ASSIGNMENT.test(inner.text)) {
      const attrs = parseAttrs(inner.text);
      if (attrs.label !== undefined) label = attrs.label;
      continue;
    }

    parseStatement(inner, ctx, group);
  }

  if (label === undefined && id !== strippedId) label = strippedId;
  if (label && label !== id) group.label = label;

  if (parentGroup) {
    if (!parentGroup.children) parentGroup.children = [];
    parentGroup.children.push(group);
  } else {
    ctx.groups.push(group);
  }
}

/** `key=value` statement: a graph or subgraph attribute, not a node */
const ATTR_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*\s*=/;

// ---------------------------------------------------------------------------
// Check if a statement contains an edge operator outside of quoted strings
// and bracket attribute blocks
// ---------------------------------------------------------------------------

function containsEdgeOp(stmt: string, op: string): boolean {
  let inQuotes = false;
  let bracketDepth = 0;

  for (let i = 0; i < stmt.length; i++) {
    const ch = stmt[i];

    if (ch === '\\' && inQuotes && i + 1 < stmt.length) {
      i++; // skip escaped char
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (inQuotes) continue;

    if (ch === '[') bracketDepth++;
    else if (ch === ']') bracketDepth--;

    if (bracketDepth === 0 && stmt.slice(i, i + op.length) === op) {
      return true;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Parse a single statement
// ---------------------------------------------------------------------------

function parseStatement(stmt: Statement, ctx: DotContext, parentGroup?: Group): void {
  const trimmed = stmt.text.trim();
  if (trimmed.length === 0) return;

  // Skip graph-level attributes
  if (/^(graph|node|edge)\s*\[/i.test(trimmed)) return;
  if (ATTR_ASSIGNMENT.test(trimmed)) return;

  // Subgraph (named or anonymous)
  if (/^subgraph\b/.test(trimmed)) {
    parseSubgraph({ text: trimmed, line: stmt.line }, ctx, parentGroup);
    return;
  }
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    parseSubgraph({ text: 'subgraph ' + trimmed, line: stmt.line }, ctx, parentGroup);
    return;
  }

  // Edge statement: look for -> or -- outside of quoted strings and brackets
  const edgeOp = ctx.isDirected ? '->' : '--';
  if (containsEdgeOp(trimmed, edgeOp)) {
    parseEdgeStatement(trimmed, stmt.line, edgeOp, ctx, parentGroup);
    return;
  }

  // Also check the other edge op in case of mixed usage
  const altOp = ctx.isDirected ? '--' : '->';
  if (containsEdgeOp(trimmed, altOp)) {
    parseEdgeStatement(trimmed, stmt.line, altOp, ctx, parentGroup);
    return;
  }

  // Node statement
  parseNodeStatement(trimmed, stmt.line, ctx, parentGroup);
}

// ---------------------------------------------------------------------------
// Parse an edge statement: a -> b -> c [attrs]
// ---------------------------------------------------------------------------

function parseEdgeStatement(
  stmt: string,
  line: number,
  edgeToken: string,
  ctx: DotContext,
  parentGroup?: Group,
): void {
  // Extract any trailing attribute block first
  let mainPart = stmt;
  let edgeAttrs: Record<string, string> = {};

  const lastBracket = findTrailingAttrBlock(stmt);
  if (lastBracket !== -1) {
    const [attrs] = extractAttrBlock(stmt.slice(lastBracket));
    edgeAttrs = attrs;
    mainPart = stmt.slice(0, lastBracket).trim();
  }

  const parts = splitOnEdgeOp(mainPart, edgeToken).map(p => p.trim());
  const endpoints = parts.map(p => extractNodeId(p));
  const bad = endpoints.findIndex(e => e === null);
  if (bad !== -1) {
    ctx.errors.push({
      message: `Unsupported DOT edge endpoint "${parts[bad] || '(empty)'}" — only node ids are supported`,
      line,
    });
    return;
  }

  const ids = endpoints.map((e, i) => {
    const id = ctx.nodes.resolve(e!.raw);
    applyInlineAttrs(parts[i].slice(e!.length), id, ctx.nodes);
    if (parentGroup && !parentGroup.members.includes(id)) parentGroup.members.push(id);
    return id;
  });

  const op = edgeOpFromAttrs(edgeAttrs, ctx.isDirected || edgeToken === '->');
  const color = normalizeColor(edgeAttrs.color);
  for (let i = 0; i < ids.length - 1; i++) {
    const edge: Edge = { from: ids[i], to: ids[i + 1], op };
    if (edgeAttrs.label) edge.label = edgeAttrs.label;
    if (color) edge.color = color;
    ctx.edges.push(edge);
  }
}

// ---------------------------------------------------------------------------
// Split a string on edge operator, respecting brackets
// ---------------------------------------------------------------------------

function splitOnEdgeOp(text: string, op: string): string[] {
  const parts: string[] = [];
  let current = '';
  let i = 0;
  let bracketDepth = 0;

  let inQuotes = false;

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes && ch === '\\' && i + 1 < text.length) {
      current += ch + text[i + 1];
      i += 2;
      continue;
    }
    if (ch === '"') inQuotes = !inQuotes;
    if (!inQuotes) {
      if (ch === '[') bracketDepth++;
      else if (ch === ']') bracketDepth--;
    }

    if (!inQuotes && bracketDepth === 0 && text.slice(i, i + op.length) === op) {
      parts.push(current);
      current = '';
      i += op.length;
      continue;
    }

    current += text[i];
    i++;
  }

  parts.push(current);
  return parts;
}

// ---------------------------------------------------------------------------
// Find trailing attribute block position
// ---------------------------------------------------------------------------

function findTrailingAttrBlock(stmt: string): number {
  // Walk backwards from end to find the last [...] that's a true attr block
  let i = stmt.length - 1;

  // Skip trailing whitespace and semicolons
  while (i >= 0 && /[\s;]/.test(stmt[i])) i--;

  if (i < 0 || stmt[i] !== ']') return -1;

  // Find the matching [
  let depth = 0;
  let j = i;
  while (j >= 0) {
    if (stmt[j] === ']') depth++;
    else if (stmt[j] === '[') {
      depth--;
      if (depth === 0) {
        // Make sure there's something before this [ (a node id or edge op)
        const before = stmt.slice(0, j).trim();
        if (before.length > 0) return j;
      }
    }
    j--;
  }

  return -1;
}

// ---------------------------------------------------------------------------
// Extract node ID from a potentially attributed node reference
// ---------------------------------------------------------------------------

interface DotId {
  raw: string;
  /** Quoted ids can't be keywords: `"node"` is a node, `node` is not */
  quoted: boolean;
  /** Characters of the input the id occupies */
  length: number;
}

// DOT ids: quoted strings, identifiers (letters, `_`, non-ASCII), or numerals
const DOT_ID = /^(?:"((?:[^"\\]|\\[\s\S])*)"|([A-Za-z_\u0080-\uffff][A-Za-z0-9_\u0080-\uffff]*)|(-?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)))/;

function extractNodeId(text: string): DotId | null {
  const match = text.match(DOT_ID);
  if (!match) return null;
  if (match[1] !== undefined) {
    // `\"` is the only escape in a DOT quoted id; `\<newline>` is a line continuation
    const raw = match[1].replace(/\\\r?\n/g, '').replace(/\\"/g, '"');
    return raw.length > 0 ? { raw, quoted: true, length: match[0].length } : null;
  }
  return { raw: match[2] ?? match[3], quoted: false, length: match[0].length };
}

/** Apply a `[attrs]` block that follows a node id, if there is one */
function applyInlineAttrs(afterId: string, id: string, nodes: NodeRegistry): void {
  const rest = afterId.trim();
  if (rest.startsWith('[')) {
    const [attrs] = extractAttrBlock(rest);
    applyNodeAttrs(nodes, id, attrs);
  } else {
    nodes.ensure(id);
  }
}

// ---------------------------------------------------------------------------
// Parse a node statement: nodeId [attrs]
// ---------------------------------------------------------------------------

const DOT_KEYWORDS = new Set(['graph', 'digraph', 'node', 'edge', 'strict', 'subgraph']);

function parseNodeStatement(stmt: string, line: number, ctx: DotContext, parentGroup?: Group): void {
  const trimmed = stmt.replace(/;$/, '').trim();
  const dotId = extractNodeId(trimmed);
  if (!dotId) {
    ctx.errors.push({ message: `Could not parse DOT statement: "${trimmed.split('\n')[0]}"`, line });
    return;
  }

  // Unquoted keywords are never node ids
  if (!dotId.quoted && DOT_KEYWORDS.has(dotId.raw.toLowerCase())) return;

  const rest = trimmed.slice(dotId.length).trim();
  if (rest.length > 0 && !rest.startsWith('[')) {
    ctx.errors.push({ message: `Unexpected "${rest.split('\n')[0]}" after node "${dotId.raw}"`, line });
    return;
  }

  const id = ctx.nodes.resolve(dotId.raw);
  applyInlineAttrs(rest, id, ctx.nodes);

  if (parentGroup && !parentGroup.members.includes(id)) {
    parentGroup.members.push(id);
  }
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

export function parseDot(input: string): ParseResult {
  const errors: ParseError[] = [];
  const nodes = new NodeRegistry();
  const edges: Edge[] = [];
  const groups: Group[] = [];
  const styles: Style[] = [];
  let direction: Direction | undefined;

  // Strip comments
  const cleaned = stripComments(input);

  // Match graph header: [strict] (digraph|graph) [name] { body }
  const headerMatch = cleaned.match(
    /^\s*(?:strict\s+)?(digraph|graph)\s*(?:"[^"]*"|[A-Za-z_][A-Za-z0-9_]*)?\s*\{([\s\S]*)\}\s*$/i
  );

  if (!headerMatch) {
    errors.push({ message: 'Expected digraph or graph declaration', line: 1 });
    return { graph: { nodes: [], edges: [], groups: [], positions: [], styles: [] }, errors };
  }

  const isDirected = headerMatch[1].toLowerCase() === 'digraph';
  const body = headerMatch[2];
  const bodyStart = cleaned.indexOf('{') + 1;
  const bodyLine = 1 + (cleaned.slice(0, bodyStart).match(/\n/g) ?? []).length;

  const ctx: DotContext = { nodes, edges, groups, isDirected, errors };

  for (const stmt of tokenizeStatements(body, bodyLine)) {
    // Graph-level attributes: rankdir, label, etc.
    const graphAttrMatch = stmt.text.match(/^(rankdir)\s*=\s*"?([^";]*)"?\s*$/i);
    if (graphAttrMatch) {
      const value = graphAttrMatch[2].trim().toUpperCase();
      const dirMap: Record<string, Direction> = { LR: 'LR', RL: 'RL', TB: 'TB', BT: 'BT' };
      if (dirMap[value]) direction = dirMap[value];
      continue;
    }

    parseStatement(stmt, ctx);
  }

  const graph: Graph = {
    nodes: nodes.toArray(),
    edges,
    groups,
    positions: [],
    styles,
  };
  if (direction) graph.direction = direction;

  return { graph, errors };
}
