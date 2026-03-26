import { describe, it, expect } from 'vitest';
import { graphToGlypho } from '../src/serialize.js';
import { parse } from '../src/index.js';
import type { Graph } from '../src/types.js';

describe('graphToGlypho', () => {
  it('serializes direction', () => {
    const graph: Graph = { direction: 'LR', nodes: [], edges: [], groups: [], positions: [], styles: [] };
    expect(graphToGlypho(graph)).toBe('>LR');
  });

  it('serializes simple nodes', () => {
    const graph: Graph = {
      nodes: [{ id: 'a', shape: 'r', label: 'Hello' }],
      edges: [], groups: [], positions: [], styles: [],
    };
    expect(graphToGlypho(graph)).toBe('a:r Hello');
  });

  it('omits label when it equals id', () => {
    const graph: Graph = {
      nodes: [{ id: 'a', shape: 'r', label: 'a' }],
      edges: [], groups: [], positions: [], styles: [],
    };
    expect(graphToGlypho(graph)).toBe('a:r');
  });

  it('quotes labels with spaces', () => {
    const graph: Graph = {
      nodes: [{ id: 'a', shape: 'r', label: 'Hello World' }],
      edges: [], groups: [], positions: [], styles: [],
    };
    expect(graphToGlypho(graph)).toBe('a:r "Hello World"');
  });

  it('uses triple quotes for multiline labels', () => {
    const graph: Graph = {
      nodes: [{ id: 'a', shape: 'd', label: 'Line1\nLine2' }],
      edges: [], groups: [], positions: [], styles: [],
    };
    expect(graphToGlypho(graph)).toContain('"""');
  });

  it('serializes node colors', () => {
    const graph: Graph = {
      nodes: [{ id: 'a', shape: 'c', label: 'Start', color: '#0f0' }],
      edges: [], groups: [], positions: [], styles: [],
    };
    expect(graphToGlypho(graph)).toBe('a:c Start #0f0');
  });

  it('serializes bare nodes (no shape, no label)', () => {
    const graph: Graph = {
      nodes: [{ id: 'simple' }],
      edges: [], groups: [], positions: [], styles: [],
    };
    expect(graphToGlypho(graph)).toBe('simple');
  });

  it('serializes edges with all operators', () => {
    const ops: Array<{ op: '>' | '~' | '=' | '--' | '<>', expected: string }> = [
      { op: '>', expected: 'a>b' },
      { op: '~', expected: 'a~b' },
      { op: '=', expected: 'a=b' },
      { op: '--', expected: 'a--b' },
      { op: '<>', expected: 'a<>b' },
    ];
    for (const { op, expected } of ops) {
      const graph: Graph = {
        nodes: [], edges: [{ from: 'a', to: 'b', op }],
        groups: [], positions: [], styles: [],
      };
      expect(graphToGlypho(graph)).toBe(expected);
    }
  });

  it('serializes edge labels', () => {
    const graph: Graph = {
      nodes: [], edges: [{ from: 'a', to: 'b', op: '>', label: 'yes' }],
      groups: [], positions: [], styles: [],
    };
    expect(graphToGlypho(graph)).toBe('a>b yes');
  });

  it('serializes groups', () => {
    const graph: Graph = {
      nodes: [], edges: [],
      groups: [{ id: 'auth', members: ['login', 'validate'] }],
      positions: [], styles: [],
    };
    expect(graphToGlypho(graph)).toBe('@auth{login validate}');
  });

  it('serializes groups with labels', () => {
    const graph: Graph = {
      nodes: [], edges: [],
      groups: [{ id: 'auth', label: 'Authentication', members: ['login'] }],
      positions: [], styles: [],
    };
    expect(graphToGlypho(graph)).toBe('@auth Authentication{login}');
  });

  it('serializes positions', () => {
    const graph: Graph = {
      nodes: [], edges: [], groups: [],
      positions: [{ id: 'a', x: 100, y: 200 }],
      styles: [],
    };
    expect(graphToGlypho(graph)).toBe('a@100,200');
  });

  it('serializes positions with dimensions', () => {
    const graph: Graph = {
      nodes: [], edges: [], groups: [],
      positions: [{ id: 'a', x: 100, y: 200, width: 120, height: 40 }],
      styles: [],
    };
    expect(graphToGlypho(graph)).toBe('a@100,200^120x40');
  });

  it('serializes styles', () => {
    const graph: Graph = {
      nodes: [], edges: [], groups: [], positions: [],
      styles: [{ selector: ':r', properties: { fill: '#fff', stroke: '#333' } }],
    };
    expect(graphToGlypho(graph)).toBe('$:r{fill:#fff stroke:#333}');
  });

  it('serializes class assignments from node membership', () => {
    const graph: Graph = {
      nodes: [
        { id: 'a', classes: ['highlight'] },
        { id: 'b', classes: ['highlight', 'error'] },
      ],
      edges: [], groups: [], positions: [], styles: [],
    };
    expect(graphToGlypho(graph)).toBe('a\nb\n.highlight{a b}\n.error{b}');
  });

  it('roundtrips a full graph', () => {
    const input = `>LR
start:c Start #0f0
login:r "Enter Credentials"
.highlight{login}
$:r{fill:#fff}
start>login
@auth{login}`;
    const { graph } = parse(input);
    const output = graphToGlypho(graph);
    // Re-parse the output and verify same structure
    const { graph: graph2 } = parse(output);
    expect(graph2.nodes.length).toBe(graph.nodes.length);
    expect(graph2.edges.length).toBe(graph.edges.length);
    expect(graph2.direction).toBe(graph.direction);
    expect(graph2.nodes.find(n => n.id === 'login')?.classes).toEqual(['highlight']);
  });

  it('serializes nested groups multi-line', () => {
    const graph: Graph = {
      nodes: [], edges: [], positions: [], styles: [],
      groups: [{
        id: 'outer', label: 'Outer', members: ['gateway'],
        children: [
          { id: 'inner', members: ['a', 'b'] },
        ],
      }],
    };
    const output = graphToGlypho(graph);
    expect(output).toContain('@outer Outer{');
    expect(output).toContain('  gateway');
    expect(output).toContain('  @inner{a b}');
    expect(output).toContain('}');
  });

  it('roundtrips nested groups', () => {
    const input = `@system "System" {
  @frontend "Frontend" {
    webapp
    mobile
  }
  @backend "Backend" {
    api
    worker
  }
  gateway
}`;
    const { graph, errors } = parse(input);
    expect(errors).toHaveLength(0);
    const output = graphToGlypho(graph);
    const { graph: graph2, errors: errors2 } = parse(output);
    expect(errors2).toHaveLength(0);
    expect(graph2.groups).toHaveLength(1);
    const sys = graph2.groups[0];
    expect(sys.id).toBe('system');
    expect(sys.label).toBe('System');
    expect(sys.members).toEqual(['gateway']);
    expect(sys.children).toHaveLength(2);
    expect(sys.children![0].id).toBe('frontend');
    expect(sys.children![0].members).toEqual(['webapp', 'mobile']);
    expect(sys.children![1].id).toBe('backend');
    expect(sys.children![1].members).toEqual(['api', 'worker']);
  });
});
