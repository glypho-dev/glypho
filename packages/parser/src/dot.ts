import type { Graph, Group, Shape } from './types.js';

function flattenGroups(groups: Group[]): Group[] {
  const result: Group[] = [];
  for (const group of groups) {
    result.push(group);
    if (group.children) result.push(...flattenGroups(group.children));
  }
  return result;
}

const SHAPE_MAP: Record<Shape, { shape: string; style?: string }> = {
  r: { shape: 'box' },
  d: { shape: 'diamond' },
  c: { shape: 'circle' },
  o: { shape: 'ellipse' },
  p: { shape: 'box', style: 'rounded' },
  h: { shape: 'hexagon' },
};

export function graphToDot(graph: Graph): string {
  const hasDirected = graph.edges.some(e => e.op !== '--');
  const graphType = hasDirected ? 'digraph' : 'graph';
  const defaultOp = hasDirected ? '->' : '--';

  const lines: string[] = [];
  lines.push(`${graphType} {`);

  if (graph.direction) {
    lines.push(`    rankdir=${graph.direction};`);
  }

  // Collect grouped node IDs so we emit them inside subgraphs only
  const groupedNodes = new Set<string>();
  for (const group of flattenGroups(graph.groups)) {
    for (const member of group.members) {
      groupedNodes.add(member);
    }
  }

  // Emit groups as subgraphs (recursive for nested groups)
  function emitGroup(group: Group, indent: string): void {
    lines.push(`${indent}subgraph cluster_${group.id} {`);
    lines.push(`${indent}    label="${escapeLabel(group.label ?? group.id)}";`);
    for (const member of group.members) {
      const node = graph.nodes.find(n => n.id === member);
      if (node) {
        lines.push(`${indent}    ${formatNode(node)}`);
      }
    }
    if (group.children) {
      for (const child of group.children) {
        emitGroup(child, indent + '    ');
      }
    }
    lines.push(`${indent}}`);
  }
  for (const group of graph.groups) {
    emitGroup(group, '    ');
  }

  // Emit non-grouped nodes
  for (const node of graph.nodes) {
    if (!groupedNodes.has(node.id)) {
      lines.push(`    ${formatNode(node)}`);
    }
  }

  // Emit edges
  for (const edge of graph.edges) {
    const attrs: string[] = [];

    if (edge.op === '~') attrs.push('style=dashed');
    if (edge.op === '=') attrs.push('style=bold');
    if (edge.op === '<>') attrs.push('dir=both');
    if (edge.op === '--' && hasDirected) attrs.push('dir=none');
    if (edge.label) attrs.push(`label="${escapeLabel(edge.label)}"`);
    if (edge.color) attrs.push(`color="${edge.color}"`);

    // In a digraph, all edges must use -> (use dir=none for undirected)
    const op = hasDirected ? '->' : '--';
    const attrStr = attrs.length > 0 ? ` [${attrs.join(', ')}]` : '';
    lines.push(`    ${edge.from} ${op} ${edge.to}${attrStr};`);
  }

  lines.push('}');
  return lines.join('\n');
}

function escapeLabel(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function formatNode(node: { id: string; shape?: Shape; label?: string; color?: string }): string {
  const attrs: string[] = [];
  const label = node.label ?? node.id;
  attrs.push(`label="${escapeLabel(label)}"`);

  if (node.shape) {
    const mapped = SHAPE_MAP[node.shape];
    attrs.push(`shape=${mapped.shape}`);

    const styles: string[] = [];
    if (mapped.style) styles.push(mapped.style);
    if (node.color) styles.push('filled');
    if (styles.length > 0) {
      attrs.push(`style="${styles.join(',')}"`);
    }
  } else if (node.color) {
    attrs.push('style=filled');
  }

  if (node.color) {
    attrs.push(`fillcolor="${node.color}"`);
  }

  return `${node.id} [${attrs.join(', ')}];`;
}
