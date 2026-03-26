import type {
  Graph, Node, Edge, Group, Style, Direction, Shape, EdgeOp,
  ParseError, ParseResult,
} from './types.js';

// ---------------------------------------------------------------------------
// Direction mapping (Mermaid → Glyph)
// ---------------------------------------------------------------------------

const DIRECTION_MAP: Record<string, Direction> = {
  LR: 'LR',
  RL: 'RL',
  TB: 'TB',
  TD: 'TB',
  BT: 'BT',
};

// ---------------------------------------------------------------------------
// Shape detection: ordered longest-delimiter-first so greedy matching works
// ---------------------------------------------------------------------------

interface ShapeMatch {
  open: string;
  close: string;
  shape: Shape;
}

const SHAPE_PATTERNS: ShapeMatch[] = [
  { open: '(("', close: '"))',  shape: 'c' },  // circle (quoted)
  { open: '((',  close: '))',   shape: 'c' },  // circle
  { open: '(["', close: '"])', shape: 'o' },  // oval/stadium (quoted)
  { open: '([',  close: '])',  shape: 'o' },  // oval/stadium
  { open: '{{"', close: '"}}', shape: 'h' },  // hexagon (quoted)
  { open: '{{',  close: '}}',  shape: 'h' },  // hexagon
  { open: '{"',  close: '"}',  shape: 'd' },  // diamond (quoted)
  { open: '{',   close: '}',   shape: 'd' },  // diamond
  { open: '("',  close: '")',  shape: 'p' },  // pill/rounded (quoted)
  { open: '(',   close: ')',   shape: 'p' },  // pill/rounded
  { open: '["',  close: '"]',  shape: 'r' },  // rect (quoted)
  { open: '[',   close: ']',   shape: 'r' },  // rect
];

// ---------------------------------------------------------------------------
// Edge patterns: ordered longest-first for correct matching
// ---------------------------------------------------------------------------

interface EdgePattern {
  token: string;
  op: EdgeOp;
}

const EDGE_PATTERNS: EdgePattern[] = [
  { token: '<-->', op: '<>' },
  { token: '-.->', op: '~' },
  { token: '==>', op: '=' },
  { token: '---', op: '--' },
  { token: '-->', op: '>' },
];

const GLYPHO_SHAPE_CLASS_PREFIX = 'glypho_shape_';

// ---------------------------------------------------------------------------
// Helper: split input into logical lines (newlines + semicolons)
// ---------------------------------------------------------------------------

function splitLines(input: string): { text: string; originalLine: number }[] {
  const rawLines = input.split('\n');
  const result: { text: string; originalLine: number }[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    // Split on semicolons, but respect quoted strings and bracket delimiters
    const parts = splitOnSemicolons(line);
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.length > 0) {
        result.push({ text: trimmed, originalLine: i + 1 });
      }
    }
  }

  return result;
}

/** Split on semicolons that are outside of quotes and bracket delimiters */
function splitOnSemicolons(line: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inQuotes = false;
  let depth = 0; // track [, (, {

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && !inQuotes) { inQuotes = true; current += ch; continue; }
    if (ch === '"' && inQuotes) { inQuotes = false; current += ch; continue; }
    if (inQuotes) { current += ch; continue; }
    if (ch === '[' || ch === '(' || ch === '{') depth++;
    if (ch === ']' || ch === ')' || ch === '}') depth--;
    if (ch === ';' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  parts.push(current);
  return parts;
}

// ---------------------------------------------------------------------------
// Helper: strip %% comments from a line
// ---------------------------------------------------------------------------

function stripComment(text: string): string {
  // Find %% that's outside of quoted strings and bracket delimiters
  let inQuotes = false;
  let depth = 0;
  for (let i = 0; i < text.length - 1; i++) {
    const ch = text[i];
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (inQuotes) continue;
    if (ch === '[' || ch === '(' || ch === '{') depth++;
    if (ch === ']' || ch === ')' || ch === '}') depth--;
    if (ch === '%' && text[i + 1] === '%' && depth === 0) {
      return text.slice(0, i).trim();
    }
  }
  return text;
}

// ---------------------------------------------------------------------------
// Helper: parse a node expression (e.g. `A["label"]`, `B`, `C(("x"))`)
// Returns the node id plus optional shape/label, and the number of
// characters consumed from `text`.
// ---------------------------------------------------------------------------

