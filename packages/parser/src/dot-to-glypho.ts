import type {
  Graph, Node, Edge, Group, Style, Direction, Shape, EdgeOp,
  ParseError, ParseResult,
} from './types.js';

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
    return this.order.map(id => this.map.get(id)!);
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

  if (attrs.fillcolor) {
    color = attrs.fillcolor;
  } else if (attrs.color && attrs.style?.includes('filled')) {
    color = attrs.color;
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
  let result = input.replace(/\/\*[\s\S]*?\*\//g, '');
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

function tokenizeStatements(body: string): string[] {
  const statements: string[] = [];
  let current = '';
  let depth = 0;
  let inQuotes = false;

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];

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
      continue;
    }

    if (depth === 0 && (ch === ';' || ch === '\n')) {
      const trimmed = current.trim();
      if (trimmed.length > 0) {
        statements.push(trimmed);
      }
      current = '';
      continue;
    }

    current += ch;
  }

  const trimmed = current.trim();
  if (trimmed.length > 0) {
    statements.push(trimmed);
  }

  return statements;
}

// ---------------------------------------------------------------------------
// Parse a subgraph block
// ---------------------------------------------------------------------------

function parseSubgraph(
  stmt: string,
  nodes: NodeRegistry,
  edges: Edge[],
  groups: Group[],
  styles: Style[],
  isDirected: boolean,
  errors: ParseError[],
  parentGroup?: Group,
): void {
  // Match: subgraph cluster_name { ... }
  const match = stmt.match(/^subgraph\s+(\S+)\s*\{([\s\S]*)\}\s*$/);
  if (!match) return;

  const rawId = match[1];
  const body = match[2];

  // Strip cluster_ prefix for group ID
  const id = rawId.startsWith('cluster_') ? rawId.slice(8) : rawId;

  const group: Group = { id, members: [] };

  // Parse inner statements
  const innerStatements = tokenizeStatements(body);
  let label: string | undefined;

  for (const inner of innerStatements) {
    // Check for label attribute
    const labelMatch = inner.match(/^label\s*=\s*"([^"]*)"\s*$/);
    if (labelMatch) {
      label = labelMatch[1];
      continue;
    }

    // Check for graph-level attrs like [label=...]
    if (inner.startsWith('graph ')) {
      continue;
    }

    // Parse as normal statement (nodes, edges)
    parseStatement(inner, nodes, edges, groups, styles, isDirected, errors, group);
  }

  if (label && label !== id) group.label = label;

  if (parentGroup) {
    if (!parentGroup.children) parentGroup.children = [];
    parentGroup.children.push(group);
  } else {
    groups.push(group);
  }
}

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

