import { describe, it, expect } from 'vitest';
import { parseDot } from '../src/dot-to-glypho.js';

describe('parseDot', () => {
  describe('graph header', () => {
    it('parses digraph', () => {
      const { graph, errors } = parseDot('digraph { a -> b; }');
      expect(errors).toHaveLength(0);
      expect(graph.edges).toHaveLength(1);
      expect(graph.edges[0].op).toBe('>');
    });

    it('parses undirected graph', () => {
      const { graph, errors } = parseDot('graph { a -- b; }');
      expect(errors).toHaveLength(0);
      expect(graph.edges[0].op).toBe('--');
    });

    it('parses named graph', () => {
      const { graph, errors } = parseDot('digraph G { a -> b; }');
      expect(errors).toHaveLength(0);
      expect(graph.edges).toHaveLength(1);
    });

    it('parses quoted graph name', () => {
      const { graph, errors } = parseDot('digraph "My Graph" { a -> b; }');
      expect(errors).toHaveLength(0);
      expect(graph.edges).toHaveLength(1);
    });

    it('parses strict digraph', () => {
      const { graph, errors } = parseDot('strict digraph { a -> b; }');
      expect(errors).toHaveLength(0);
      expect(graph.edges).toHaveLength(1);
    });

    it('errors on missing graph declaration', () => {
      const { errors } = parseDot('a -> b');
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('direction', () => {
    it('parses rankdir=LR', () => {
      const { graph } = parseDot('digraph { rankdir=LR; a -> b; }');
      expect(graph.direction).toBe('LR');
    });

    it('parses rankdir=TB', () => {
      const { graph } = parseDot('digraph { rankdir=TB; a -> b; }');
      expect(graph.direction).toBe('TB');
    });

    it('parses rankdir=RL', () => {
      const { graph } = parseDot('digraph { rankdir=RL; }');
      expect(graph.direction).toBe('RL');
    });

    it('parses rankdir=BT', () => {
      const { graph } = parseDot('digraph { rankdir=BT; }');
      expect(graph.direction).toBe('BT');
    });

    it('parses quoted rankdir', () => {
      const { graph } = parseDot('digraph { rankdir="LR"; }');
      expect(graph.direction).toBe('LR');
    });
  });

  describe('nodes', () => {
    it('parses bare node', () => {
      const { graph } = parseDot('digraph { myNode; }');
      expect(graph.nodes).toHaveLength(1);
      expect(graph.nodes[0].id).toBe('myNode');
    });

    it('parses node with label', () => {
      const { graph } = parseDot('digraph { a [label="Hello World"]; }');
      expect(graph.nodes[0].label).toBe('Hello World');
    });

    it('maps box shape to rect', () => {
      const { graph } = parseDot('digraph { a [shape=box]; }');
      expect(graph.nodes[0].shape).toBe('r');
    });

    it('maps diamond shape', () => {
      const { graph } = parseDot('digraph { a [shape=diamond]; }');
      expect(graph.nodes[0].shape).toBe('d');
    });

    it('maps circle shape', () => {
      const { graph } = parseDot('digraph { a [shape=circle]; }');
      expect(graph.nodes[0].shape).toBe('c');
    });

    it('maps ellipse shape to oval', () => {
      const { graph } = parseDot('digraph { a [shape=ellipse]; }');
      expect(graph.nodes[0].shape).toBe('o');
    });

    it('maps hexagon shape', () => {
      const { graph } = parseDot('digraph { a [shape=hexagon]; }');
      expect(graph.nodes[0].shape).toBe('h');
    });

    it('maps rounded box to pill', () => {
      const { graph } = parseDot('digraph { a [shape=box, style="rounded"]; }');
      expect(graph.nodes[0].shape).toBe('p');
    });

    it('parses fillcolor as node color', () => {
      const { graph } = parseDot('digraph { a [fillcolor="#ff0000", style=filled]; }');
      expect(graph.nodes[0].color).toBe('#ff0000');
    });

    it('parses multiple node attributes', () => {
      const { graph } = parseDot('digraph { a [label="Start", shape=box, fillcolor="#0f0", style=filled]; }');
      const node = graph.nodes[0];
      expect(node.label).toBe('Start');
      expect(node.shape).toBe('r');
      expect(node.color).toBe('#0f0');
    });
  });

  describe('edges', () => {
    it('parses directed edge', () => {
      const { graph } = parseDot('digraph { a -> b; }');
      expect(graph.edges[0]).toMatchObject({ from: 'a', to: 'b', op: '>' });
    });

    it('parses undirected edge', () => {
      const { graph } = parseDot('graph { a -- b; }');
      expect(graph.edges[0]).toMatchObject({ from: 'a', to: 'b', op: '--' });
    });

    it('parses edge chain: a -> b -> c', () => {
      const { graph } = parseDot('digraph { a -> b -> c; }');
      expect(graph.edges).toHaveLength(2);
      expect(graph.edges[0]).toMatchObject({ from: 'a', to: 'b' });
      expect(graph.edges[1]).toMatchObject({ from: 'b', to: 'c' });
    });

    it('parses edge with label', () => {
      const { graph } = parseDot('digraph { a -> b [label="yes"]; }');
      expect(graph.edges[0].label).toBe('yes');
    });

    it('parses dashed edge', () => {
      const { graph } = parseDot('digraph { a -> b [style=dashed]; }');
      expect(graph.edges[0].op).toBe('~');
    });

    it('parses bold edge', () => {
      const { graph } = parseDot('digraph { a -> b [style=bold]; }');
      expect(graph.edges[0].op).toBe('=');
    });

    it('parses bidirectional edge', () => {
      const { graph } = parseDot('digraph { a -> b [dir=both]; }');
      expect(graph.edges[0].op).toBe('<>');
    });

    it('parses edge color', () => {
      const { graph } = parseDot('digraph { a -> b [color="red"]; }');
      expect(graph.edges[0].color).toBe('red');
    });
  });

  describe('subgraphs / groups', () => {
    it('parses subgraph as group', () => {
      const { graph } = parseDot(`digraph {
        subgraph cluster_auth {
          label="Auth";
          login; mfa;
        }
      }`);
      expect(graph.groups).toHaveLength(1);
      expect(graph.groups[0].id).toBe('auth');
      expect(graph.groups[0].label).toBe('Auth');
      expect(graph.groups[0].members).toContain('login');
      expect(graph.groups[0].members).toContain('mfa');
    });

    it('strips cluster_ prefix from group id', () => {
      const { graph } = parseDot(`digraph {
        subgraph cluster_backend {
          a; b;
        }
      }`);
      expect(graph.groups[0].id).toBe('backend');
    });

    it('puts nodes from edges into parent group', () => {
      const { graph } = parseDot(`digraph {
        subgraph cluster_flow {
          label="Flow";
          a -> b;
        }
      }`);
      expect(graph.groups[0].members).toContain('a');
      expect(graph.groups[0].members).toContain('b');
    });
  });

  describe('comments', () => {
    it('strips // line comments', () => {
      const { graph, errors } = parseDot(`digraph {
        // This is a comment
        a -> b;
      }`);
      expect(errors).toHaveLength(0);
      expect(graph.edges).toHaveLength(1);
    });

    it('strips /* block comments */', () => {
      const { graph, errors } = parseDot(`digraph {
        /* multi
           line
           comment */
        a -> b;
      }`);
      expect(errors).toHaveLength(0);
      expect(graph.edges).toHaveLength(1);
    });

    it('strips # comments', () => {
      const { graph, errors } = parseDot(`digraph {
        # hash comment
        a -> b;
      }`);
      expect(errors).toHaveLength(0);
      expect(graph.edges).toHaveLength(1);
    });
  });

  describe('roundtrip: graphToDot output → parseDot', () => {
    it('roundtrips a simple graph', async () => {
      const { graphToDot } = await import('../src/dot.js');
      const original = {
        direction: 'LR' as const,
        nodes: [
          { id: 'a', shape: 'r' as const, label: 'Start' },
          { id: 'b', shape: 'd' as const, label: 'Check' },
          { id: 'c', shape: 'r' as const, label: 'End' },
        ],
        edges: [
          { from: 'a', to: 'b', op: '>' as const, label: 'begin' },
          { from: 'b', to: 'c', op: '>' as const, label: 'done' },
        ],
        groups: [],
        positions: [],
        styles: [],
      };

      const dot = graphToDot(original);
      const { graph, errors } = parseDot(dot);

      expect(errors).toHaveLength(0);
      expect(graph.direction).toBe('LR');
      expect(graph.nodes).toHaveLength(3);
      expect(graph.edges).toHaveLength(2);

      const nodeA = graph.nodes.find(n => n.id === 'a');
      expect(nodeA?.label).toBe('Start');
      expect(nodeA?.shape).toBe('r');

      const nodeB = graph.nodes.find(n => n.id === 'b');
      expect(nodeB?.shape).toBe('d');
    });

    it('roundtrips groups', async () => {
      const { graphToDot } = await import('../src/dot.js');
      const original = {
        nodes: [
          { id: 'x', shape: 'r' as const },
          { id: 'y', shape: 'c' as const },
          { id: 'z', shape: 'r' as const },
        ],
        edges: [{ from: 'x', to: 'y', op: '>' as const }],
        groups: [{ id: 'g1', label: 'Group One', members: ['x', 'y'] }],
        positions: [],
        styles: [],
      };

      const dot = graphToDot(original);
      const { graph, errors } = parseDot(dot);

      expect(errors).toHaveLength(0);
      expect(graph.groups).toHaveLength(1);
      expect(graph.groups[0].id).toBe('g1');
      expect(graph.groups[0].label).toBe('Group One');
      expect(graph.groups[0].members).toContain('x');
      expect(graph.groups[0].members).toContain('y');
    });

    it('roundtrips edge styles', async () => {
      const { graphToDot } = await import('../src/dot.js');
      const original = {
        nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }],
        edges: [
          { from: 'a', to: 'b', op: '~' as const },
          { from: 'b', to: 'c', op: '=' as const },
          { from: 'c', to: 'd', op: '<>' as const },
        ],
        groups: [],
        positions: [],
        styles: [],
      };

      const dot = graphToDot(original);
      const { graph, errors } = parseDot(dot);

      expect(errors).toHaveLength(0);
      expect(graph.edges[0].op).toBe('~');
      expect(graph.edges[1].op).toBe('=');
      expect(graph.edges[2].op).toBe('<>');
    });
  });

  describe('skips DOT keywords', () => {
    it('ignores node/edge/graph attribute statements', () => {
      const { graph } = parseDot(`digraph {
        node [shape=box];
        edge [color=red];
        graph [bgcolor=white];
        a -> b;
      }`);
      // Should not have "node", "edge", or "graph" as node IDs
      const ids = graph.nodes.map(n => n.id);
      expect(ids).not.toContain('node');
      expect(ids).not.toContain('edge');
      expect(ids).not.toContain('graph');
      expect(ids).toContain('a');
      expect(ids).toContain('b');
    });
  });

  describe('escaped labels', () => {
    it('handles escaped quotes in labels', () => {
      const { graph } = parseDot('digraph { a [label="say \\"hello\\""]; }');
      expect(graph.nodes[0].label).toBe('say "hello"');
    });

    it('handles newlines in labels', () => {
      const { graph } = parseDot('digraph { a [label="line1\\nline2"]; }');
      expect(graph.nodes[0].label).toBe('line1\nline2');
    });
  });

  // ── Nested subgraphs ──────────────────────────────────────────────────

  describe('nested subgraphs', () => {
    it('preserves nested DOT subgraph hierarchy', () => {
      const input = `digraph {
  subgraph cluster_outer {
    label="Outer"
    subgraph cluster_inner {
      label="Inner"
      a
      b
    }
    c
  }
}`;
      const { graph, errors } = parseDot(input);
      expect(errors).toHaveLength(0);
      expect(graph.groups).toHaveLength(1);
      const outer = graph.groups[0];
      expect(outer.id).toBe('outer');
      expect(outer.label).toBe('Outer');
      expect(outer.members).toContain('c');
      expect(outer.children).toHaveLength(1);
      const inner = outer.children![0];
      expect(inner.id).toBe('inner');
      expect(inner.label).toBe('Inner');
      expect(inner.members).toContain('a');
      expect(inner.members).toContain('b');
    });
  });
});
