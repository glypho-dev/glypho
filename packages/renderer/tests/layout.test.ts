import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { computeLayout } from '../src/layout/layout.js';
import { parse } from '@glypho/parser';
import type { Graph } from '@glypho/parser';

function makeGraph(overrides: Partial<Graph> = {}): Graph {
  return {
    nodes: [],
    edges: [],
    groups: [],
    positions: [],
    styles: [],
    ...overrides,
  };
}

/** Does any segment of a polyline cross the rectangle? (Liang–Barsky) */
function polylineHitsRect(
  points: Array<{ x: number; y: number }>,
  rect: { x: number; y: number; width: number; height: number },
): boolean {
  for (let k = 0; k + 1 < points.length; k++) {
    const p = points[k];
    const dx = points[k + 1].x - p.x;
    const dy = points[k + 1].y - p.y;
    let t0 = 0;
    let t1 = 1;
    let hit = true;
    for (const [pp, qq] of [
      [-dx, p.x - rect.x], [dx, rect.x + rect.width - p.x],
      [-dy, p.y - rect.y], [dy, rect.y + rect.height - p.y],
    ]) {
      if (pp === 0) {
        if (qq < 0) { hit = false; break; }
        continue;
      }
      const t = qq / pp;
      if (pp < 0) { if (t > t1) { hit = false; break; } if (t > t0) t0 = t; }
      else { if (t < t0) { hit = false; break; } if (t < t1) t1 = t; }
    }
    if (hit) return true;
  }
  return false;
}

