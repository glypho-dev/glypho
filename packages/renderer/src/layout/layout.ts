import dagre from '@dagrejs/dagre';
import type { Graph, Group, Shape } from '@glypho/parser';
import { flattenGroups } from '@glypho/parser';
import { pathMidpoint } from '../edges/paths.js';
import { measureEdgeLabel, measureNode, measureText } from './sizing.js';
import type { LayoutResult, LayoutNode, LayoutEdge, LayoutGroup, Point, EdgeLabelBox } from './types.js';

const DEFAULT_NODE_SEP = 60;
const DEFAULT_RANK_SEP = 80;
const GROUP_PADDING = 24;
const GROUP_LABEL_HEIGHT = 24;
// Compound layout inserts empty border ranks around every cluster, which
// reads as dead space, so gaps between occupied bands are compressed to what
// their borders and labels need. Along the rank axis the floor is the plain
// ranksep; across it gaps keep at least this much (two group borders,
// 2 × padding + label = 72, plus daylight).
const MAX_RANK_GAP = 104;
const EMPTY_GROUP_MIN_WIDTH = 96;
const EMPTY_GROUP_MIN_HEIGHT = GROUP_LABEL_HEIGHT + GROUP_PADDING * 2;
// Space kept between an edge label and the rank on either side of it.
const EDGE_LABEL_CLEARANCE = 12;
// How far a fallback self-loop bulges past the node's right edge.
const SELF_LOOP_REACH = 28;
// Space kept between the auto-laid block and pinned (`id@x,y`) content.
const PINNED_CLEARANCE = 32;
// How far before a compacted row an edge turns to enter its target.
const COMPACT_APPROACH = 28;
// A routed edge's first/last leg counts as flat (and gets squared off) when
// its sideways run exceeds this many pixels and this multiple of its rise.
const FLAT_LEG_MIN_RUN = 60;
const FLAT_LEG_RATIO = 2;
// Corner radius used when squaring off a flat leg.
const FLAT_LEG_CORNER = 16;
// A squared-off run moves out of a group box only when that is a short hop
// (about one group header); deeper inside, dagre's own rank is kept.
const FLAT_LEG_MAX_SHIFT = 64;
// Gap between a squared-off leg's sideways run and the group box it leaves.
const FLAT_LEG_GROUP_MARGIN = 10;
// Above this many (dx, dy) pairs, placement only tries single-axis moves.
const MAX_PLACEMENT_CANDIDATES = 250_000;

function subtreeHasNodes(group: Group, nodeIds: { has(id: string): boolean }): boolean {
  return group.members.some(id => nodeIds.has(id))
    || (group.children ?? []).some(child => subtreeHasNodes(child, nodeIds));
}

function emptyGroupSize(group: Group): { width: number; height: number } {
  const { width: labelWidth } = measureText(group.label ?? group.id);
  return {
    width: Math.max(EMPTY_GROUP_MIN_WIDTH, labelWidth + GROUP_PADDING * 2),
    height: EMPTY_GROUP_MIN_HEIGHT,
  };
}

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

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Name for the dagre multigraph edge of graph.edges[index] */
function edgeName(index: number): string {
  return `e${index}`;
}

/** Top-left rect of a dagre node/edge label (dagre reports centers) */
function dagreRect(label: dagre.Node | dagre.GraphEdge | undefined): Rect | undefined {
  if (!label) return undefined;
  const { x, y, width, height } = label as { x?: number; y?: number; width?: number; height?: number };
  if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;
  const w = width ?? 0;
  const h = height ?? 0;
  return { x: x! - w / 2, y: y! - h / 2, width: w, height: h };
}

/**
 * Loop for a self-edge whose node dagre did not place (explicit position or
 * post-dagre compaction): out of the right side and back in. The first and
 * last points are node centers; the caller clips them to the shape border.
 */
function selfLoopPoints(node: LayoutNode): Point[] {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  const outX = node.x + node.width + SELF_LOOP_REACH;
  const spread = Math.max(node.height / 4, 8);
  return [
    { x: cx, y: cy },
    { x: outX, y: cy - spread },
    { x: outX, y: cy + spread },
    { x: cx, y: cy },
  ];
}

/**
 * Route for an edge into a node that post-dagre compaction packed into a
 * row. A straight line from a distant source runs along the row, behind its
 * other nodes; entering from the flow side keeps the edge off them.
 */
function approachFromFlowSide(from: Point, target: LayoutNode, direction: string): Point[] {
  const cx = target.x + target.width / 2;
  const cy = target.y + target.height / 2;
  const to = { x: cx, y: cy };
  let approach: Point;
  switch (direction) {
    case 'LR': approach = { x: target.x - COMPACT_APPROACH, y: cy }; break;
    case 'RL': approach = { x: target.x + target.width + COMPACT_APPROACH, y: cy }; break;
    case 'BT': approach = { x: cx, y: target.y + target.height + COMPACT_APPROACH }; break;
    default: approach = { x: cx, y: target.y - COMPACT_APPROACH };
  }
  // Only when the source really is upstream; otherwise a direct line is best.
  const upstream = direction === 'LR' ? from.x < approach.x
    : direction === 'RL' ? from.x > approach.x
      : direction === 'BT' ? from.y > approach.y
        : from.y < approach.y;
  return upstream ? [{ ...from }, approach, to] : [{ ...from }, to];
}

/**
 * Dagre can leave a node's first (or last) leg running almost flat along its
 * rank when the next dummy point sits far to the side — typically when a
 * group box pushes the other end away. That leg then slices through the
 * node's rank-mates. Square it off instead: leave (or enter) along the flow,
 * and make the sideways run in the dummy rank, where no nodes sit.
 */
