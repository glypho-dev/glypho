import dagre from '@dagrejs/dagre';
import type { Graph, Group, Shape } from '@glypho/parser';
import { flattenGroups } from '@glypho/parser';
import { measureNode, measureText } from './sizing.js';
import type { LayoutResult, LayoutNode, LayoutEdge, LayoutGroup, Point } from './types.js';

const DEFAULT_NODE_SEP = 60;
const DEFAULT_RANK_SEP = 80;
const GROUP_PADDING = 24;
const GROUP_LABEL_HEIGHT = 24;
const EMPTY_GROUP_MIN_WIDTH = 96;
const EMPTY_GROUP_MIN_HEIGHT = GROUP_LABEL_HEIGHT + GROUP_PADDING * 2;

/**
 * Clip a ray from node center toward `target` so it stops at the actual
 * shape boundary (not just the rectangular bounding box).
 */
function clipToShapeBorder(
  center: Point,
  target: Point,
  node: { x: number; y: number; width: number; height: number },
  shape: Shape | undefined,
): Point {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  const dx = target.x - cx;
  const dy = target.y - cy;

  if (dx === 0 && dy === 0) return center;

  const hw = node.width / 2;
  const hh = node.height / 2;

  switch (shape) {
    case 'd': {
      // Diamond boundary: |x-cx|/hw + |y-cy|/hh = 1
      const t = 1 / (Math.abs(dx) / hw + Math.abs(dy) / hh);
      return { x: cx + t * dx, y: cy + t * dy };
    }

    case 'c': {
      // Circle: radius = min(hw, hh)
      const r = Math.min(hw, hh);
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist === 0) return center;
      const t = r / dist;
      return { x: cx + t * dx, y: cy + t * dy };
    }

    case 'o': {
      // Ellipse: (x/rx)^2 + (y/ry)^2 = 1
      const t = 1 / Math.sqrt((dx * dx) / (hw * hw) + (dy * dy) / (hh * hh));
      return { x: cx + t * dx, y: cy + t * dy };
    }

    case 'p': {
      // Pill: rectangle with semicircular caps of radius r = hh
      const r = hh;
      const flatHW = hw - r;

      if (flatHW <= 0) {
        // Degenerate: basically a circle
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist === 0) return center;
        return { x: cx + (r / dist) * dx, y: cy + (r / dist) * dy };
      }

      // Try flat top/bottom edges first
      if (dy !== 0) {
        const tEdge = (dy > 0 ? hh : -hh) / dy;
        if (tEdge > 0) {
          const hitX = cx + tEdge * dx;
          if (Math.abs(hitX - cx) <= flatHW) {
            return { x: hitX, y: cy + tEdge * dy };
          }
        }
      }

      // Hit a semicircular cap
      const capCX = dx > 0 ? cx + flatHW : cx - flatHW;
      const cdx = target.x - capCX;
      const cdy = target.y - cy;
      const cdist = Math.sqrt(cdx * cdx + cdy * cdy);
      if (cdist === 0) return { x: capCX + (dx > 0 ? r : -r), y: cy };
      return { x: capCX + (r / cdist) * cdx, y: cy + (r / cdist) * cdy };
    }

    case 'h': {
      // Hexagon: 6 vertices with 20% inset
      const inset = node.width * 0.2;
      const vertices: Point[] = [
        { x: node.x + inset, y: node.y },
        { x: node.x + node.width - inset, y: node.y },
        { x: node.x + node.width, y: cy },
        { x: node.x + node.width - inset, y: node.y + node.height },
        { x: node.x + inset, y: node.y + node.height },
        { x: node.x, y: cy },
      ];
      return clipToPolygon(cx, cy, dx, dy, vertices);
    }

    default: {
      // Rectangle (r or undefined)
      const sx = dx !== 0 ? hw / Math.abs(dx) : Infinity;
      const sy = dy !== 0 ? hh / Math.abs(dy) : Infinity;
      const s = Math.min(sx, sy);
      return { x: cx + dx * s, y: cy + dy * s };
    }
  }
}

function clipToPolygon(cx: number, cy: number, dx: number, dy: number, vertices: Point[]): Point {
  let minT = Infinity;
  for (let i = 0; i < vertices.length; i++) {
    const v1 = vertices[i];
    const v2 = vertices[(i + 1) % vertices.length];
    const t = raySegmentIntersection(cx, cy, dx, dy, v1, v2);
    if (t !== null && t > 0 && t < minT) {
      minT = t;
    }
  }
  if (minT === Infinity) return { x: cx, y: cy };
  return { x: cx + minT * dx, y: cy + minT * dy };
}