describe('computeLayout', () => {
  it('handles empty graph', () => {
    const result = computeLayout(makeGraph());
    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
    expect(result.groups).toEqual([]);
  });

  it('lays out a single node', () => {
    const result = computeLayout(makeGraph({
      nodes: [{ id: 'a' }],
    }));
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].id).toBe('a');
    expect(typeof result.nodes[0].x).toBe('number');
    expect(typeof result.nodes[0].y).toBe('number');
    expect(result.nodes[0].width).toBeGreaterThan(0);
    expect(result.nodes[0].height).toBeGreaterThan(0);
  });

  it('lays out two connected nodes', () => {
    const result = computeLayout(makeGraph({
      nodes: [{ id: 'a' }, { id: 'b' }],
      edges: [{ from: 'a', to: 'b', op: '>' }],
    }));
    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].points.length).toBeGreaterThanOrEqual(2);
  });

  it('respects explicit positions', () => {
    const result = computeLayout(makeGraph({
      nodes: [{ id: 'a' }, { id: 'b' }],
      positions: [{ id: 'a', x: 100, y: 200 }],
    }));
    const nodeA = result.nodes.find(n => n.id === 'a')!;
    expect(nodeA.x).toBe(100);
    expect(nodeA.y).toBe(200);
  });

  it('creates group bounding boxes', () => {
    const result = computeLayout(makeGraph({
      nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      edges: [{ from: 'a', to: 'b', op: '>' }],
      groups: [{ id: 'g1', members: ['a', 'b'] }],
    }));
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].width).toBeGreaterThan(0);
    expect(result.groups[0].height).toBeGreaterThan(0);
  });

  it('uses direction from graph', () => {
    const lr = computeLayout(makeGraph({
      direction: 'LR',
      nodes: [{ id: 'a' }, { id: 'b' }],
      edges: [{ from: 'a', to: 'b', op: '>' }],
    }));
    const nodeA = lr.nodes.find(n => n.id === 'a')!;
    const nodeB = lr.nodes.find(n => n.id === 'b')!;
    // In LR mode, b should be to the right of a
    expect(nodeB.x).toBeGreaterThan(nodeA.x);
  });

  it('creates nested group bounding boxes with correct depth', () => {
    const result = computeLayout(makeGraph({
      nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      edges: [{ from: 'a', to: 'b', op: '>' }],
      groups: [{
        id: 'outer', members: ['c'],
        children: [{ id: 'inner', members: ['a', 'b'] }],
      }],
    }));
    expect(result.groups).toHaveLength(2);
    const outer = result.groups.find(g => g.group.id === 'outer')!;
    const inner = result.groups.find(g => g.group.id === 'inner')!;
    expect(outer.depth).toBe(0);
    expect(inner.depth).toBe(1);
    // Outer should contain inner
    expect(outer.x).toBeLessThanOrEqual(inner.x);
    expect(outer.y).toBeLessThanOrEqual(inner.y);
    expect(outer.x + outer.width).toBeGreaterThanOrEqual(inner.x + inner.width);
    expect(outer.y + outer.height).toBeGreaterThanOrEqual(inner.y + inner.height);
  });

  it('sorts groups by depth (outermost first)', () => {
    const result = computeLayout(makeGraph({
      nodes: [{ id: 'a' }],
      groups: [{
        id: 'outer', members: [],
        children: [{ id: 'inner', members: ['a'] }],
      }],
    }));
    expect(result.groups[0].group.id).toBe('outer');
    expect(result.groups[1].group.id).toBe('inner');
  });

  it('keeps non-members outside a group box even when the flow passes through', () => {
    // a>b>c with only a and c grouped: flat layout used to draw the group box
    // straight over b, misstating membership.
    const result = computeLayout(makeGraph({
      nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      edges: [
        { from: 'a', to: 'b', op: '>' },
        { from: 'b', to: 'c', op: '>' },
      ],
      groups: [{ id: 'g', members: ['a', 'c'] }],
    }));

    const b = result.nodes.find(node => node.id === 'b')!;
    const group = result.groups[0];
    const bInsideGroup = b.x + b.width > group.x
      && b.x < group.x + group.width
      && b.y + b.height > group.y
      && b.y < group.y + group.height;
    expect(bInsideGroup).toBe(false);

    for (const id of ['a', 'c']) {
      const member = result.nodes.find(node => node.id === id)!;
      expect(member.x).toBeGreaterThanOrEqual(group.x);
      expect(member.y).toBeGreaterThanOrEqual(group.y);
      expect(member.x + member.width).toBeLessThanOrEqual(group.x + group.width);
      expect(member.y + member.height).toBeLessThanOrEqual(group.y + group.height);
    }
  });

  it('lays out sibling groups as disjoint clusters', () => {
    const baseGraph = makeGraph({
      direction: 'TB',
      nodes: [
        { id: 'start', shape: 'c', label: 'Start' },
        { id: 'login', shape: 'r', label: 'Enter Credentials' },
        { id: 'validate', shape: 'd', label: 'Valid?' },
        { id: 'mfa', shape: 'd', label: 'MFA Enabled?' },
        { id: 'verify', shape: 'r', label: 'Enter MFA Code' },
        { id: 'mfa_check', shape: 'd', label: 'Code Valid?' },
        { id: 'dashboard', shape: 'r', label: 'Dashboard' },
        { id: 'retry', shape: 'r', label: 'Show Error' },
        { id: 'lockout', shape: 'r', label: 'Account Locked' },
      ],
      edges: [
        { from: 'start', to: 'login', op: '>' },
        { from: 'login', to: 'validate', op: '>' },
        { from: 'validate', to: 'mfa', op: '>', label: 'yes' },
        { from: 'validate', to: 'retry', op: '>', label: 'no' },
        { from: 'mfa', to: 'dashboard', op: '>', label: 'no' },
        { from: 'mfa', to: 'verify', op: '>', label: 'yes' },
        { from: 'verify', to: 'mfa_check', op: '>' },
        { from: 'mfa_check', to: 'dashboard', op: '>', label: 'yes' },
        { from: 'mfa_check', to: 'retry', op: '>', label: 'no' },
        { from: 'retry', to: 'login', op: '>', label: 'retry' },
      ],
    });

    const grouped = computeLayout({
      ...baseGraph,
      groups: [
        { id: 'auth', members: ['login', 'validate', 'mfa', 'verify', 'mfa_check'] },
        { id: 'outcomes', members: ['dashboard', 'retry', 'lockout'] },
      ],
    });

    const auth = grouped.groups.find(group => group.group.id === 'auth')!;
    const outcomes = grouped.groups.find(group => group.group.id === 'outcomes')!;
    const overlap = !(
      auth.x + auth.width <= outcomes.x
      || outcomes.x + outcomes.width <= auth.x
      || auth.y + auth.height <= outcomes.y
      || outcomes.y + outcomes.height <= auth.y
    );
    expect(overlap).toBe(false);

    // Every member sits inside its own group's rectangle.
    const membership: Array<[typeof auth, string[]]> = [
      [auth, ['login', 'validate', 'mfa', 'verify', 'mfa_check']],
      [outcomes, ['dashboard', 'retry', 'lockout']],
    ];
    for (const [group, members] of membership) {
      for (const id of members) {
        const member = grouped.nodes.find(node => node.id === id)!;
        expect(member.x).toBeGreaterThanOrEqual(group.x);
        expect(member.y).toBeGreaterThanOrEqual(group.y);
        expect(member.x + member.width).toBeLessThanOrEqual(group.x + group.width);
        expect(member.y + member.height).toBeLessThanOrEqual(group.y + group.height);
      }
    }
  });

  it('keeps adjacent group boxes close despite cluster border ranks', () => {
    // Layered TB architecture: one group per rank. Compound layout inserts
    // empty border ranks; the compression pass must squash them so stacked
    // group boxes stay near each other instead of drifting apart.
    const result = computeLayout(makeGraph({
      direction: 'TB',
      nodes: [
        { id: 'ui' }, { id: 'api' }, { id: 'db' },
      ],
      edges: [
        { from: 'ui', to: 'api', op: '>' },
        { from: 'api', to: 'db', op: '>' },
      ],
      groups: [
        { id: 'front', members: ['ui'] },
        { id: 'back', members: ['api'] },
        { id: 'data', members: ['db'] },
      ],
    }));

    const front = result.groups.find(group => group.group.id === 'front')!;
    const back = result.groups.find(group => group.group.id === 'back')!;
    const data = result.groups.find(group => group.group.id === 'data')!;

    const gap1 = back.y - (front.y + front.height);
    const gap2 = data.y - (back.y + back.height);
    expect(gap1).toBeGreaterThanOrEqual(0);
    expect(gap2).toBeGreaterThanOrEqual(0);
    expect(gap1).toBeLessThanOrEqual(48);
    expect(gap2).toBeLessThanOrEqual(48);
  });

  it('keeps outside nodes clear of deeply nested group boxes', () => {
    // Five nested levels: the gap between the outside node and the innermost
    // members is crossed by four group tops. The compression budget must
    // adapt or the outside node lands inside the outer boxes.
    const result = computeLayout(makeGraph({
      direction: 'TB',
      nodes: [{ id: 'outside' }, { id: 'inner' }, { id: 'sidecar' }],
      edges: [
        { from: 'outside', to: 'inner', op: '>' },
        { from: 'inner', to: 'sidecar', op: '--' },
      ],
      groups: [{
        id: 'l1', members: [],
        children: [{
          id: 'l2', members: [],
          children: [{
            id: 'l3', members: [],
            children: [{
              id: 'l4', members: [],
              children: [{ id: 'l5', members: ['inner', 'sidecar'] }],
            }],
          }],
        }],
      }],
    }));

    const outside = result.nodes.find(node => node.id === 'outside')!;
    for (const layoutGroup of result.groups) {
      const intrudes = outside.x + outside.width > layoutGroup.x
        && outside.x < layoutGroup.x + layoutGroup.width
        && outside.y + outside.height > layoutGroup.y
        && outside.y < layoutGroup.y + layoutGroup.height;
      expect(intrudes, `outside node inside group ${layoutGroup.group.id}`).toBe(false);
    }
  });

  it('places empty top-level groups clear of the content', () => {
    const result = computeLayout(makeGraph({
      nodes: [{ id: 'a' }, { id: 'b' }],
      edges: [{ from: 'a', to: 'b', op: '>' }],
      groups: [
        { id: 'solo', members: ['a'] },
        { id: 'void', members: [] },
      ],
    }));

    const voidGroup = result.groups.find(group => group.group.id === 'void')!;
    for (const node of result.nodes) {
      const overlap = !(
        node.x + node.width <= voidGroup.x
        || voidGroup.x + voidGroup.width <= node.x
        || node.y + node.height <= voidGroup.y
        || voidGroup.y + voidGroup.height <= node.y
      );
      expect(overlap, `node ${node.id} under empty group box`).toBe(false);
    }
    const solo = result.groups.find(group => group.group.id === 'solo')!;
    const groupsOverlap = !(
      solo.x + solo.width <= voidGroup.x
      || voidGroup.x + voidGroup.width <= solo.x
      || solo.y + solo.height <= voidGroup.y
      || voidGroup.y + voidGroup.height <= solo.y
    );
    expect(groupsOverlap).toBe(false);
  });

  it('lays out the cli example with disjoint top-level groups', () => {
    const examplePath = resolve(process.cwd(), '../../spec/examples/cli.g');
    const source = readFileSync(examplePath, 'utf8');
    const { graph } = parse(source);
    const result = computeLayout(graph);

    const topLevel = result.groups.filter(group => group.depth === 0);
    expect(topLevel.length).toBeGreaterThan(1);

    for (let i = 0; i < topLevel.length; i++) {
      for (let j = i + 1; j < topLevel.length; j++) {
        const a = topLevel[i];
        const b = topLevel[j];
        const overlap = !(
          a.x + a.width <= b.x
          || b.x + b.width <= a.x
          || a.y + a.height <= b.y
          || b.y + b.height <= a.y
        );
        expect(overlap, `groups ${a.group.id} and ${b.group.id} overlap`).toBe(false);
      }
    }

    // Members stay inside their group rectangles.
    for (const layoutGroup of result.groups) {
      for (const id of layoutGroup.group.members) {
        const member = result.nodes.find(node => node.id === id);
        if (!member) continue;
        expect(member.x).toBeGreaterThanOrEqual(layoutGroup.x);
        expect(member.y).toBeGreaterThanOrEqual(layoutGroup.y);
        expect(member.x + member.width).toBeLessThanOrEqual(layoutGroup.x + layoutGroup.width);
        expect(member.y + member.height).toBeLessThanOrEqual(layoutGroup.y + layoutGroup.height);
      }
    }
  });
});