function squareFlatEndLegs(
  points: Point[],
  from: Point,
  to: Point,
  rankAxisIsX: boolean,
  hints: {
    /** Preferred rank coordinate for the first leg's run (outside the source's groups) */
    exitRank?: number;
    /** Preferred rank coordinate for the last leg's run (outside the target's groups) */
    entryRank?: number;
    /** Where the edge label sits; that route point must not move */
    labelPoint?: Point;
    /** +1 when ranks grow along the axis (TB, LR), -1 for BT and RL */
    forward?: number;
  } = {},
): Point[] {
  if (points.length < 3) return points;
  const rank = (p: Point) => (rankAxisIsX ? p.x : p.y);
  const cross = (p: Point) => (rankAxisIsX ? p.y : p.x);
  const make = (crossValue: number, rankValue: number): Point => (rankAxisIsX
    ? { x: rankValue, y: crossValue }
    : { x: crossValue, y: rankValue });
  const forward = hints.forward ?? 1;
  // `downstream` is the far end of the leg along the flow. Back edges (dagre
  // routes them against the flow) keep their curves: squaring them would
  // send them out of the wrong side of the node.
  const isFlat = (upstream: Point, downstream: Point) => {
    const rise = (rank(downstream) - rank(upstream)) * forward;
    const run = Math.abs(cross(downstream) - cross(upstream));
    return rise > 0 && run > FLAT_LEG_MIN_RUN && run > FLAT_LEG_RATIO * rise;
  };
  // Corner points: one on the node's axis, one a short way along the run so
  // the path smoothing turns tightly instead of cutting the corner.
  const corner = (center: Point, next: Point): Point[] => {
    const run = cross(next) - cross(center);
    const radius = Math.sign(run) * Math.min(FLAT_LEG_CORNER, Math.abs(run) / 2);
    return [make(cross(center), rank(next)), make(cross(center) + radius, rank(next))];
  };

  const isLabelPoint = (p: Point) => hints.labelPoint !== undefined
    && Math.abs(p.x - hints.labelPoint.x) < 0.5 && Math.abs(p.y - hints.labelPoint.y) < 0.5;
  const strictlyBetween = (value: number, a: number, b: number) =>
    value > Math.min(a, b) && value < Math.max(a, b);

  let result = points.map(p => ({ ...p }));
  // Last leg: run at `entryRank` (just outside the target's groups) when it
  // lies between the ends; dummy points past it, all inside the target's
  // group padding, are dropped — unless one carries the label.
  if (isFlat(result[result.length - 2], to)) {
    const last = result.length - 1;
    let keep = last - 1; // index of the point the run starts from
    let runRank = rank(result[keep]);
    const wanted = hints.entryRank;
    if (wanted !== undefined && strictlyBetween(wanted, rank(result[0]), rank(result[last]))
      && Math.abs(wanted - rank(result[last - 1])) <= FLAT_LEG_MAX_SHIFT) {
      let k = last - 1;
      while (k > 0 && !strictlyBetween(rank(result[k]), rank(result[0]), wanted) && !isLabelPoint(result[k])) k--;
      if (!isLabelPoint(result[k]) || strictlyBetween(rank(result[k]), rank(result[0]), wanted)) {
        keep = k;
        runRank = wanted;
      }
    }
    const start = make(cross(result[keep]), runRank);
    const [onAxis, along] = corner(to, start);
    const head = result.slice(0, keep + 1);
    if (rank(start) !== rank(result[keep])) head.push(start);
    result = [...head, along, onAxis, result[last]];
  }
  // First leg, mirrored: run at `exitRank`, just outside the source's groups.
  if (isFlat(from, result[1])) {
    const last = result.length - 1;
    let keep = 1; // index of the point the run ends at
    let runRank = rank(result[keep]);
    const wanted = hints.exitRank;
    if (wanted !== undefined && strictlyBetween(wanted, rank(result[0]), rank(result[last]))
      && Math.abs(wanted - rank(result[1])) <= FLAT_LEG_MAX_SHIFT) {
      let k = 1;
      while (k < last && !strictlyBetween(rank(result[k]), wanted, rank(result[last])) && !isLabelPoint(result[k])) k++;
      if (k < last && (!isLabelPoint(result[k]) || strictlyBetween(rank(result[k]), wanted, rank(result[last])))) {
        keep = k;
        runRank = wanted;
      }
    }
    const end = make(cross(result[keep]), runRank);
    const tail = result.slice(keep);
    if (rank(end) !== rank(result[keep])) tail.unshift(end);
    result = [result[0], ...corner(from, end), ...tail];
  }
  return result;
}