function raySegmentIntersection(
  ox: number, oy: number, dx: number, dy: number,
  p1: Point, p2: Point,
): number | null {
  const ex = p2.x - p1.x;
  const ey = p2.y - p1.y;
  const denom = dx * ey - dy * ex;
  if (Math.abs(denom) < 1e-10) return null;
  const t = ((p1.x - ox) * ey - (p1.y - oy) * ex) / denom;
  const s = ((p1.x - ox) * dy - (p1.y - oy) * dx) / denom;
  if (t > 0 && s >= 0 && s <= 1) return t;
  return null;
}

function computeGroupLayouts(
  groups: Group[],
  nodeMap: ReadonlyMap<string, LayoutNode>,
): LayoutGroup[] {
  const layoutGroups: LayoutGroup[] = [];

  function visitGroup(group: Group, depth: number): LayoutGroup {
    const childLayouts = (group.children ?? []).map(child => visitGroup(child, depth + 1));
    const memberNodes = group.members
      .map(id => nodeMap.get(id))
      .filter((node): node is LayoutNode => node != null);

    const contentMinX = Math.min(
      ...memberNodes.map(node => node.x),
      ...childLayouts.map(child => child.x),
    );
    const contentMinY = Math.min(
      ...memberNodes.map(node => node.y),
      ...childLayouts.map(child => child.y),
    );
    const contentMaxX = Math.max(
      ...memberNodes.map(node => node.x + node.width),
      ...childLayouts.map(child => child.x + child.width),
    );
    const contentMaxY = Math.max(
      ...memberNodes.map(node => node.y + node.height),
      ...childLayouts.map(child => child.y + child.height),
    );

    const hasContent = Number.isFinite(contentMinX) && Number.isFinite(contentMinY)
      && Number.isFinite(contentMaxX) && Number.isFinite(contentMaxY);

    let x: number;
    let y: number;
    let width: number;
    let height: number;

    if (hasContent) {
      x = contentMinX - GROUP_PADDING;
      y = contentMinY - GROUP_PADDING - GROUP_LABEL_HEIGHT;
      width = contentMaxX - contentMinX + GROUP_PADDING * 2;
      height = contentMaxY - contentMinY + GROUP_PADDING * 2 + GROUP_LABEL_HEIGHT;
    } else {
      const label = group.label ?? group.id;
      const { width: labelWidth } = measureText(label);
      width = Math.max(EMPTY_GROUP_MIN_WIDTH, labelWidth + GROUP_PADDING * 2);
      height = EMPTY_GROUP_MIN_HEIGHT;
      x = 0;
      y = 0;
    }

    const layoutGroup: LayoutGroup = { group, x, y, width, height, depth };
    layoutGroups.push(layoutGroup);
    return layoutGroup;
  }

  for (const group of groups) {
    visitGroup(group, 0);
  }

  layoutGroups.sort((a, b) => a.depth - b.depth);
  return layoutGroups;
}

function rectsOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
  padding = 0,
): boolean {
  return !(
    a.x + a.width + padding <= b.x
    || b.x + b.width + padding <= a.x
    || a.y + a.height + padding <= b.y
    || b.y + b.height + padding <= a.y
  );
}