function parseStatement(
  stmt: string,
  nodes: NodeRegistry,
  edges: Edge[],
  groups: Group[],
  styles: Style[],
  isDirected: boolean,
  errors: ParseError[],
  parentGroup?: Group,
): void {
  const trimmed = stmt.trim();
  if (trimmed.length === 0) return;

  // Skip graph-level attributes
  if (/^(graph|node|edge)\s*\[/.test(trimmed)) return;

  // Subgraph
  if (trimmed.startsWith('subgraph ')) {
    parseSubgraph(trimmed, nodes, edges, groups, styles, isDirected, errors, parentGroup);
    return;
  }

  // Edge statement: look for -> or -- outside of quoted strings and brackets
  const edgeOp = isDirected ? '->' : '--';
  if (containsEdgeOp(trimmed, edgeOp)) {
    parseEdgeStatement(trimmed, edgeOp, nodes, edges, isDirected, parentGroup);
    return;
  }

  // Also check the other edge op in case of mixed usage
  const altOp = isDirected ? '--' : '->';
  if (containsEdgeOp(trimmed, altOp)) {
    parseEdgeStatement(trimmed, altOp, nodes, edges, isDirected, parentGroup);
    return;
  }

  // Node statement
  parseNodeStatement(trimmed, nodes, parentGroup);
}

// ---------------------------------------------------------------------------
// Parse an edge statement: a -> b -> c [attrs]
// ---------------------------------------------------------------------------

function parseEdgeStatement(
  stmt: string,
  edgeToken: string,
  nodes: NodeRegistry,
  edges: Edge[],
  isDirected: boolean,
  parentGroup?: Group,
): void {
  // Split on edge operator, but we need to handle trailing [attrs]
  // First, extract any trailing attribute block
  let mainPart = stmt;
  let edgeAttrs: Record<string, string> = {};

  // Find the last [ that's an attribute block (not inside a node id)
  const lastBracket = findTrailingAttrBlock(stmt);
  if (lastBracket !== -1) {
    const [attrs] = extractAttrBlock(stmt.slice(lastBracket));
    edgeAttrs = attrs;
    mainPart = stmt.slice(0, lastBracket).trim();
  }

  // Split on edge operator
  const parts = splitOnEdgeOp(mainPart, edgeToken);
  if (parts.length < 2) return;

  for (let i = 0; i < parts.length - 1; i++) {
    const fromId = extractNodeId(parts[i].trim());
    const toId = extractNodeId(parts[i + 1].trim());
    if (!fromId || !toId) continue;

    // Parse inline node attrs if present
    parseNodeInlineAttrs(parts[i].trim(), nodes);
    if (i === parts.length - 2) {
      parseNodeInlineAttrs(parts[i + 1].trim(), nodes);
    }

    // Ensure nodes exist
    nodes.ensure(fromId);
    nodes.ensure(toId);

    // Add to parent group
    if (parentGroup) {
      if (!parentGroup.members.includes(fromId)) parentGroup.members.push(fromId);
      if (!parentGroup.members.includes(toId)) parentGroup.members.push(toId);
    }

    const op = edgeOpFromAttrs(edgeAttrs, isDirected || edgeToken === '->');
    const edge: Edge = { from: fromId, to: toId, op };
    if (edgeAttrs.label) edge.label = edgeAttrs.label;
    if (edgeAttrs.color) edge.color = edgeAttrs.color;
    edges.push(edge);
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

  while (i < text.length) {
    if (text[i] === '[') bracketDepth++;
    else if (text[i] === ']') bracketDepth--;

    if (bracketDepth === 0 && text.slice(i, i + op.length) === op) {
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

function extractNodeId(text: string): string | null {
  const trimmed = text.trim();
  // Node id: leading identifier characters before any [ or whitespace
  const match = trimmed.match(/^"([^"]+)"|^([A-Za-z_][A-Za-z0-9_]*)/);
  if (!match) return null;
  return match[1] ?? match[2];
}

// ---------------------------------------------------------------------------
// Parse inline node attributes from edge statement parts
// ---------------------------------------------------------------------------

function parseNodeInlineAttrs(text: string, nodes: NodeRegistry): void {
  const trimmed = text.trim();
  const id = extractNodeId(trimmed);
  if (!id) return;

  const afterId = trimmed.slice(trimmed.indexOf(id) + id.length).trim();
  if (afterId.startsWith('[')) {
    const [attrs] = extractAttrBlock(afterId);
    applyNodeAttrs(nodes, id, attrs);
  }
}

// ---------------------------------------------------------------------------
// Parse a node statement: nodeId [attrs]
// ---------------------------------------------------------------------------

function parseNodeStatement(
  stmt: string,
  nodes: NodeRegistry,
  parentGroup?: Group,
): void {
  const trimmed = stmt.replace(/;$/, '').trim();
  const id = extractNodeId(trimmed);
  if (!id) return;

  // Skip DOT keywords
  if (['graph', 'node', 'edge', 'strict', 'subgraph'].includes(id)) return;

  const afterId = trimmed.slice(trimmed.indexOf(id) + id.length).trim();

  if (afterId.startsWith('[')) {
    const [attrs] = extractAttrBlock(afterId);
    applyNodeAttrs(nodes, id, attrs);
  } else {
    nodes.ensure(id);
  }

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
    /^\s*(?:strict\s+)?(digraph|graph)\s*(?:"[^"]*"|[A-Za-z_][A-Za-z0-9_]*)?\s*\{([\s\S]*)\}\s*$/
  );

  if (!headerMatch) {
    errors.push({ message: 'Expected digraph or graph declaration', line: 1 });
    return { graph: { nodes: [], edges: [], groups: [], positions: [], styles: [] }, errors };
  }

  const graphType = headerMatch[1];
  const isDirected = graphType === 'digraph';
  const body = headerMatch[2];

  // Parse body statements
  const statements = tokenizeStatements(body);

  for (const stmt of statements) {
    const trimmed = stmt.trim();
    if (trimmed.length === 0) continue;

    // Graph-level attributes: rankdir, label, etc.
    const graphAttrMatch = trimmed.match(/^(rankdir)\s*=\s*"?([^";]*)"?\s*$/i);
    if (graphAttrMatch) {
      const key = graphAttrMatch[1].toLowerCase();
      const value = graphAttrMatch[2].trim().toUpperCase();
      if (key === 'rankdir') {
        const dirMap: Record<string, Direction> = { LR: 'LR', RL: 'RL', TB: 'TB', BT: 'BT' };
        if (dirMap[value]) direction = dirMap[value];
      }
      continue;
    }

    parseStatement(trimmed, nodes, edges, groups, styles, isDirected, errors);
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
