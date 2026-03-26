import { describe, it, expect } from 'vitest';
import { Lexer } from '../src/lexer.js';
import { Parser } from '../src/parser.js';
import type { ParseResult } from '../src/types.js';

function parse(input: string): ParseResult {
  const tokens = new Lexer(input).tokenize();
  return new Parser(tokens).parse();
}

describe('Parser', () => {
  // ── Direction ────────────────────────────────────────────────────────

  describe('direction', () => {
    it('parses >LR', () => {
      const { graph } = parse('>LR');
      expect(graph.direction).toBe('LR');
    });

    it('parses all 4 directions', () => {
      for (const dir of ['LR', 'TB', 'RL', 'BT'] as const) {
        const { graph } = parse(`>${dir}`);
        expect(graph.direction).toBe(dir);
      }
    });

    it('reports error on invalid direction', () => {
      const { errors } = parse('>XX');
      expect(errors.length).toBeGreaterThan(0);
    });

    it('reports error on duplicate direction', () => {
      const { graph, errors } = parse('>LR\n>TB');
      expect(errors.length).toBeGreaterThan(0);
      // Second direction still applies
      expect(graph.direction).toBe('TB');
    });
  });

  // ── Nodes ────────────────────────────────────────────────────────────

  describe('nodes', () => {
    it('parses bare ID node', () => {
      const { graph } = parse('login');
      expect(graph.nodes).toHaveLength(1);
      expect(graph.nodes[0].id).toBe('login');
    });

    it('parses node with shape', () => {
      const { graph } = parse('login:r');
      expect(graph.nodes[0].shape).toBe('r');
    });

    it('parses node with shape and bare word label', () => {
      const { graph } = parse('login:r Login');
      expect(graph.nodes[0]).toMatchObject({ id: 'login', shape: 'r', label: 'Login' });
    });

    it('parses node with quoted label', () => {
      const { graph } = parse('auth:r "User Login"');
      expect(graph.nodes[0].label).toBe('User Login');
    });

    it('parses node with multiline label', () => {
      const { graph } = parse('desc:r """First\nSecond"""');
      expect(graph.nodes[0].label).toBe('First\nSecond');
    });

    it('parses node with numeric label', () => {
      const { graph } = parse('count:r 42');
      expect(graph.nodes[0].label).toBe('42');
    });

    it('parses node with color', () => {
      const { graph } = parse('start:c Start #0f0');
      expect(graph.nodes[0].color).toBe('#0f0');
    });

    it('parses all 6 shapes', () => {
      for (const shape of ['r', 'd', 'c', 'o', 'p', 'h'] as const) {
        const { graph } = parse(`n:${shape}`);
        expect(graph.nodes[0].shape).toBe(shape);
      }
    });

    it('parses node with shape, label, and 6-digit color', () => {
      const { graph } = parse('err:r Error #ff0000');
      expect(graph.nodes[0]).toMatchObject({
        id: 'err', shape: 'r', label: 'Error', color: '#ff0000',
      });
    });
  });

  // ── Edges ────────────────────────────────────────────────────────────

  describe('edges', () => {
    it('parses > edge', () => {
      const { graph } = parse('a>b');
      expect(graph.edges).toHaveLength(1);
      expect(graph.edges[0]).toMatchObject({ from: 'a', to: 'b', op: '>' });
    });

    it('parses ~ edge', () => {
      const { graph } = parse('a~b');
      expect(graph.edges[0].op).toBe('~');
    });

    it('parses = edge', () => {
      const { graph } = parse('a=b');
      expect(graph.edges[0].op).toBe('=');
    });

    it('parses -- edge', () => {
      const { graph } = parse('a--b');
      expect(graph.edges[0].op).toBe('--');
    });

    it('parses <> edge', () => {
      const { graph } = parse('a<>b');
      expect(graph.edges[0].op).toBe('<>');
    });

    it('parses edge with label', () => {
      const { graph } = parse('a>b success');
      expect(graph.edges[0].label).toBe('success');
    });

    it('parses edge with quoted label', () => {
      const { graph } = parse('a>b "1:N"');
      expect(graph.edges[0].label).toBe('1:N');
    });

    it('parses edge with color', () => {
      const { graph } = parse('a>b success #0f0');
      expect(graph.edges[0]).toMatchObject({ label: 'success', color: '#0f0' });
    });

    it('parses edge with color only (no label)', () => {
      // "a>b #0f0" — the #0f0 is a color, not a label
      // Actually in our grammar, bare word label comes first.
      // If we see # immediately, there's no label.
      const { graph } = parse('a>b #0f0');
      // The # would be parsed — but since tryParseLabel returns undefined when
      // it sees HASH, the color parsing kicks in
      expect(graph.edges[0].label).toBeUndefined();
      expect(graph.edges[0].color).toBe('#0f0');
    });
  });

  // ── Edge Chains ──────────────────────────────────────────────────────

  describe('edge chains', () => {
    it('parses 3-node chain', () => {
      const { graph } = parse('a>b>c');
      expect(graph.edges).toHaveLength(2);
      expect(graph.edges[0]).toMatchObject({ from: 'a', to: 'b', op: '>' });
      expect(graph.edges[1]).toMatchObject({ from: 'b', to: 'c', op: '>' });
    });

    it('parses 4-node chain', () => {
      const { graph } = parse('a>b>c>d');
      expect(graph.edges).toHaveLength(3);
    });

    it('parses chain with mixed operators', () => {
      const { graph } = parse('a>b--c~d');
      expect(graph.edges).toHaveLength(3);
      expect(graph.edges[0].op).toBe('>');
      expect(graph.edges[1].op).toBe('--');
      expect(graph.edges[2].op).toBe('~');
    });

    it('creates implicit nodes for chain', () => {
      const { graph } = parse('a>b>c');
      expect(graph.nodes).toHaveLength(3);
    });
  });

  // ── Groups ───────────────────────────────────────────────────────────

  describe('groups', () => {
    it('parses group without label', () => {
      const { graph } = parse('@auth{login mfa}');
      expect(graph.groups).toHaveLength(1);
      expect(graph.groups[0]).toMatchObject({
        id: 'auth', members: ['login', 'mfa'],
      });
    });

    it('parses group with label', () => {
      const { graph } = parse('@auth "Authentication" {login mfa}');
      expect(graph.groups[0]).toMatchObject({
        id: 'auth', label: 'Authentication', members: ['login', 'mfa'],
      });
    });

    it('parses empty group', () => {
      const { graph } = parse('@empty{}');
      expect(graph.groups[0].members).toEqual([]);
    });

    it('parses multiple groups', () => {
      const { graph } = parse('@a{x y}\n@b{z}');
      expect(graph.groups).toHaveLength(2);
    });
  });

  // ── Class Assignments ───────────────────────────────────────────────

  describe('class assignments', () => {
    it('parses a class assignment', () => {
      const { graph } = parse('.highlight{login mfa}');
      expect(graph.nodes.find(n => n.id === 'login')?.classes).toEqual(['highlight']);
      expect(graph.nodes.find(n => n.id === 'mfa')?.classes).toEqual(['highlight']);
    });

    it('merges repeated class assignments without duplicates', () => {
      const { graph } = parse('.highlight{login}\n.highlight{login mfa}');
      expect(graph.nodes.find(n => n.id === 'login')?.classes).toEqual(['highlight']);
      expect(graph.nodes.find(n => n.id === 'mfa')?.classes).toEqual(['highlight']);
    });
  });

  // ── Positions ────────────────────────────────────────────────────────

  describe('positions', () => {
    it('parses basic position', () => {
      const { graph } = parse('login@100,200');
      expect(graph.positions).toHaveLength(1);
      expect(graph.positions[0]).toMatchObject({ id: 'login', x: 100, y: 200 });
    });

    it('parses position with size', () => {
      const { graph } = parse('login@100,200^120x40');
      expect(graph.positions[0]).toMatchObject({
        id: 'login', x: 100, y: 200, width: 120, height: 40,
      });
    });
  });

  // ── Styles ───────────────────────────────────────────────────────────

  describe('styles', () => {
    it('parses :shape selector', () => {
      const { graph } = parse('$:r{fill:#fff}');
      expect(graph.styles[0].selector).toBe(':r');
      expect(graph.styles[0].properties).toEqual({ fill: '#fff' });
    });

    it('parses .class selector', () => {
      const { graph } = parse('$.highlight{fill:#ff0}');
      expect(graph.styles[0].selector).toBe('.highlight');
    });

    it('parses #id selector', () => {
      const { graph } = parse('$#api{fill:#e0e0ff}');
      expect(graph.styles[0].selector).toBe('#api');
    });

    it('parses multiple properties', () => {
      const { graph } = parse('$:r{fill:#fff stroke:#333 stroke-width:2}');
      expect(graph.styles[0].properties).toEqual({
        fill: '#fff',
        stroke: '#333',
        'stroke-width': '2',
      });
    });

    it('parses quoted property value', () => {
      const { graph } = parse('$:r{font-family:"Helvetica Neue"}');
      expect(graph.styles[0].properties['font-family']).toBe('Helvetica Neue');
    });
  });

  // ── Implicit Nodes ───────────────────────────────────────────────────

  describe('implicit nodes', () => {
    it('creates implicit nodes from edges', () => {
      const { graph } = parse('a>b');
      expect(graph.nodes).toHaveLength(2);
      expect(graph.nodes.map(n => n.id)).toContain('a');
      expect(graph.nodes.map(n => n.id)).toContain('b');
    });

    it('merges explicit node over implicit', () => {
      const { graph } = parse('a>b\na:r Login #0f0');
      const a = graph.nodes.find(n => n.id === 'a')!;
      expect(a.shape).toBe('r');
      expect(a.label).toBe('Login');
      expect(a.color).toBe('#0f0');
    });
  });

  // ── Comments and Blanks ──────────────────────────────────────────────

  describe('comments and blanks', () => {
    it('ignores comments', () => {
      const { graph } = parse('// comment\na>b');
      expect(graph.edges).toHaveLength(1);
    });

    it('ignores blank lines', () => {
      const { graph } = parse('\n\na>b\n\n');
      expect(graph.edges).toHaveLength(1);
    });
  });

  // ── Nested Groups ──────────────────────────────────────────────────

  describe('nested groups', () => {
    it('parses a group with nested children', () => {
      const input = `@outer "Outer" {
  a
  @inner "Inner" {
    b
    c
  }
}`;
      const { graph, errors } = parse(input);
      expect(errors).toHaveLength(0);
      expect(graph.groups).toHaveLength(1);
      const outer = graph.groups[0];
      expect(outer.id).toBe('outer');
      expect(outer.label).toBe('Outer');
      expect(outer.members).toEqual(['a']);
      expect(outer.children).toHaveLength(1);
      const inner = outer.children![0];
      expect(inner.id).toBe('inner');
      expect(inner.label).toBe('Inner');
      expect(inner.members).toEqual(['b', 'c']);
    });

    it('parses 3-level nesting', () => {
      const input = `@l1 {
  @l2 {
    @l3 {
      x
    }
    y
  }
  z
}`;
      const { graph, errors } = parse(input);
      expect(errors).toHaveLength(0);
      expect(graph.groups).toHaveLength(1);
      const l1 = graph.groups[0];
      expect(l1.members).toEqual(['z']);
      expect(l1.children).toHaveLength(1);
      const l2 = l1.children![0];
      expect(l2.members).toEqual(['y']);
      expect(l2.children).toHaveLength(1);
      const l3 = l2.children![0];
      expect(l3.members).toEqual(['x']);
      expect(l3.children).toBeUndefined();
    });

    it('single-line flat groups still work', () => {
      const { graph, errors } = parse('@auth{login mfa}');
      expect(errors).toHaveLength(0);
      expect(graph.groups).toHaveLength(1);
      expect(graph.groups[0].members).toEqual(['login', 'mfa']);
      expect(graph.groups[0].children).toBeUndefined();
    });

    it('parses multiple nested children at same level', () => {
      const input = `@system {
  @frontend {
    webapp
  }
  @backend {
    api
  }
  gateway
}`;
      const { graph, errors } = parse(input);
      expect(errors).toHaveLength(0);
      expect(graph.groups).toHaveLength(1);
      const system = graph.groups[0];
      expect(system.members).toEqual(['gateway']);
      expect(system.children).toHaveLength(2);
      expect(system.children![0].id).toBe('frontend');
      expect(system.children![0].members).toEqual(['webapp']);
      expect(system.children![1].id).toBe('backend');
      expect(system.children![1].members).toEqual(['api']);
    });
  });

  // ── Error Recovery ───────────────────────────────────────────────────

  describe('error recovery', () => {
    it('continues parsing after error', () => {
      const { graph, errors } = parse('>INVALID\na>b');
      expect(errors.length).toBeGreaterThan(0);
      expect(graph.edges).toHaveLength(1);
    });
  });
});