interface NodeParseResult {
  id: string;
  shape?: Shape;
  label?: string;
  consumed: number;
}

function parseNodeExpr(text: string): NodeParseResult | null {
  // Leading whitespace
  const leading = text.match(/^\s*/);
  const offset = leading ? leading[0].length : 0;
  const rest = text.slice(offset);

  if (rest.length === 0) return null;

  // Node id: alphanumeric, underscore, hyphen
  const idMatch = rest.match(/^[A-Za-z_][A-Za-z0-9_-]*/);
  if (!idMatch) return null;

  const id = idMatch[0];
  const afterId = rest.slice(id.length);

  // Try each shape pattern
  for (const sp of SHAPE_PATTERNS) {
    if (afterId.startsWith(sp.open)) {
      const closeIdx = findClosingDelimiter(afterId, sp.open, sp.close);
      if (closeIdx !== -1) {
        const labelRaw = afterId.slice(sp.open.length, closeIdx);
        // Unescape &quot; → " and <br/> → \n
        const label = unescapeLabel(labelRaw);
        const consumed = offset + id.length + closeIdx + sp.close.length;
        return { id, shape: sp.shape, label, consumed };
      }
    }
  }

  // Bare node (no shape delimiters)
  return { id, consumed: offset + id.length };
}

// ---------------------------------------------------------------------------
// Helper: find closing delimiter, handling nested brackets in unquoted labels
// ---------------------------------------------------------------------------

function findClosingDelimiter(text: string, open: string, close: string): number {
  // For quoted delimiters (open ends with "), the label is quote-bounded
  // so a simple indexOf is safe — the closing quote+bracket is unambiguous
  if (open.endsWith('"')) {
    return text.indexOf(close, open.length);
  }

  // For unquoted delimiters, track nesting depth of the same bracket type
  const openChar = open[open.length - 1];  // last char: [, (, or {
  const closeChar = close[0];              // first char: ], ), or }
  let depth = 1;
  let i = open.length;

  while (i < text.length) {
    // Check for the full close sequence first
    if (depth === 1 && text.slice(i, i + close.length) === close) {
      return i;
    }
    if (text[i] === openChar) depth++;
    else if (text[i] === closeChar) depth--;
    i++;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// Helper: unescape Mermaid label entities
// ---------------------------------------------------------------------------

function unescapeLabel(raw: string): string {
  return raw
    .replace(/&quot;/g, '"')
    .replace(/<br\s*\/?>/gi, '\n');
}

// ---------------------------------------------------------------------------
// Helper: find the next edge operator in `text` starting at `start`.
// Returns the operator info and its position, or null.
// ---------------------------------------------------------------------------

interface EdgeFind {
  op: EdgeOp;
  token: string;
  index: number;
  label?: string;
  /** Total characters consumed by the edge token + optional label portion */
  totalLength: number;
}

/** Build a bitmask of positions inside bracket/quote delimiters */
function buildDelimiterMask(text: string): Uint8Array {
  const mask = new Uint8Array(text.length);
  let inQuotes = false;
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') { inQuotes = !inQuotes; }
    if (!inQuotes) {
      if (ch === '[' || ch === '(' || ch === '{') depth++;
      if (ch === ']' || ch === ')' || ch === '}') depth--;
    }
    if (inQuotes || depth > 0) mask[i] = 1;
  }
  return mask;
}

function findNextEdge(text: string, start: number, delimiterMask?: Uint8Array): EdgeFind | null {
  let best: EdgeFind | null = null;

  for (const ep of EDGE_PATTERNS) {
    let searchFrom = start;
    while (searchFrom < text.length) {
      const idx = text.indexOf(ep.token, searchFrom);
      if (idx === -1) break;
      // Skip if inside a delimiter (when mask is provided)
      if (delimiterMask && delimiterMask[idx]) {
        searchFrom = idx + 1;
        continue;
      }
      if (best === null || idx < best.index) {
        best = { op: ep.op, token: ep.token, index: idx, totalLength: ep.token.length };
      }
      break;
    }
  }

  if (!best) return null;

  // Check for |"label"| or |label| after the edge token
  const afterToken = text.slice(best.index + best.token.length);
  const labelMatch = afterToken.match(/^\|"([^"]*)"\|/) || afterToken.match(/^\|([^|]*)\|/);
  if (labelMatch) {
    best.label = unescapeLabel(labelMatch[1]);
    best.totalLength = best.token.length + labelMatch[0].length;
  }

  return best;
}