describe('computeLayout regressions', () => {
  type Box = { x: number; y: number; width: number; height: number };
  const overlap = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width
    && a.y < b.y + b.height && b.y < a.y + a.height;
  const inside = (outer: Box, inner: Box) => inner.x >= outer.x && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
  const layoutOf = (source: string) => {
    const { graph, errors } = parse(source);
    expect(errors).toEqual([]);
    return computeLayout(graph);
  };
  // labelBox is center-based; convert for the rect helpers above
  const labelRect = (box: { x: number; y: number; width: number; height: number }): Box => ({
    x: box.x - box.width / 2, y: box.y - box.height / 2, width: box.width, height: box.height,
  });
  const pathLength = (points: Array<{ x: number; y: number }>) => points.slice(1)
    .reduce((sum, p, i) => sum + Math.hypot(p.x - points[i].x, p.y - points[i].y), 0);

  it('keeps a node-less nested group tree off the nodes and out of the origin', () => {
    const result = layoutOf('x>y\ny>z\n@outer{@inner{}}');
    const outer = result.groups.find(g => g.group.id === 'outer')!;
    const inner = result.groups.find(g => g.group.id === 'inner')!;
    expect(inside(outer, inner)).toBe(true);
    for (const node of result.nodes) {
      expect(overlap(outer, node), `outer covers ${node.id}`).toBe(false);
    }
    // The node layout is untouched by a group that has nothing in it
    const plain = layoutOf('x>y\ny>z');
    expect(result.nodes.map(n => [n.x, n.y])).toEqual(plain.nodes.map(n => [n.x, n.y]));
  });

  it('gives an empty nested group its own slot inside a populated parent', () => {
    const result = layoutOf('x>y\ny>z\n@outer{x @inner{}}');
    const outer = result.groups.find(g => g.group.id === 'outer')!;
    const inner = result.groups.find(g => g.group.id === 'inner')!;
    const byId = new Map(result.nodes.map(n => [n.id, n]));
    expect(inside(outer, inner)).toBe(true);
    expect(inside(outer, byId.get('x')!)).toBe(true);
    // The parent must not be stretched over non-members
    expect(overlap(outer, byId.get('y')!)).toBe(false);
    expect(overlap(outer, byId.get('z')!)).toBe(false);
    for (const node of result.nodes) expect(overlap(inner, node)).toBe(false);
  });

  it('routes duplicate edges separately and keeps their labels apart', () => {
    const result = layoutOf('a>b yes\na>b no');
    expect(result.edges).toHaveLength(2);
    const [yes, no] = result.edges;
    expect(yes.points).not.toEqual(no.points);
    expect(yes.labelBox!.lines).toEqual(['yes']);
    expect(no.labelBox!.lines).toEqual(['no']);
    expect(overlap(labelRect(yes.labelBox!), labelRect(no.labelBox!))).toBe(false);
  });

  it('separates unlabelled duplicate edges too', () => {
    const [first, second] = layoutOf('a>b\na>b').edges;
    expect(first.points).not.toEqual(second.points);
  });

  it('draws a real loop for a self-edge on an explicitly positioned node', () => {
    const result = layoutOf('a>a loop\na@10,10');
    const [edge] = result.edges;
    const node = result.nodes[0];
    expect(pathLength(edge.points)).toBeGreaterThan(20);
    // Loop leaves the right side of the node and returns to it
    expect(Math.max(...edge.points.map(p => p.x))).toBeGreaterThan(node.x + node.width);
    expect(edge.points[0]).not.toEqual(edge.points[edge.points.length - 1]);
    // Label sits beside the loop, not on the node
    expect(overlap(labelRect(edge.labelBox!), node)).toBe(false);
  });

  it('sizes edge labels with glyph metrics, honours \\n, and reserves room in the layout', () => {
    const result = layoutOf('a>b "这是一个很长的中文标签"\nb>c "first line\\nsecond"');
    const [cjk, multi] = result.edges;
    // 11 CJK glyphs at ~1em each — far wider than the old 7px-per-char guess
    expect(cjk.labelBox!.width).toBeGreaterThan(11 * 12);
    expect(multi.labelBox!.lines).toEqual(['first line', 'second']);
    expect(multi.labelBox!.height).toBeGreaterThan(cjk.labelBox!.height);
    // Dagre reserved space, so labels clear every node
    for (const edge of result.edges) {
      for (const node of result.nodes) {
        expect(overlap(labelRect(edge.labelBox!), node), `${edge.edge.label} over ${node.id}`).toBe(false);
      }
    }
  });

  it('keeps long LR edge labels clear of nodes', () => {
    const result = layoutOf('>LR\na>b "a fairly long edge label here"\nb>c');
    const [labelled] = result.edges;
    for (const node of result.nodes) {
      expect(overlap(labelRect(labelled.labelBox!), node)).toBe(false);
    }
  });
  // Pinned nodes (`id@x,y`) used to sit wherever their coordinates fell in the
  // auto layout, so a group of them landed on top of an auto-laid group
  // (glypho.dev Syntax Guide: Layout over Semantic Elements).
  it('keeps a group of pinned nodes clear of auto-laid groups', () => {
    const source = [
      '>TB',
      'hub>a', 'hub>b', 'hub>c', 'hub>d',
      'hub>p1 position', 'hub>p2 "position + size"',
      'p1@100,150', 'p2@100,200^140x40',
      '@auto{a b c d}', '@pinned{p1 p2}',
    ].join('\n');
    const result = layoutOf(source);
    const byId = new Map(result.nodes.map(n => [n.id, n]));
    // Pinned coordinates and sizes are honoured exactly
    expect(byId.get('p1')).toMatchObject({ x: 100, y: 150 });
    expect(byId.get('p2')).toMatchObject({ x: 100, y: 200, width: 140, height: 40 });
    const auto = result.groups.find(g => g.group.id === 'auto')!;
    const pinned = result.groups.find(g => g.group.id === 'pinned')!;
    expect(overlap(auto, pinned)).toBe(false);
    for (let i = 0; i < result.nodes.length; i++) {
      for (let j = i + 1; j < result.nodes.length; j++) {
        expect(overlap(result.nodes[i], result.nodes[j]), `${result.nodes[i].id}/${result.nodes[j].id}`).toBe(false);
      }
    }
    // Labels on the straight edges to pinned nodes clear every node
    for (const edge of result.edges) {
      if (!edge.labelBox) continue;
      for (const node of result.nodes) {
        expect(overlap(labelRect(edge.labelBox), node), `${edge.edge.label} over ${node.id}`).toBe(false);
      }
    }
  });

  it('compresses the auto-laid part of a graph that also has pinned nodes', () => {
    const chain = 'a>b\nb>c\nc>d x\n@g{a b c d}';
    const pinnedToo = layoutOf(`${chain}\npin@0,0`);
    const plain = layoutOf(chain);
    const span = (result: ReturnType<typeof layoutOf>) => {
      const ids = new Set(['a', 'b', 'c', 'd']);
      const nodes = result.nodes.filter(n => ids.has(n.id));
      return Math.max(...nodes.map(n => n.y + n.height)) - Math.min(...nodes.map(n => n.y));
    };
    // One pinned node used to switch compression off for the whole graph
    expect(span(pinnedToo)).toBeCloseTo(span(plain), 0);
  });

  it('spaces an unlabelled chain inside a group like the same chain outside one', () => {
    const gaps = (source: string) => {
      const byId = new Map(layoutOf(source).nodes.map(n => [n.id, n]));
      return [['a', 'b'], ['b', 'c']].map(([from, to]) => {
        const upper = byId.get(from)!;
        return byId.get(to)!.y - (upper.y + upper.height);
      });
    };
    const flat = gaps('a>b\nb>c');
    expect(gaps('a>b\nb>c\n@g{a b c}')).toEqual(flat);
    // ...and a labelled edge elsewhere in the graph does not stretch it
    expect(gaps('a>b\nb>c\nx>y "a label"\n@g{a b c}\n@h{x y}')).toEqual(flat);
  });

  it('keeps edges off the rank-mates of their endpoints (cli example)', () => {
    const source = readFileSync(resolve(process.cwd(), '../../spec/examples/cli.g'), 'utf8');
    const result = layoutOf(source);
    const bad: string[] = [];
    for (const edge of result.edges) {
      for (const node of result.nodes) {
        if (node.id === edge.edge.from || node.id === edge.edge.to) continue;
        const shrunk = { x: node.x + 3, y: node.y + 3, width: node.width - 6, height: node.height - 6 };
        if (polylineHitsRect(edge.points, shrunk)) bad.push(`${edge.edge.from}>${edge.edge.to} through ${node.id}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('enters a compacted row of terminal nodes from the flow side', () => {
    // x and v belong to two groups each, so dagre cannot keep @out together
    // and compaction packs them into a row of their own.
    const result = layoutOf('h>x\nh>y\nh>z\nh>w\nh>v\n@a{x y}\n@b{z w v}\n@out{x v}');
    const byId = new Map(result.nodes.map(n => [n.id, n]));
    for (const target of ['x', 'v']) {
      const edge = result.edges.find(e => e.edge.to === target)!;
      const node = byId.get(target)!;
      expect(edge.points).toHaveLength(3);
      const [, turn, end] = edge.points;
      // The turn sits straight above the target, so the last leg drops in
      expect(turn.x).toBeCloseTo(node.x + node.width / 2, 5);
      expect(turn.y).toBeLessThan(node.y);
      expect(end.y).toBeCloseTo(node.y, 0);
    }
  });
});