function compactTerminalGroupMembers(
  graph: Graph,
  nodeMap: ReadonlyMap<string, LayoutNode>,
  explicitPositionIds: ReadonlySet<string>,
): Set<string> {
  const movedNodeIds = new Set<string>();
  const outgoingCounts = new Map<string, number>();

  for (const edge of graph.edges) {
    outgoingCounts.set(edge.from, (outgoingCounts.get(edge.from) ?? 0) + 1);
  }

  const direction = graph.direction ?? 'TB';
  const isHorizontal = direction === 'LR' || direction === 'RL';

  for (const group of flattenGroups(graph.groups)) {
    if (group.members.length < 2) continue;
    if (group.members.some(id => explicitPositionIds.has(id))) continue;

    const groupMemberIds = new Set(group.members);
    const members = group.members
      .map(id => nodeMap.get(id))
      .filter((node): node is LayoutNode => node != null);
    if (members.length < 2) continue;
    if (!members.every(node => (outgoingCounts.get(node.id) ?? 0) === 0)) continue;

    const crossPositions = members.map(node => isHorizontal ? node.x : node.y);
    const crossSpread = Math.max(...crossPositions) - Math.min(...crossPositions);
    if (crossSpread > DEFAULT_RANK_SEP) continue;

    const orderedMembers = [...members].sort((a, b) => {
      const primary = isHorizontal ? a.y - b.y : a.x - b.x;
      if (primary !== 0) return primary;
      return isHorizontal ? a.x - b.x : a.y - b.y;
    });

    const currentStart = Math.min(...orderedMembers.map(node => isHorizontal ? node.y : node.x));
    const currentEnd = Math.max(
      ...orderedMembers.map(node => isHorizontal ? node.y + node.height : node.x + node.width),
    );
    const desiredSpan = orderedMembers.reduce((sum, node, index) => (
      sum + (isHorizontal ? node.height : node.width) + (index > 0 ? DEFAULT_NODE_SEP : 0)
    ), 0);

    if (currentEnd - currentStart <= desiredSpan + 1) continue;

    const baseCross = crossPositions.reduce((sum, value) => sum + value, 0) / crossPositions.length;
    const crossStep = DEFAULT_RANK_SEP + Math.max(
      ...orderedMembers.map(node => isHorizontal ? node.width : node.height),
    );
    const crossDirection = direction === 'BT' || direction === 'RL' ? -1 : 1;
    const occupiedNodes = Array.from(nodeMap.values()).filter(node => !groupMemberIds.has(node.id));

    const findOpenCrossAxis = (): number => {
      for (let attempt = 0; attempt < 32; attempt++) {
        const candidateCross = baseCross + attempt * crossStep * crossDirection;
        const overlaps = orderedMembers.some((node, index) => {
          const main = currentStart + orderedMembers
            .slice(0, index)
            .reduce((sum, member) => (
              sum + (isHorizontal ? member.height : member.width) + DEFAULT_NODE_SEP
            ), 0);
          const candidateRect = {
            x: isHorizontal ? candidateCross : main,
            y: isHorizontal ? main : candidateCross,
            width: node.width,
            height: node.height,
          };
          return occupiedNodes.some(occupied => rectsOverlap(candidateRect, occupied, 12));
        });

        if (!overlaps) return candidateCross;
      }

      return baseCross;
    };

    const crossAnchor = findOpenCrossAxis();
    let cursor = currentStart;

    for (const node of orderedMembers) {
      const nextX = isHorizontal ? crossAnchor : cursor;
      const nextY = isHorizontal ? cursor : crossAnchor;

      if (Math.abs(node.x - nextX) > 0.001 || Math.abs(node.y - nextY) > 0.001) {
        movedNodeIds.add(node.id);
      }

      node.x = nextX;
      node.y = nextY;
      cursor += (isHorizontal ? node.height : node.width) + DEFAULT_NODE_SEP;
    }
  }

  return movedNodeIds;
}