// ---------------------------------------------------------------------------
// Helper: parse style properties string like "fill:#fff,stroke:#333"
// ---------------------------------------------------------------------------

function parseStyleProps(propsStr: string): Record<string, string> {
  const result: Record<string, string> = {};
  const parts = propsStr.split(',');
  for (const part of parts) {
    const trimmed = part.trim();
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx > 0) {
      const key = trimmed.slice(0, colonIdx).trim();
      const value = trimmed.slice(colonIdx + 1).trim();
      if (key && value) {
        result[key] = value;
      }
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Node registry: ensure each node is recorded once, but allow updates
// ---------------------------------------------------------------------------

class NodeRegistry {
  private map = new Map<string, Node>();
  private order: string[] = [];

  /** Register or update a node. Shape/label are set only on first definition. */
  ensure(id: string, shape?: Shape, label?: string, line?: number): void {
    if (this.map.has(id)) {
      // Update shape/label if not yet set
      const existing = this.map.get(id)!;
      if (shape && !existing.shape) existing.shape = shape;
      if (label && !existing.label) existing.label = label;
    } else {
      const node: Node = { id };
      if (shape) node.shape = shape;
      if (label) node.label = label;
      if (line !== undefined) node.line = line;
      this.map.set(id, node);
      this.order.push(id);
    }
  }

  get(id: string): Node | undefined {
    return this.map.get(id);
  }

  has(id: string): boolean {
    return this.map.has(id);
  }

  addClass(id: string, className: string, line?: number): void {
    this.ensure(id, undefined, undefined, line);
    const node = this.map.get(id)!;
    if (!node.classes) {
      node.classes = [className];
      return;
    }
    if (!node.classes.includes(className)) {
      node.classes.push(className);
    }
  }

  toArray(): Node[] {
    return this.order.map(id => this.map.get(id)!);
  }
}

function shapeSelectorFromClassName(className: string): string | null {
  if (!className.startsWith(GLYPHO_SHAPE_CLASS_PREFIX)) return null;
  const shape = className.slice(GLYPHO_SHAPE_CLASS_PREFIX.length);
  if (shape === 'r' || shape === 'd' || shape === 'c' || shape === 'o' || shape === 'p' || shape === 'h') {
    return `:${shape}`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

export function parseMermaid(input: string): ParseResult {
  const errors: ParseError[] = [];
  const nodes = new NodeRegistry();
  const edges: Edge[] = [];
  const groups: Group[] = [];
  const styles: Style[] = [];
  let direction: Direction | undefined;

  // Group nesting stack
  const groupStack: Group[] = [];

  const lines = splitLines(input);
  let headerParsed = false;

  for (const { text: rawText, originalLine } of lines) {
    const text = stripComment(rawText);
    if (text.length === 0) continue;

    // -----------------------------------------------------------------------
    // 1. Header: flowchart / graph directive
    // -----------------------------------------------------------------------
    if (!headerParsed) {
      const headerMatch = text.match(/^(?:flowchart|graph)\s+(LR|RL|TB|TD|BT)\s*$/i);
      if (headerMatch) {
        direction = DIRECTION_MAP[headerMatch[1].toUpperCase()];
        headerParsed = true;
        continue;
      }
      // Allow the header to also be bare "flowchart" or "graph" without direction
      const bareHeader = text.match(/^(?:flowchart|graph)\s*$/i);
      if (bareHeader) {
        headerParsed = true;
        continue;
      }
      // If first non-empty line isn't a header, record error but continue
      errors.push({
        message: `Expected flowchart/graph header, got: "${text}"`,
        line: originalLine,
      });
      headerParsed = true;
      // Fall through to try parsing this line as content
    }

    // -----------------------------------------------------------------------
    // 2. Subgraph
    // -----------------------------------------------------------------------
    const subgraphMatch = text.match(
      /^subgraph\s+([A-Za-z_][A-Za-z0-9_-]*)(?:\s+\["([^"]*)"\]|\s+\[([^\]]*)\])?\s*$/
    );
    if (subgraphMatch) {
      const id = subgraphMatch[1];
      const label = subgraphMatch[2] ?? subgraphMatch[3] ?? undefined;
      const group: Group = { id, members: [], line: originalLine };
      if (label) group.label = label;
      groupStack.push(group);
      continue;
    }

    // Also handle `subgraph name` with no bracket label (name is used as label)
    const subgraphBareMatch = text.match(
      /^subgraph\s+([A-Za-z_][A-Za-z0-9_-]*)\s*$/
    );
    if (subgraphBareMatch && !subgraphMatch) {
      const id = subgraphBareMatch[1];
      const group: Group = { id, members: [], line: originalLine };
      groupStack.push(group);
      continue;
    }

    // -----------------------------------------------------------------------
    // 3. End (close subgraph)
    // -----------------------------------------------------------------------
    if (/^end\s*$/i.test(text)) {
      if (groupStack.length > 0) {
        const completed = groupStack.pop()!;
        if (groupStack.length > 0) {
          // Nested: push as child of parent group
          const parent = groupStack[groupStack.length - 1];
          if (!parent.children) parent.children = [];
          parent.children.push(completed);
        } else {
          groups.push(completed);
        }
      } else {
        errors.push({ message: 'Unexpected "end" without matching subgraph', line: originalLine });
      }
      continue;
    }

    // -----------------------------------------------------------------------
    // 4. Nested direction directive
    // -----------------------------------------------------------------------
    const directionDirectiveMatch = text.match(/^direction\s+(LR|RL|TB|TD|BT)\s*$/i);
    if (directionDirectiveMatch) {
      errors.push({
        message: groupStack.length > 0
          ? 'Subgraph direction directives are not supported'
          : 'Unexpected direction directive after flowchart header',
        line: originalLine,
      });
      continue;
    }

    // -----------------------------------------------------------------------
    // 5. Style directive: style <nodeId> <props>
    // -----------------------------------------------------------------------
    const styleMatch = text.match(/^style\s+([A-Za-z_][A-Za-z0-9_-]*)\s+(.+)$/);
    if (styleMatch) {
      const nodeId = styleMatch[1];
      const props = parseStyleProps(styleMatch[2]);
      // If the only property is "fill", apply as node color
      const propKeys = Object.keys(props);
      if (propKeys.length === 1 && propKeys[0] === 'fill') {
        nodes.ensure(nodeId, undefined, undefined, originalLine);
        const node = nodes.get(nodeId);
        if (node) node.color = props['fill'];
      } else {
        styles.push({
          selector: `#${nodeId}`,
          properties: props,
          line: originalLine,
        });
      }
      continue;
    }

    // -----------------------------------------------------------------------
    // 6. classDef directive: classDef <name> <props>
    // -----------------------------------------------------------------------
    const classDefMatch = text.match(/^classDef\s+([A-Za-z_][A-Za-z0-9_-]*)\s+(.+)$/);
    if (classDefMatch) {
      const className = classDefMatch[1];
      const props = parseStyleProps(classDefMatch[2]);
      const selector = shapeSelectorFromClassName(className) ?? `.${className}`;
      styles.push({
        selector,
        properties: props,
        line: originalLine,
      });
      continue;
    }

    // -----------------------------------------------------------------------
    // 7. class directive: class A,B <name>
    // -----------------------------------------------------------------------
    const classMatch = text.match(
      /^class\s+([A-Za-z_][A-Za-z0-9_-]*(?:\s*,\s*[A-Za-z_][A-Za-z0-9_-]*)*)\s+([A-Za-z_][A-Za-z0-9_-]*(?:\s*,\s*[A-Za-z_][A-Za-z0-9_-]*)*)\s*$/
    );
    if (classMatch) {
      const nodeIds = classMatch[1].split(/\s*,\s*/);
      const classNames = classMatch[2].split(/\s*,\s*/);
      for (const nodeId of nodeIds) {
        nodes.ensure(nodeId, undefined, undefined, originalLine);
        for (const className of classNames) {
          if (shapeSelectorFromClassName(className)) continue;
          nodes.addClass(nodeId, className, originalLine);
        }
      }
      continue;
    }

    // -----------------------------------------------------------------------
    // 8. Edge line or standalone node definition
    // -----------------------------------------------------------------------
    const mask = buildDelimiterMask(text);
    const firstEdge = findNextEdge(text, 0, mask);

    if (firstEdge) {
      parseEdgeLine(text, originalLine, nodes, edges, groupStack, errors);
    } else {
      // Standalone node definition
      parseStandaloneNode(text, originalLine, nodes, groupStack, errors);
    }
  }

  // Close any unclosed subgraphs
  while (groupStack.length > 0) {
    const unclosed = groupStack.pop()!;
    errors.push({
      message: `Subgraph "${unclosed.id}" was never closed with "end"`,
      line: unclosed.line ?? 0,
    });
    if (groupStack.length > 0) {
      const parent = groupStack[groupStack.length - 1];
      if (!parent.children) parent.children = [];
      parent.children.push(unclosed);
    } else {
      groups.push(unclosed);
    }
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

// ---------------------------------------------------------------------------
// Parse an edge line (may be a chain: A --> B --> C)
// ---------------------------------------------------------------------------

function parseEdgeLine(
  text: string,
  line: number,
  nodes: NodeRegistry,
  edges: Edge[],
  groupStack: Group[],
  errors: ParseError[],
): void {
  // Walk the line once and carry the previous target node forward as the next
  // edge source. This keeps long chains linear instead of rebuilding the
  // remaining text for every hop.
  const mask = buildDelimiterMask(text);
  let cursor = 0;

  const sourceResult = parseNodeExpr(text);
  if (!sourceResult) {
    errors.push({
      message: `Unexpected token near position ${cursor}: "${text.slice(cursor, cursor + 10)}"`,
      line,
      column: cursor + 1,
    });
    return;
  }

  let sourceNode = sourceResult;
  nodes.ensure(sourceNode.id, sourceNode.shape, sourceNode.label, line);
  addNodeToCurrentGroup(groupStack, sourceNode.id);
  cursor += sourceNode.consumed;

  while (cursor < text.length) {
    while (cursor < text.length && /\s/.test(text[cursor])) cursor++;
    if (cursor >= text.length) return;

    const edgeFind = findNextEdge(text, cursor, mask);
    if (!edgeFind || edgeFind.index !== cursor) {
      errors.push({
        message: `Unexpected token near position ${cursor}: "${text.slice(cursor, cursor + 10)}"`,
        line,
        column: cursor + 1,
      });
      return;
    }

    cursor = edgeFind.index + edgeFind.totalLength;
    while (cursor < text.length && /\s/.test(text[cursor])) cursor++;

    const targetResult = parseNodeExpr(text.slice(cursor));
    if (!targetResult) {
      errors.push({
        message: `Expected node after edge operator "${edgeFind.token}"`,
        line,
        column: cursor + 1,
      });
      return;
    }

    nodes.ensure(targetResult.id, targetResult.shape, targetResult.label, line);
    addNodeToCurrentGroup(groupStack, targetResult.id);

    const edge: Edge = {
      from: sourceNode.id,
      to: targetResult.id,
      op: edgeFind.op,
      line,
    };
    if (edgeFind.label) edge.label = edgeFind.label;
    edges.push(edge);

    cursor += targetResult.consumed;
    sourceNode = targetResult;
  }
}

function addNodeToCurrentGroup(groupStack: Group[], nodeId: string): void {
  if (groupStack.length === 0) return;
  const currentGroup = groupStack[groupStack.length - 1];
  if (!currentGroup.members.includes(nodeId)) {
    currentGroup.members.push(nodeId);
  }
}

// ---------------------------------------------------------------------------
// Parse a standalone node definition (no edges on this line)
// ---------------------------------------------------------------------------

function parseStandaloneNode(
  text: string,
  line: number,
  nodes: NodeRegistry,
  groupStack: Group[],
  errors: ParseError[],
): void {
  const result = parseNodeExpr(text);
  if (!result) {
    errors.push({
      message: `Could not parse node definition: "${text}"`,
      line,
    });
    return;
  }

  nodes.ensure(result.id, result.shape, result.label, line);

  // Add to current subgraph
  addNodeToCurrentGroup(groupStack, result.id);
}