function computeGroupLayouts(
  groups: Group[],
  nodeMap: ReadonlyMap<string, LayoutNode>,
  placeholderRects: ReadonlyMap<Group, Rect>,
): LayoutGroup[] {
  const layoutGroups: LayoutGroup[] = [];
  const emptyGroups: number[] = [];

  /**
   * Lay out a tree with no nodes at a local origin: nested empty groups sit
   * side by side under the parent's label strip. Pushes every group in the
   * tree and returns the root.
   */
  function layoutEmptyTree(group: Group, depth: number, originX: number, originY: number): LayoutGroup {
    const minSize = emptyGroupSize(group);
    const children = group.children ?? [];
    let cursorX = originX + GROUP_PADDING;
    let tallestChild = 0;
    for (const child of children) {
      const childLayout = layoutEmptyTree(child, depth + 1, cursorX, originY + GROUP_LABEL_HEIGHT + GROUP_PADDING);
      cursorX += childLayout.width + GROUP_PADDING;
      tallestChild = Math.max(tallestChild, childLayout.height);
    }
    const layoutGroup: LayoutGroup = {
      group,
      x: originX,
      y: originY,
      width: children.length > 0 ? Math.max(minSize.width, cursorX - originX) : minSize.width,
      height: children.length > 0
        ? GROUP_LABEL_HEIGHT + GROUP_PADDING * 2 + tallestChild
        : minSize.height,
      depth,
    };
    layoutGroups.push(layoutGroup);
    return layoutGroup;
  }

  function hasPlaceholder(group: Group): boolean {
    return placeholderRects.has(group) || (group.children ?? []).some(hasPlaceholder);
  }

  function visitGroup(group: Group, depth: number): LayoutGroup {
    const childLayouts = (group.children ?? []).map(child => visitGroup(child, depth + 1));

    // Nested empty groups were laid out by dagre as placeholder nodes inside
    // their parent's cluster, so they already have a collision-free slot.
    const placeholder = placeholderRects.get(group);
    if (placeholder) {
      const layoutGroup: LayoutGroup = { group, ...placeholder, depth };
      layoutGroups.push(layoutGroup);
      return layoutGroup;
    }

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
      // Not expected (node-less trees take layoutEmptyTree, nested empty
      // leaves get placeholders), but if it happens, stack it like one.
      ({ width, height } = emptyGroupSize(group));
      x = 0;
      y = 0;
      emptyGroups.push(layoutGroups.length);
    }

    const layoutGroup: LayoutGroup = { group, x, y, width, height, depth };
    layoutGroups.push(layoutGroup);
    return layoutGroup;
  }

  const emptyTrees: LayoutGroup[][] = [];
  for (const group of groups) {
    if (subtreeHasNodes(group, nodeMap) || hasPlaceholder(group)) {
      visitGroup(group, 0);
    } else {
      const start = layoutGroups.length;
      layoutEmptyTree(group, 0, 0, 0);
      emptyTrees.push(layoutGroups.slice(start));
    }
  }
  for (const index of emptyGroups) {
    emptyTrees.push([layoutGroups[index]]);
  }

  // Stack node-less trees below everything else — at their local (0,0)
  // origin they would sit on top of whatever the layout put there.
  if (emptyTrees.length > 0) {
    const emptySet = new Set(emptyTrees.flat());
    const occupied = [
      ...Array.from(nodeMap.values()),
      ...layoutGroups.filter(layoutGroup => !emptySet.has(layoutGroup)),
    ];
    let cursorX = occupied.length > 0 ? Math.min(...occupied.map(item => item.x)) : 0;
    const baseY = occupied.length > 0
      ? Math.max(...occupied.map(item => item.y + item.height)) + GROUP_PADDING * 2
      : 0;
    for (const tree of emptyTrees) {
      const root = tree[tree.length - 1];
      const dx = cursorX - root.x;
      const dy = baseY - root.y;
      for (const layoutGroup of tree) {
        layoutGroup.x += dx;
        layoutGroup.y += dy;
      }
      cursorX += root.width + GROUP_PADDING;
    }
  }

  layoutGroups.sort((a, b) => a.depth - b.depth);
  return layoutGroups;
}

/**
 * Build a monotone remap of coordinates along one axis that shrinks every
 * empty gap between occupied bands down to its budget. Coordinates inside
 * occupied bands translate rigidly; coordinates inside a compressed gap
 * (e.g. long-edge control points) scale linearly within it. The budget is
 * per-gap so gaps crossed by many nested group borders keep enough room.
 */
