import type { Graph, Node, Edge, Group, Style, Direction, Shape, EdgeOp } from './types.js';

function flattenGroups(groups: Group[]): Group[] {
  const result: Group[] = [];
  for (const group of groups) {
    result.push(group);
    if (group.children) result.push(...flattenGroups(group.children));
  }
  return result;
}

const DIRECTION_MAP: Record<Direction, string> = {
  LR: 'LR',
  TB: 'TD',
  RL: 'RL',
  BT: 'BT',
};

const EDGE_MAP: Record<EdgeOp, string> = {
  '>': '-->',
  '~': '-.->',
  '=': '==>',
  '--': '---',
  '<>': '<-->',
};

const GLYPHO_SHAPE_CLASS_PREFIX = 'glypho_shape_';

function escapeLabel(label: string): string {
  return label
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br/>')
    .replace(/#/g, '&#35;');
}

function nodeShape(node: Node, mermaidId: string): string {
  const label = node.label ? escapeLabel(node.label) : node.id;
  const shape: Shape = node.shape ?? 'r';

  switch (shape) {
    case 'r': return `${mermaidId}["${label}"]`;
    case 'd': return `${mermaidId}{"${label}"}`;
    case 'c': return `${mermaidId}(("${label}"))`;
    case 'o': return `${mermaidId}(["${label}"])`;
    case 'p': return `${mermaidId}("${label}")`;
    case 'h': return `${mermaidId}{{"${label}"}}`;
    default: return `${mermaidId}["${label}"]`;
  }
}

function edgeArrow(op: EdgeOp): string {
  return EDGE_MAP[op];
}

// Mermaid reserved keywords that cannot be used as bare node IDs
const MERMAID_RESERVED = new Set([
  'end', 'subgraph', 'graph', 'flowchart', 'direction', 'click', 'style', 'classDef', 'class', 'linkStyle',
]);

export function graphToMermaid(graph: Graph): string {
  const lines: string[] = [];
  const direction = graph.direction ? DIRECTION_MAP[graph.direction] : 'TD';
  lines.push(`flowchart ${direction}`);

  // Build a set of node IDs for collision detection with group IDs
  const nodeIdSet = new Set(graph.nodes.map(n => n.id));

  // Build rename map: node IDs that clash with Mermaid keywords or group IDs
  const allGroups = flattenGroups(graph.groups);
  const groupIdSet = new Set(allGroups.map(g => g.id));
  const renameMap = new Map<string, string>();
  for (const node of graph.nodes) {
    if (MERMAID_RESERVED.has(node.id)) {
      renameMap.set(node.id, `_${node.id}`);
    }
  }
  for (const group of allGroups) {
    if (MERMAID_RESERVED.has(group.id)) {
      renameMap.set(`group:${group.id}`, `_${group.id}`);
    }
    // If group ID collides with a node ID, prefix the subgraph ID
    if (nodeIdSet.has(group.id)) {
      renameMap.set(`group:${group.id}`, `grp_${group.id}`);
    }
  }

  const nodeId = (id: string) => renameMap.get(id) ?? id;
  const subgraphId = (id: string) => renameMap.get(`group:${id}`) ?? id;
  const classMembers = new Map<string, string[]>();
  for (const node of graph.nodes) {
    for (const className of node.classes ?? []) {
      if (!classMembers.has(className)) classMembers.set(className, []);
      classMembers.get(className)!.push(nodeId(node.id));
    }
  }

  // Collect which nodes are referenced in edges
  const edgeNodeIds = new Set<string>();
  for (const edge of graph.edges) {
    edgeNodeIds.add(edge.from);
    edgeNodeIds.add(edge.to);
  }

  // Collect which nodes are in groups (including nested)
  const groupedNodeIds = new Set<string>();
  for (const group of flattenGroups(graph.groups)) {
    for (const member of group.members) {
      groupedNodeIds.add(member);
    }
  }

  // Emit standalone node declarations for nodes that have shape/label/color
  // or are not referenced in any edge
  const declaredNodes = new Set<string>();
  for (const node of graph.nodes) {
    const hasDecoration = node.shape || node.label || node.color;
    const inEdge = edgeNodeIds.has(node.id);
    if (hasDecoration || !inEdge) {
      lines.push(`    ${nodeShape(node, nodeId(node.id))}`);
      declaredNodes.add(node.id);
    }
  }

  // Emit edges
  for (const edge of graph.edges) {
    const arrow = edgeArrow(edge.op);
    const from = nodeId(edge.from);
    const to = nodeId(edge.to);
    if (edge.label) {
      const label = escapeLabel(edge.label);
      lines.push(`    ${from} ${arrow}|"${label}"| ${to}`);
    } else {
      lines.push(`    ${from} ${arrow} ${to}`);
    }
  }

  // Emit groups as subgraphs (recursive for nested groups)
  function emitGroup(group: Group, indent: string): void {
    const sgId = subgraphId(group.id);
    const label = group.label ? ` ["${escapeLabel(group.label)}"]` : ` [${group.id}]`;
    lines.push(`${indent}subgraph ${sgId}${label}`);
    for (const member of group.members) {
      lines.push(`${indent}    ${nodeId(member)}`);
    }
    if (group.children) {
      for (const child of group.children) {
        emitGroup(child, indent + '    ');
      }
    }
    lines.push(`${indent}end`);
  }
  for (const group of graph.groups) {
    emitGroup(group, '    ');
  }

  // Emit node color styles
  for (const node of graph.nodes) {
    if (node.color) {
      lines.push(`    style ${nodeId(node.id)} fill:${node.color}`);
    }
  }

  // Emit style selectors
  const nodesByShape = new Map<string, string[]>();
  for (const node of graph.nodes) {
    if (node.shape) {
      const key = `:${node.shape}`;
      if (!nodesByShape.has(key)) nodesByShape.set(key, []);
      nodesByShape.get(key)!.push(nodeId(node.id));
    }
  }

  for (const style of graph.styles) {
    if (style.selector.startsWith(':')) {
      // Shape selector → classDef
      const className = `${GLYPHO_SHAPE_CLASS_PREFIX}${style.selector.slice(1)}`;
      const props = Object.entries(style.properties).map(([k, v]) => `${k}:${v}`).join(',');
      lines.push(`    classDef ${className} ${props}`);
      const members = nodesByShape.get(style.selector);
      if (members && members.length > 0) {
        lines.push(`    class ${members.join(',')} ${className}`);
      }
    } else if (style.selector.startsWith('#')) {
      // ID selector → style directive
      const nId = nodeId(style.selector.slice(1));
      const props = Object.entries(style.properties).map(([k, v]) => `${k}:${v}`).join(',');
      lines.push(`    style ${nId} ${props}`);
    } else if (style.selector.startsWith('.')) {
      // Class selector → classDef
      const className = style.selector.slice(1);
      const props = Object.entries(style.properties).map(([k, v]) => `${k}:${v}`).join(',');
      lines.push(`    classDef ${className} ${props}`);
    }
  }

  for (const [className, members] of classMembers) {
    if (members.length > 0) {
      lines.push(`    class ${members.join(',')} ${className}`);
    }
  }

  return lines.join('\n');
}
