import type { Graph, Group } from './types.js';

function needsQuotes(s: string): boolean {
  // Quote anything that isn't a simple bare identifier (alphanumeric/underscore/hyphen)
  return !/^[A-Za-z0-9_-]+$/.test(s) || s.includes('--');
}

function quoteLabel(s: string): string {
  if (s.includes('\n')) {
    return '"""' + s + '"""';
  }
  if (needsQuotes(s)) {
    return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  }
  return s;
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
    if (node.color) {
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
    if (edge.color) {
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
      .map(([k, v]) => `${k}:${v}`)
      .join(' ');
    lines.push('$' + style.selector + '{' + props + '}');
  }

  return lines.join('\n');
}