export function computeLayout(graph: Graph): LayoutResult {
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: graph.direction ?? 'TB',
    nodesep: DEFAULT_NODE_SEP,
    ranksep: DEFAULT_RANK_SEP,
  });
  g.setDefaultEdgeLabel(() => ({}));

  // Build position lookup
  const posMap = new Map(graph.positions.map(p => [p.id, p]));

  // Add nodes
  for (const node of graph.nodes) {
    const pos = posMap.get(node.id);
    const size = pos?.width && pos?.height
      ? { width: pos.width, height: pos.height }
      : measureNode(node);
    g.setNode(node.id, { width: size.width, height: size.height });
  }

  // Add edges
  for (const edge of graph.edges) {
    if (g.hasNode(edge.from) && g.hasNode(edge.to)) {
      g.setEdge(edge.from, edge.to);
    }
  }

  // Run layout
  dagre.layout(g);

  // Extract node positions (dagre gives center coords → convert to top-left)
  const layoutNodes: LayoutNode[] = [];
  const nodeMap = new Map<string, LayoutNode>();

  for (const node of graph.nodes) {
    const dagreNode = g.node(node.id);
    if (!dagreNode) continue;

    const pos = posMap.get(node.id);
    let x: number, y: number;
    const width = dagreNode.width as number;
    const height = dagreNode.height as number;

    if (pos) {
      // Use explicit position
      x = pos.x;
      y = pos.y;
    } else {
      // Convert dagre center coords to top-left
      x = (dagreNode.x as number) - width / 2;
      y = (dagreNode.y as number) - height / 2;
    }

    const layoutNode: LayoutNode = { id: node.id, x, y, width, height, node };
    layoutNodes.push(layoutNode);
    nodeMap.set(node.id, layoutNode);
  }

  const explicitPositionIds = new Set(graph.positions.map(position => position.id));
  const compactedNodeIds = compactTerminalGroupMembers(graph, nodeMap, explicitPositionIds);

  // Reposition disconnected group members near their connected peers.
  // Dagre places nodes with no edges arbitrarily, which can blow up group
  // bounding boxes. Move them adjacent to their group's connected members.
  const connectedNodes = new Set<string>();
  for (const edge of graph.edges) {
    connectedNodes.add(edge.from);
    connectedNodes.add(edge.to);
  }
  const direction = graph.direction ?? 'TB';
  const isHorizontal = direction === 'LR' || direction === 'RL';

  for (const group of flattenGroups(graph.groups)) {
    const connected: LayoutNode[] = [];
    const disconnected: LayoutNode[] = [];
    for (const id of group.members) {
      const ln = nodeMap.get(id);
      if (!ln) continue;
      if (connectedNodes.has(id)) connected.push(ln);
      else disconnected.push(ln);
    }
    if (connected.length === 0 || disconnected.length === 0) continue;

    // Place disconnected nodes below (TB/BT) or to the right (LR/RL) of
    // the connected members, stacked with normal spacing.
    const maxX = Math.max(...connected.map(n => n.x + n.width));
    const maxY = Math.max(...connected.map(n => n.y + n.height));
    const minX = Math.min(...connected.map(n => n.x));
    const minY = Math.min(...connected.map(n => n.y));

    let offsetX: number, offsetY: number;
    if (isHorizontal) {
      offsetX = minX;
      offsetY = maxY + DEFAULT_NODE_SEP;
    } else {
      offsetX = maxX + DEFAULT_NODE_SEP;
      offsetY = minY;
    }

    for (const ln of disconnected) {
      ln.x = offsetX;
      ln.y = offsetY;
      if (isHorizontal) {
        offsetX += ln.width + DEFAULT_NODE_SEP;
      } else {
        offsetY += ln.height + DEFAULT_NODE_SEP;
      }
    }
  }

  // Extract edge points after any node compaction so group-aware adjustments
  // are reflected in the rendered paths.
  const layoutEdges: LayoutEdge[] = [];
  for (const edge of graph.edges) {
    const fromNode = nodeMap.get(edge.from);
    const toNode = nodeMap.get(edge.to);
    if (!fromNode || !toNode) continue;

    const dagreEdge = g.edge(edge.from, edge.to);
    let points: Point[];

    const fromCenter: Point = { x: fromNode.x + fromNode.width / 2, y: fromNode.y + fromNode.height / 2 };
    const toCenter: Point = { x: toNode.x + toNode.width / 2, y: toNode.y + toNode.height / 2 };

    // When compaction moves connected nodes after dagre runs, the original
    // routed control points are stale. Fall back to a direct segment instead.
    if (
      dagreEdge?.points
      && !posMap.has(edge.from)
      && !posMap.has(edge.to)
      && !compactedNodeIds.has(edge.from)
      && !compactedNodeIds.has(edge.to)
    ) {
      points = (dagreEdge.points as Array<{ x: number; y: number }>).map(p => ({
        x: p.x,
        y: p.y,
      }));
    } else {
      points = [{ ...fromCenter }, { ...toCenter }];
    }

    // Clip first/last points to actual shape boundaries
    const sourceDir = points.length > 2 ? points[1] : toCenter;
    points[0] = clipToShapeBorder(fromCenter, sourceDir, fromNode, fromNode.node.shape);

    const targetDir = points.length > 2 ? points[points.length - 2] : fromCenter;
    points[points.length - 1] = clipToShapeBorder(toCenter, targetDir, toNode, toNode.node.shape);

    layoutEdges.push({ edge, points });
  }

  // Groups are visual containers. Compute their rectangles from the final node
  // positions so they do not distort dagre's rank spacing.
  const layoutGroups = computeGroupLayouts(graph.groups, nodeMap);

  // Compute total bounds
  const allX = [
    ...layoutNodes.map(n => n.x),
    ...layoutNodes.map(n => n.x + n.width),
    ...layoutGroups.map(g => g.x),
    ...layoutGroups.map(g => g.x + g.width),
  ];
  const allY = [
    ...layoutNodes.map(n => n.y),
    ...layoutNodes.map(n => n.y + n.height),
    ...layoutGroups.map(g => g.y),
    ...layoutGroups.map(g => g.y + g.height),
  ];

  const width = allX.length > 0 ? Math.max(...allX) - Math.min(...allX) : 0;
  const height = allY.length > 0 ? Math.max(...allY) - Math.min(...allY) : 0;

  return { nodes: layoutNodes, edges: layoutEdges, groups: layoutGroups, width, height };
}
