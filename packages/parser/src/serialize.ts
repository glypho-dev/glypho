import type { Graph, Group } from './types.js';

/**
 * A bare label must re-lex as exactly one ID or INTEGER token: `3D` would
 * split into INTEGER + ID, `_x` and `a-` hit lexer errors, `a--b` lexes an
 * edge operator.
 */
const BARE_LABEL = /^(?:[A-Za-z](?:[A-Za-z0-9_]|-(?=[A-Za-z0-9_]))*|[0-9]+)$/;

function needsQuotes(s: string): boolean {
  return !BARE_LABEL.test(s);
}

/** Regular double-quoted string with the escapes the lexer understands */
function escapeQuoted(s: string): string {
  return '"' + s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t') + '"';
}

function quoteLabel(raw: string): string {
  const s = raw.replace(/\r\n?/g, '\n');
  if (s.includes('\n')) {
    // Triple quotes read best, but they're literal: content can't contain the
    // closing delimiter or end in a quote (which would merge into it)
    if (!s.includes('"""') && !s.endsWith('"')) {
      return '"""' + s + '"""';
    }
    return escapeQuoted(s);
  }
  return needsQuotes(s) ? escapeQuoted(s) : s;
}

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Style values stay bare when they re-lex as one value token */
const BARE_STYLE_VALUE = /^[^\s>~=:@^#{}"]+$/;

function formatStyleValue(v: string): string {
  if (HEX_COLOR.test(v) || BARE_STYLE_VALUE.test(v)) return v;
  return escapeQuoted(v.replace(/\r\n?/g, '\n'));
}

function serializeGroup(group: Group, indent: number): string[] {
  const prefix = '  '.repeat(indent);
  const hasChildren = group.children && group.children.length > 0;
  const useMultiLine = hasChildren || group.members.length > 6;

  let header = prefix + '@' + group.id;
  if (group.label) {
    header += ' ' + quoteLabel(group.label);
  }

  if (!useMultiLine) {
    return [header + '{' + group.members.join(' ') + '}'];
  }

  const lines: string[] = [];
  lines.push(header + '{');
  const inner = '  '.repeat(indent + 1);
  for (const member of group.members) {
    lines.push(inner + member);
  }
  if (group.children) {
    for (const child of group.children) {
      lines.push(...serializeGroup(child, indent + 1));
    }
  }
  lines.push(prefix + '}');
  return lines;
}

export function graphToGlypho(graph: Graph): string {
  const lines: string[] = [];

  if (graph.direction) {
    lines.push(`>${graph.direction}`);
  }

  // Nodes
  for (const node of graph.nodes) {
    let line = node.id;
    const hasShape = node.shape != null;
    const hasLabel = node.label != null && node.label !== node.id;

    if (hasShape || hasLabel) {
      line += ':' + (node.shape ?? 'r');
      if (hasLabel) {
        line += ' ' + quoteLabel(node.label!);
      }
    }
    // Only hex colors are valid .g syntax; anything else would re-parse as a label
    if (node.color && HEX_COLOR.test(node.color)) {
      line += ' ' + node.color;
    }
    lines.push(line);
  }

  const membersByClass = new Map<string, string[]>();
  for (const node of graph.nodes) {
    for (const className of node.classes ?? []) {
      if (!membersByClass.has(className)) {
        membersByClass.set(className, []);
      }
      const members = membersByClass.get(className)!;
      if (!members.includes(node.id)) {
        members.push(node.id);
      }
    }
  }
  for (const [className, members] of membersByClass) {
    lines.push(`.${className}{${members.join(' ')}}`);
  }

  // Edges
  for (const edge of graph.edges) {
    let line = edge.from + edge.op + edge.to;
    if (edge.label) {
      line += ' ' + quoteLabel(edge.label);
    }
    if (edge.color && HEX_COLOR.test(edge.color)) {
      line += ' ' + edge.color;
    }
    lines.push(line);
  }

  // Groups
  for (const group of graph.groups) {
    lines.push(...serializeGroup(group, 0));
  }

  // Positions
  for (const pos of graph.positions) {
    let line = pos.id + '@' + pos.x + ',' + pos.y;
    if (pos.width != null && pos.height != null) {
      line += '^' + pos.width + 'x' + pos.height;
    }
    lines.push(line);
  }

  // Styles
  for (const style of graph.styles) {
    const props = Object.entries(style.properties)
      .map(([k, v]) => `${k}:${formatStyleValue(v)}`)
      .join(' ');
    lines.push('$' + style.selector + '{' + props + '}');
  }

  return lines.join('\n');
}