function buildAxisCompressionMap(
  intervals: Array<[number, number]>,
  gapBudget: (gapStart: number, gapEnd: number) => number,
): (value: number) => number {
  if (intervals.length === 0) return value => value;

  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [[sorted[0][0], sorted[0][1]]];
  for (let i = 1; i < sorted.length; i++) {
    const [start, end] = sorted[i];
    const last = merged[merged.length - 1];
    if (start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }

  // Anchor points (old coordinate → new coordinate) at every band edge.
  const anchors: Array<[number, number]> = [];
  let offset = 0;
  for (let i = 0; i < merged.length; i++) {
    if (i > 0) {
      const gap = merged[i][0] - merged[i - 1][1];
      const budget = gapBudget(merged[i - 1][1], merged[i][0]);
      offset += Math.max(0, gap - budget);
    }
    anchors.push([merged[i][0], merged[i][0] - offset]);
    anchors.push([merged[i][1], merged[i][1] - offset]);
  }

  return (value: number): number => {
    if (value <= anchors[0][0]) return value;
    const last = anchors[anchors.length - 1];
    if (value >= last[0]) return value - (last[0] - last[1]);
    for (let i = 1; i < anchors.length; i++) {
      if (value <= anchors[i][0]) {
        const [oldA, newA] = anchors[i - 1];
        const [oldB, newB] = anchors[i];
        if (oldB === oldA) return newB;
        const t = (value - oldA) / (oldB - oldA);
        return newA + t * (newB - newA);
      }
    }
    return value;
  };
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

/**
 * Compact groups whose members are all terminal sinks sharing one rank.
 * Dagre spreads such fan-outs across a single very wide rank; stacking them
 * along the flow axis keeps the aspect ratio usable. Runs after dagre, so any
 * group it moves has its cluster rectangle invalidated by the caller.
 */
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

/**
 * Pick the dagre cluster parent for each node: the deepest group that lists it
 * as a member (first in document order on ties). Dagre's compound mode allows
 * one parent per node; when a node belongs to several groups, the remaining
 * groups still render as bounding boxes around wherever their members land —
 * overlap is semantically required for overlapping sets.
 */
function assignClusterParents(
  groups: Group[],
  nodeIds: ReadonlySet<string>,
  explicitPositionIds: ReadonlySet<string>,
): Map<string, Group> {
  const assignment = new Map<string, Group>();
  const assignedDepth = new Map<string, number>();

  function visit(group: Group, depth: number): void {
    for (const id of group.members) {
      if (!nodeIds.has(id) || explicitPositionIds.has(id)) continue;
      const existing = assignedDepth.get(id);
      if (existing === undefined || depth > existing) {
        assignment.set(id, group);
        assignedDepth.set(id, depth);
      }
    }
    for (const child of group.children ?? []) {
      visit(child, depth + 1);
    }
  }

  for (const group of groups) {
    visit(group, 0);
  }
  return assignment;
}

/** Every node id in a group, including its nested groups' members */
function memberIdSet(group: Group): Set<string> {
  const ids = new Set(group.members);
  for (const child of group.children ?? []) {
    for (const id of memberIdSet(child)) ids.add(id);
  }
  return ids;
}

function boundsOf(rects: Rect[]): { x1: number; y1: number; x2: number; y2: number } {
  return {
    x1: Math.min(...rects.map(rect => rect.x)),
    y1: Math.min(...rects.map(rect => rect.y)),
    x2: Math.max(...rects.map(rect => rect.x + rect.width)),
    y2: Math.max(...rects.map(rect => rect.y + rect.height)),
  };
}

/**
 * Offset for the auto-laid block of a graph that also has pinned nodes.
 * Pinned nodes keep their absolute coordinates, so the auto block moves:
 * to the offset that clears every pinned obstacle (pinned nodes, and groups
 * made only of pinned nodes) with the smallest overall bounding box — often
 * a hole in the auto layout. On ties it keeps auto↔pinned edges short, then
 * moves the block as little as possible.
 */
function placeAutoBlock(
  graph: Graph,
  g: dagre.graphlib.Graph,
  nodeMap: ReadonlyMap<string, LayoutNode>,
  pinnedIds: ReadonlySet<string>,
  placeholderKeys: ReadonlyMap<Group, string>,
  edgeLabels: ReadonlyArray<{ width: number; height: number } | undefined>,
  mapX: (value: number) => number,
  mapY: (value: number) => number,
): { dx: number; dy: number } {
  const placeholderRects = new Map<Group, Rect>();
  for (const [group, key] of placeholderKeys) {
    const rect = dagreRect(g.node(key));
    if (rect) {
      placeholderRects.set(group, { x: mapX(rect.x), y: mapY(rect.y), width: rect.width, height: rect.height });
    }
  }

  const items: Rect[] = [];
  const obstacles: Rect[] = [];
  for (const node of nodeMap.values()) {
    (pinnedIds.has(node.id) ? obstacles : items).push(node);
  }
  for (const layoutGroup of computeGroupLayouts(graph.groups, nodeMap, placeholderRects)) {
    const ids = [...memberIdSet(layoutGroup.group)].filter(id => nodeMap.has(id));
    if (ids.length === 0) {
      if (placeholderRects.has(layoutGroup.group)) items.push(layoutGroup);
      continue;
    }
    const pinnedCount = ids.filter(id => pinnedIds.has(id)).length;
    // Groups mixing pinned and auto members stretch across both; they can
    // neither move nor act as obstacles.
    if (pinnedCount === ids.length) obstacles.push(layoutGroup);
    else if (pinnedCount === 0) items.push(layoutGroup);
  }
  graph.edges.forEach((edge, index) => {
    const label = edgeLabels[index];
    if (!label || pinnedIds.has(edge.from) || pinnedIds.has(edge.to)) return;
    if (!g.hasNode(edge.from) || !g.hasNode(edge.to)) return;
    const rect = dagreRect(g.edge(edge.from, edge.to, edgeName(index)));
    if (rect) {
      items.push({
        x: mapX(rect.x + rect.width / 2) - label.width / 2,
        y: mapY(rect.y + rect.height / 2) - label.height / 2,
        width: label.width,
        height: label.height,
      });
    }
  });
  if (items.length === 0 || obstacles.length === 0) return { dx: 0, dy: 0 };

  // Edges between the auto block and pinned nodes are drawn straight, so
  // among equally compact spots prefer the one that keeps them short.
  const links: Array<{ auto: Point; pinned: Point; label?: { width: number; height: number } }> = [];
  graph.edges.forEach((edge, index) => {
    const fromPinned = pinnedIds.has(edge.from);
    if (fromPinned === pinnedIds.has(edge.to)) return;
    const autoNode = nodeMap.get(fromPinned ? edge.to : edge.from);
    const pinnedNode = nodeMap.get(fromPinned ? edge.from : edge.to);
    if (!autoNode || !pinnedNode) return;
    links.push({
      auto: { x: autoNode.x + autoNode.width / 2, y: autoNode.y + autoNode.height / 2 },
      pinned: { x: pinnedNode.x + pinnedNode.width / 2, y: pinnedNode.y + pinnedNode.height / 2 },
      label: edgeLabels[index],
    });
  });
  const gap = PINNED_CLEARANCE;
  const autoNodeRects = [...nodeMap.values()].filter(node => !pinnedIds.has(node.id));
  // Item i hits obstacle o exactly for offsets inside an open box in
  // (dx, dy) space; precompute those boxes so each check is a few compares.
  const forbidden = new Float64Array(items.length * obstacles.length * 4);
  let fill = 0;
  for (const item of items) {
    for (const obstacle of obstacles) {
      forbidden[fill++] = obstacle.x - gap - item.x - item.width;
      forbidden[fill++] = obstacle.x + obstacle.width + gap - item.x;
      forbidden[fill++] = obstacle.y - gap - item.y - item.height;
      forbidden[fill++] = obstacle.y + obstacle.height + gap - item.y;
    }
  }
  const EPS = 0.01;
  const inBox = (k: number, dx: number, dy: number) => dx > forbidden[k] + EPS && dx < forbidden[k + 1] - EPS
    && dy > forbidden[k + 2] + EPS && dy < forbidden[k + 3] - EPS;
  let lastHit = 0;
  const hitsObstacle = (dx: number, dy: number): boolean => {
    // Rejections cluster, so try the box that rejected last time first.
    if (inBox(lastHit, dx, dy)) return true;
    for (let k = 0; k < forbidden.length; k += 4) {
      if (inBox(k, dx, dy)) {
        lastHit = k;
        return true;
      }
    }
    return false;
  };
  const clear = (dx: number, dy: number): boolean => !hitsObstacle(dx, dy) && links.every(link => {
    // The straight edge's label (drawn at its midpoint) must clear every node.
    if (!link.label) return true;
    const labelRect = {
      x: (link.auto.x + dx + link.pinned.x) / 2 - link.label.width / 2,
      y: (link.auto.y + dy + link.pinned.y) / 2 - link.label.height / 2,
      width: link.label.width,
      height: link.label.height,
    };
    return obstacles.every(obstacle => !rectsOverlap(labelRect, obstacle, EDGE_LABEL_CLEARANCE / 2))
      && autoNodeRects.every(node => !rectsOverlap(labelRect, {
        x: node.x + dx, y: node.y + dy, width: node.width, height: node.height,
      }, EDGE_LABEL_CLEARANCE / 2));
  });
  if (clear(0, 0)) return { dx: 0, dy: 0 };

  // A tight placement puts some item edge exactly `gap` from some obstacle
  // edge on each axis (or leaves that axis alone).
  const round = (value: number) => Math.round(value * 100) / 100;
  const dxSet = new Set<number>([0]);
  const dySet = new Set<number>([0]);
  for (const obstacle of obstacles) {
    for (const item of items) {
      dxSet.add(round(obstacle.x + obstacle.width + gap - item.x));
      dxSet.add(round(obstacle.x - gap - item.x - item.width));
      dySet.add(round(obstacle.y + obstacle.height + gap - item.y));
      dySet.add(round(obstacle.y - gap - item.y - item.height));
    }
  }
  const block = boundsOf(items);
  const pinned = boundsOf(obstacles);
  const spanX = (dx: number) => Math.max(block.x2 + dx, pinned.x2) - Math.min(block.x1 + dx, pinned.x1);
  const spanY = (dy: number) => Math.max(block.y2 + dy, pinned.y2) - Math.min(block.y1 + dy, pinned.y1);

  const linkLength = (dx: number, dy: number) => {
    let sum = 0;
    for (const link of links) {
      const ex = link.auto.x + dx - link.pinned.x;
      const ey = link.auto.y + dy - link.pinned.y;
      sum += Math.sqrt(ex * ex + ey * ey);
    }
    return sum;
  };

  const dxs = [...dxSet];
  const dys = [...dySet];
  const widths = dxs.map(spanX);
  const heights = dys.map(spanY);
  const fullGrid = dxs.length * dys.length <= MAX_PLACEMENT_CANDIDATES;
  const forEachCandidate = (visit: (dx: number, dy: number, area: number) => void) => {
    if (fullGrid) {
      for (let i = 0; i < dxs.length; i++) {
        for (let j = 0; j < dys.length; j++) visit(dxs[i], dys[j], widths[i] * heights[j]);
      }
    } else {
      for (let i = 0; i < dxs.length; i++) visit(dxs[i], 0, widths[i] * spanY(0));
      for (let j = 0; j < dys.length; j++) visit(0, dys[j], spanX(0) * heights[j]);
    }
  };
  let minArea = Infinity;
  let maxArea = 0;
  forEachCandidate((_dx, _dy, area) => {
    minArea = Math.min(minArea, area);
    maxArea = Math.max(maxArea, area);
  });
  // Walk outward in bands of near-equal area (1%, then 5% steps). Within a
  // band, short auto↔pinned links win, then the smallest move.
  let lower = -Infinity;
  let upper = minArea * 1.01;
  for (;;) {
    const band: Array<{ dx: number; dy: number; links: number; move: number }> = [];
    forEachCandidate((dx, dy, area) => {
      // Cheap obstacle test first; only survivors are ranked.
      if (area > lower && area <= upper && !hitsObstacle(dx, dy)) {
        band.push({ dx, dy, links: linkLength(dx, dy), move: Math.abs(dx) + Math.abs(dy) });
      }
    });
    band.sort((a, b) => a.links - b.links || a.move - b.move);
    for (const candidate of band) {
      if (clear(candidate.dx, candidate.dy)) return { dx: candidate.dx, dy: candidate.dy };
    }
    if (upper >= maxArea) break;
    lower = upper;
    upper *= 1.05;
  }
  // Unreachable: moving past the right edge of every obstacle always clears.
  return { dx: pinned.x2 + gap - block.x1, dy: 0 };
}

export function computeLayout(graph: Graph): LayoutResult {
  // Build position lookup
  const posMap = new Map(graph.positions.map(p => [p.id, p]));
  const explicitPositionIds = new Set(graph.positions.map(position => position.id));
  const nodeIds = new Set(graph.nodes.map(node => node.id));

  // Decide which nodes belong to which dagre cluster. A group becomes a
  // cluster when its subtree contains at least one assigned node, so group
  // membership shapes the layout instead of being drawn on afterwards.
  const parentAssignment = assignClusterParents(graph.groups, nodeIds, explicitPositionIds);
  const assignedGroups = new Set(parentAssignment.values());

  // A nested group with no members and no children still needs a slot
  // inside its parent. It becomes a fixed-size placeholder node in the
  // parent's cluster, so dagre keeps it clear of everything else instead of
  // it being dropped at the origin and dragging the parent box along.
  const placeholderKeys = new Map<Group, string>();
  const placeholderParents = new Map<Group, Group>();
  // Trees with no nodes at all are left to computeGroupLayouts, which stacks
  // them below the diagram without disturbing the node layout.
  function findPlaceholders(group: Group, parent: Group | undefined): void {
    const children = group.children ?? [];
    if (parent && children.length === 0 && !group.members.some(id => nodeIds.has(id))) {
      placeholderKeys.set(group, `__glypho_empty_group_${placeholderKeys.size}__`);
      placeholderParents.set(group, parent);
    }
    for (const child of children) findPlaceholders(child, group);
  }
  for (const group of graph.groups) {
    if (subtreeHasNodes(group, nodeIds)) findPlaceholders(group, undefined);
  }

  const clusterGroups = new Set<Group>();
  function markClusters(group: Group): boolean {
    if (placeholderKeys.has(group)) return true; // occupies a node in its parent's cluster
    let hasContent = assignedGroups.has(group);
    for (const child of group.children ?? []) {
      if (markClusters(child)) hasContent = true;
    }
    if (hasContent) clusterGroups.add(group);
    return hasContent;
  }
  for (const group of graph.groups) {
    markClusters(group);
  }

  // Multigraph so parallel edges (`a>b yes` + `a>b no`) stay distinct and
  // each gets its own route and label slot.
  const g = new dagre.graphlib.Graph({ compound: clusterGroups.size > 0, multigraph: true });
  g.setGraph({
    rankdir: graph.direction ?? 'TB',
    nodesep: DEFAULT_NODE_SEP,
    ranksep: DEFAULT_RANK_SEP,
  });
  g.setDefaultEdgeLabel(() => ({}));

  // Add nodes. Pinned nodes stay out of dagre: it cannot honour their
  // coordinates, and a slot reserved for them would only be dead space.
  const nodeSizes = new Map<string, { width: number; height: number }>();
  for (const node of graph.nodes) {
    const pos = posMap.get(node.id);
    const size = pos?.width && pos?.height
      ? { width: pos.width, height: pos.height }
      : measureNode(node);
    nodeSizes.set(node.id, size);
    if (!pos) g.setNode(node.id, { width: size.width, height: size.height });
  }

  // Add cluster nodes and wire up the containment tree. Cluster keys are
  // synthetic so a group can never collide with a node of the same id.
  const clusterKeys = new Map<Group, string>();
  if (clusterGroups.size > 0) {
    let clusterIndex = 0;
    for (const group of flattenGroups(graph.groups)) {
      if (!clusterGroups.has(group)) continue;
      const key = `__glypho_cluster_${clusterIndex++}__`;
      clusterKeys.set(group, key);
      g.setNode(key, {});
    }
    function linkClusterTree(group: Group): void {
      const parentKey = clusterKeys.get(group);
      for (const child of group.children ?? []) {
        const childKey = clusterKeys.get(child);
        if (parentKey && childKey) g.setParent(childKey, parentKey);
        linkClusterTree(child);
      }
    }
    for (const group of graph.groups) {
      linkClusterTree(group);
    }
    for (const [id, group] of parentAssignment) {
      const key = clusterKeys.get(group);
      if (key) g.setParent(id, key);
    }
    for (const [group, key] of placeholderKeys) {
      g.setNode(key, emptyGroupSize(group));
      const parentKey = clusterKeys.get(placeholderParents.get(group)!);
      if (parentKey) g.setParent(key, parentKey);
    }
  }

  // Add edges. Labels are sized so dagre reserves room for them (it gives
  // each labelled edge a dummy node of that size at the edge's midpoint).
  const edgeLabels = graph.edges.map(edge => (edge.label ? measureEdgeLabel(edge.label) : undefined));
  graph.edges.forEach((edge, index) => {
    if (!g.hasNode(edge.from) || !g.hasNode(edge.to)) return;
    const label = edgeLabels[index];
    g.setEdge(
      edge.from,
      edge.to,
      label ? { width: label.width, height: label.height, labelpos: 'c' } : {},
      edgeName(index),
    );
  });

  // Run layout
  dagre.layout(g);

  // Extract node positions (dagre gives center coords → convert to top-left)
  const layoutNodes: LayoutNode[] = [];
  const nodeMap = new Map<string, LayoutNode>();

  for (const node of graph.nodes) {
    const pos = posMap.get(node.id);
    const dagreNode = pos ? undefined : g.node(node.id);
    if (!pos && !dagreNode) continue;

    let x: number, y: number;
    const { width, height } = nodeSizes.get(node.id)!;

    if (pos) {
      // Use explicit position
      x = pos.x;
      y = pos.y;
    } else {
      // Convert dagre center coords to top-left
      x = (dagreNode!.x as number) - width / 2;
      y = (dagreNode!.y as number) - height / 2;
    }

    const layoutNode: LayoutNode = { id: node.id, x, y, width, height, node };
    layoutNodes.push(layoutNode);
    nodeMap.set(node.id, layoutNode);
  }

  // Squash the dead space introduced by cluster border ranks, on both axes.
  // The remap is shared by nodes, edge control points, and cluster
  // rectangles so the geometry stays consistent.
  // Placeholder slots are boxes like nodes: compression must keep them.
  const reservedRects: Rect[] = [];
  for (const key of placeholderKeys.values()) {
    const rect = dagreRect(g.node(key));
    if (rect) reservedRects.push(rect);
  }
  // Edge-label slots sit inside rank gaps. They are not bands of their own
  // (that would keep a full gap on each side of every label); instead the
  // gap holding a label keeps room for it.
  const labelRects: Rect[] = [];
  graph.edges.forEach((edge, index) => {
    if (!edgeLabels[index] || !g.hasNode(edge.from) || !g.hasNode(edge.to)) return;
    const rect = dagreRect(g.edge(edge.from, edge.to, edgeName(index)));
    if (rect) labelRects.push(rect);
  });

  let mapX: (value: number) => number = value => value;
  let mapY: (value: number) => number = value => value;
  // Labels only need room along the rank axis, where they sit between ranks.
  // Across it they are just boxes that must not be squeezed.
  const rankAxisIsX = graph.direction === 'LR' || graph.direction === 'RL';
  const labelSpans = (axisX: boolean) => labelRects.map(rect => (axisX
    ? { center: rect.x + rect.width / 2, extent: rect.width }
    : { center: rect.y + rect.height / 2, extent: rect.height }));
  // Only dagre-placed content is compressed. Pinned nodes keep their
  // absolute coordinates; the auto-laid block is moved clear of them below.
  const autoNodes = layoutNodes.filter(node => !explicitPositionIds.has(node.id));
  if (clusterKeys.size === 0 && labelRects.length > 0 && autoNodes.length > 0) {
    // Flat graphs: dagre widens every labelled rank gap by the label's full
    // extent. Pull those gaps back to the plain ranksep whenever the label fits.
    const labels = labelSpans(rankAxisIsX);
    const rects: Rect[] = [...autoNodes, ...reservedRects];
    const map = buildAxisCompressionMap(
      rects.map(rect => (rankAxisIsX
        ? [rect.x, rect.x + rect.width]
        : [rect.y, rect.y + rect.height]) as [number, number]),
      (gapStart, gapEnd) => {
        let labelNeed = 0;
        for (const label of labels) {
          if (label.center > gapStart && label.center < gapEnd) {
            labelNeed = Math.max(labelNeed, label.extent + EDGE_LABEL_CLEARANCE * 2);
          }
        }
        return Math.max(DEFAULT_RANK_SEP, labelNeed);
      },
    );
    if (rankAxisIsX) mapX = map; else mapY = map;
    for (const node of autoNodes) {
      node.x = mapX(node.x);
      node.y = mapY(node.y);
    }
  }
  if (clusterKeys.size > 0 && autoNodes.length > 0) {
    // Cluster border positions (pre-compression coordinates). A gap crossed
    // by group-box edges must keep room for each border it contains: top
    // edges carry padding plus the label strip, the other edges padding only.
    const startsX: number[] = [];
    const endsX: number[] = [];
    const startsY: number[] = [];
    const endsY: number[] = [];
    for (const key of clusterKeys.values()) {
      const clusterNode = g.node(key);
      if (!clusterNode || !Number.isFinite(clusterNode.x) || !Number.isFinite(clusterNode.y)) continue;
      const halfW = ((clusterNode.width as number) ?? 0) / 2;
      const halfH = ((clusterNode.height as number) ?? 0) / 2;
      startsX.push((clusterNode.x as number) - halfW);
      endsX.push((clusterNode.x as number) + halfW);
      startsY.push((clusterNode.y as number) - halfH);
      endsY.push((clusterNode.y as number) + halfH);
    }
    const makeGapBudget = (
      starts: number[],
      ends: number[],
      startCost: number,
      labels: Array<{ center: number; extent: number }>,
      floor: number,
    ) =>
      (gapStart: number, gapEnd: number): number => {
        let needed = 0;
        for (const s of starts) if (s > gapStart && s < gapEnd) needed += startCost;
        for (const e of ends) if (e > gapStart && e < gapEnd) needed += GROUP_PADDING;
        // Labels in one gap share a rank, so the widest one sets the room.
        let labelNeed = 0;
        for (const label of labels) {
          if (label.center > gapStart && label.center < gapEnd) {
            labelNeed = Math.max(labelNeed, label.extent + EDGE_LABEL_CLEARANCE * 2);
          }
        }
        // Borders get daylight between them; the label's own clearance stands
        // in for it. Borders are counted per gap, so the floor only has to be
        // the plain spacing: a chain inside one group, or one that merely
        // passes another group's edge, reads like the same chain ungrouped.
        const daylight = labelNeed > 0 ? labelNeed : (needed > 0 ? 32 : 0);
        return Math.max(floor, needed + daylight);
      };
    const occupiedRects: Rect[] = [...autoNodes, ...reservedRects];
    const occupiedX = rankAxisIsX ? occupiedRects : [...occupiedRects, ...labelRects];
    const occupiedY = rankAxisIsX ? [...occupiedRects, ...labelRects] : occupiedRects;
    mapX = buildAxisCompressionMap(
      occupiedX.map(rect => [rect.x, rect.x + rect.width] as [number, number]),
      makeGapBudget(
        startsX, endsX, GROUP_PADDING,
        rankAxisIsX ? labelSpans(true) : [],
        rankAxisIsX ? DEFAULT_RANK_SEP : MAX_RANK_GAP,
      ),
    );
    mapY = buildAxisCompressionMap(
      occupiedY.map(rect => [rect.y, rect.y + rect.height] as [number, number]),
      makeGapBudget(
        startsY, endsY, GROUP_PADDING + GROUP_LABEL_HEIGHT,
        rankAxisIsX ? [] : labelSpans(false),
        rankAxisIsX ? MAX_RANK_GAP : DEFAULT_RANK_SEP,
      ),
    );
    for (const node of autoNodes) {
      node.x = mapX(node.x);
      node.y = mapY(node.y);
    }
  }

  const compactedNodeIds = compactTerminalGroupMembers(graph, nodeMap, explicitPositionIds);

  // Graphs mixing pinned and auto nodes: dagre never saw the pinned ones, so
  // move the auto-laid block (rigidly) to the densest spot that clears every
  // pinned node and every group made only of pinned nodes.
  if (autoNodes.length > 0 && autoNodes.length < layoutNodes.length) {
    const offset = placeAutoBlock(
      graph, g, nodeMap, explicitPositionIds, placeholderKeys, edgeLabels, mapX, mapY,
    );
    if (offset.dx !== 0 || offset.dy !== 0) {
      const baseX = mapX;
      const baseY = mapY;
      mapX = value => baseX(value) + offset.dx;
      mapY = value => baseY(value) + offset.dy;
      for (const node of autoNodes) {
        node.x += offset.dx;
        node.y += offset.dy;
      }
    }
  }

  // Group rectangles come from the padded bounding box of members and child
  // groups. Dagre's own cluster rectangles are deliberately not used: their
  // border ranks extend far past the content, inflating boxes with dead
  // space. Compound placement plus gap compression already guarantee that
  // non-members sit at least a band gap away, so snug boxes stay disjoint.
  const placeholderRects = new Map<Group, Rect>();
  for (const [group, key] of placeholderKeys) {
    const rect = dagreRect(g.node(key));
    if (rect) {
      placeholderRects.set(group, {
        x: mapX(rect.x),
        y: mapY(rect.y),
        width: rect.width,
        height: rect.height,
      });
    }
  }
  const layoutGroups = computeGroupLayouts(graph.groups, nodeMap, placeholderRects);

  // Group boxes holding one endpoint of an edge but not the other: a squared-
  // off end leg runs just outside the outermost such box, clear of its title
  // (and, entering, clear of the other boxes its run passes over).
  const groupBoxesById = new Map<string, LayoutGroup[]>();
  for (const layoutGroup of layoutGroups) {
    for (const id of memberIdSet(layoutGroup.group)) {
      if (!groupBoxesById.has(id)) groupBoxesById.set(id, []);
      groupBoxesById.get(id)!.push(layoutGroup);
    }
  }
  const forward = graph.direction === 'BT' || graph.direction === 'RL' ? -1 : 1;
  /** Rank coordinate just outside the boxes holding `inside` but not `other` */
  const clearOfGroups = (
    inside: string,
    other: string,
    side: 'exit' | 'entry',
    // Entering only: the sideways run's cross-axis span. Boxes it would pass
    // over on the way (between the two ends) are cleared too.
    runSpan?: [number, number],
  ): number | undefined => {
    const otherBoxes = groupBoxesById.get(other) ?? [];
    const boxes = (groupBoxesById.get(inside) ?? []).filter(box => !otherBoxes.includes(box));
    const insideNode = nodeMap.get(inside);
    const otherNode = nodeMap.get(other);
    if (runSpan && insideNode && otherNode) {
      const rankOf = (node: LayoutNode) => (rankAxisIsX ? node.x + node.width / 2 : node.y + node.height / 2);
      const lo = Math.min(rankOf(insideNode), rankOf(otherNode));
      const hi = Math.max(rankOf(insideNode), rankOf(otherNode));
      for (const box of layoutGroups) {
        if (otherBoxes.includes(box) || boxes.includes(box)) continue;
        const crossStart = rankAxisIsX ? box.y : box.x;
        const crossEnd = crossStart + (rankAxisIsX ? box.height : box.width);
        if (crossEnd <= runSpan[0] || crossStart >= runSpan[1]) continue;
        const near = forward > 0 ? (rankAxisIsX ? box.x : box.y) : (rankAxisIsX ? box.x + box.width : box.y + box.height);
        if (near > lo && near < hi) boxes.push(box);
      }
    }
    if (boxes.length === 0) return undefined;
    // Leaving moves along the flow, entering arrives against it.
    const dir = side === 'exit' ? forward : -forward;
    const edges = boxes.map(box => {
      const start = rankAxisIsX ? box.x : box.y;
      const end = start + (rankAxisIsX ? box.width : box.height);
      return dir > 0 ? end : start;
    });
    return dir > 0
      ? Math.max(...edges) + FLAT_LEG_GROUP_MARGIN
      : Math.min(...edges) - FLAT_LEG_GROUP_MARGIN;
  };

  // Extract edge points.
  const layoutEdges: LayoutEdge[] = [];
  graph.edges.forEach((edge, index) => {
    const fromNode = nodeMap.get(edge.from);
    const toNode = nodeMap.get(edge.to);
    if (!fromNode || !toNode) return;

    const dagreEdge = g.edge(edge.from, edge.to, edgeName(index));
    let points: Point[];

    const fromCenter: Point = { x: fromNode.x + fromNode.width / 2, y: fromNode.y + fromNode.height / 2 };
    const toCenter: Point = { x: toNode.x + toNode.width / 2, y: toNode.y + toNode.height / 2 };

    // Explicit positions and post-dagre compaction override dagre's placement,
    // so its routed control points are stale for those endpoints. Fall back to
    // a direct segment (or a loop, for self-edges).
    const routed = Boolean(dagreEdge?.points)
      && !posMap.has(edge.from)
      && !posMap.has(edge.to)
      && !compactedNodeIds.has(edge.from)
      && !compactedNodeIds.has(edge.to);
    if (routed) {
      const mapped = (dagreEdge.points as Array<{ x: number; y: number }>).map(p => ({
        x: mapX(p.x),
        y: mapY(p.y),
      }));
      const crossOf = (p: Point) => (rankAxisIsX ? p.y : p.x);
      const penultimate = mapped[Math.max(0, mapped.length - 2)];
      const runSpan: [number, number] = [
        Math.min(crossOf(penultimate), crossOf(toCenter)),
        Math.max(crossOf(penultimate), crossOf(toCenter)),
      ];
      points = squareFlatEndLegs(
        mapped,
        fromCenter,
        toCenter,
        rankAxisIsX,
        {
          exitRank: clearOfGroups(edge.from, edge.to, 'exit'),
          entryRank: clearOfGroups(edge.to, edge.from, 'entry', runSpan),
          forward,
          labelPoint: edgeLabels[index] && Number.isFinite(dagreEdge.x)
            ? { x: mapX(dagreEdge.x as number), y: mapY(dagreEdge.y as number) }
            : undefined,
        },
      );
    } else if (edge.from === edge.to) {
      points = selfLoopPoints(fromNode);
    } else if (compactedNodeIds.has(edge.to) && !posMap.has(edge.from) && !posMap.has(edge.to)) {
      points = approachFromFlowSide(fromCenter, toNode, graph.direction ?? 'TB');
    } else {
      points = [{ ...fromCenter }, { ...toCenter }];
    }

    // Clip first/last points to actual shape boundaries
    const sourceDir = points.length > 2 ? points[1] : toCenter;
    points[0] = clipToShapeBorder(fromCenter, sourceDir, fromNode, fromNode.node.shape);

    const targetDir = points.length > 2 ? points[points.length - 2] : fromCenter;
    points[points.length - 1] = clipToShapeBorder(toCenter, targetDir, toNode, toNode.node.shape);

    const layoutEdge: LayoutEdge = { edge, points };
    const label = edgeLabels[index];
    if (label) {
      let center: Point;
      if (routed && Number.isFinite(dagreEdge.x) && Number.isFinite(dagreEdge.y)) {
        center = { x: mapX(dagreEdge.x as number), y: mapY(dagreEdge.y as number) };
      } else if (edge.from === edge.to) {
        // Beside the loop rather than on top of it
        center = {
          x: fromNode.x + fromNode.width + SELF_LOOP_REACH + 4 + label.width / 2,
          y: fromNode.y + fromNode.height / 2,
        };
      } else if (points.length === 3 && compactedNodeIds.has(edge.to)) {
        // On the run toward the row, not at its turn beside sibling targets
        center = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
      } else {
        center = pathMidpoint(points);
      }
      const labelBox: EdgeLabelBox = { ...center, ...label };
      layoutEdge.labelBox = labelBox;
    }
    layoutEdges.push(layoutEdge);
  });

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
