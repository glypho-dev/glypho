import { describe, it, expect } from 'vitest';
import { parseMermaid } from '../src/mermaid-to-glypho.js';

describe('parseMermaid', () => {
  // ── Header parsing ──────────────────────────────────────────────────────

  describe('header parsing', () => {
    it('parses "flowchart LR" header', () => {
      const { graph, errors } = parseMermaid('flowchart LR\n  A --> B');
      expect(graph.direction).toBe('LR');
      expect(errors).toHaveLength(0);
    });

    it('parses "graph TD" header', () => {
      const { graph, errors } = parseMermaid('graph TD\n  A --> B');
      expect(graph.direction).toBe('TB');
      expect(errors).toHaveLength(0);
    });

    it('parses bare "flowchart" header without direction', () => {
      const { graph, errors } = parseMermaid('flowchart\n  A --> B');
      expect(graph.direction).toBeUndefined();
      expect(errors).toHaveLength(0);
    });

    it('reports error when header is missing', () => {
      const { errors } = parseMermaid('A --> B');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toMatch(/Expected flowchart\/graph header/);
    });
  });

  // ── Direction mapping ───────────────────────────────────────────────────

  describe('direction mapping', () => {
    it('maps LR to LR', () => {
      expect(parseMermaid('flowchart LR\nA').graph.direction).toBe('LR');
    });

    it('maps TD to TB', () => {
      expect(parseMermaid('flowchart TD\nA').graph.direction).toBe('TB');
    });

    it('maps RL to RL', () => {
      expect(parseMermaid('flowchart RL\nA').graph.direction).toBe('RL');
    });

    it('maps BT to BT', () => {
      expect(parseMermaid('flowchart BT\nA').graph.direction).toBe('BT');
    });
  });

  // ── Node shapes ─────────────────────────────────────────────────────────

  describe('node shapes', () => {
    it('parses A["label"] as rect (r)', () => {
      const { graph } = parseMermaid('flowchart LR\n  A["label"]');
      const node = graph.nodes.find(n => n.id === 'A');
      expect(node).toBeDefined();
      expect(node!.shape).toBe('r');
      expect(node!.label).toBe('label');
    });

    it('parses A{"label"} as diamond (d)', () => {
      const { graph } = parseMermaid('flowchart LR\n  A{"label"}');
      const node = graph.nodes.find(n => n.id === 'A');
      expect(node!.shape).toBe('d');
      expect(node!.label).toBe('label');
    });

    it('parses A(("label")) as circle (c)', () => {
      const { graph } = parseMermaid('flowchart LR\n  A(("label"))');
      const node = graph.nodes.find(n => n.id === 'A');
      expect(node!.shape).toBe('c');
      expect(node!.label).toBe('label');
    });

    it('parses A(["label"]) as oval (o)', () => {
      const { graph } = parseMermaid('flowchart LR\n  A(["label"])');
      const node = graph.nodes.find(n => n.id === 'A');
      expect(node!.shape).toBe('o');
      expect(node!.label).toBe('label');
    });

    it('parses A("label") as pill (p)', () => {
      const { graph } = parseMermaid('flowchart LR\n  A("label")');
      const node = graph.nodes.find(n => n.id === 'A');
      expect(node!.shape).toBe('p');
      expect(node!.label).toBe('label');
    });

    it('parses A{{"label"}} as hexagon (h)', () => {
      const { graph } = parseMermaid('flowchart LR\n  A{{"label"}}');
      const node = graph.nodes.find(n => n.id === 'A');
      expect(node!.shape).toBe('h');
      expect(node!.label).toBe('label');
    });

    it('parses A[label] as rect without quotes', () => {
      const { graph } = parseMermaid('flowchart LR\n  A[label]');
      const node = graph.nodes.find(n => n.id === 'A');
      expect(node!.shape).toBe('r');
      expect(node!.label).toBe('label');
    });

    it('parses bare A with no shape', () => {
      const { graph } = parseMermaid('flowchart LR\n  A');
      const node = graph.nodes.find(n => n.id === 'A');
      expect(node).toBeDefined();
      expect(node!.shape).toBeUndefined();
      expect(node!.label).toBeUndefined();
    });
  });

  // ── Edges ───────────────────────────────────────────────────────────────

  describe('edges', () => {
    it('maps --> to >', () => {
      const { graph } = parseMermaid('flowchart LR\n  A --> B');
      expect(graph.edges).toHaveLength(1);
      expect(graph.edges[0]).toMatchObject({ from: 'A', to: 'B', op: '>' });
    });

    it('maps -.-> to ~', () => {
      const { graph } = parseMermaid('flowchart LR\n  A -.-> B');
      expect(graph.edges[0]).toMatchObject({ from: 'A', to: 'B', op: '~' });
    });

    it('maps ==> to =', () => {
      const { graph } = parseMermaid('flowchart LR\n  A ==> B');
      expect(graph.edges[0]).toMatchObject({ from: 'A', to: 'B', op: '=' });
    });

    it('maps --- to --', () => {
      const { graph } = parseMermaid('flowchart LR\n  A --- B');
      expect(graph.edges[0]).toMatchObject({ from: 'A', to: 'B', op: '--' });
    });

    it('maps <--> to <>', () => {
      const { graph } = parseMermaid('flowchart LR\n  A <--> B');
      expect(graph.edges[0]).toMatchObject({ from: 'A', to: 'B', op: '<>' });
    });
  });

  // ── Edge labels ─────────────────────────────────────────────────────────

  describe('edge labels', () => {
    it('parses quoted edge label with |"label"|', () => {
      const { graph } = parseMermaid('flowchart LR\n  A -->|"yes"| B');
      expect(graph.edges[0]).toMatchObject({ from: 'A', to: 'B', op: '>', label: 'yes' });
    });

    it('parses unquoted edge label with |label|', () => {
      const { graph } = parseMermaid('flowchart LR\n  A -->|yes| B');
      expect(graph.edges[0]).toMatchObject({ from: 'A', to: 'B', op: '>', label: 'yes' });
    });
  });

  // ── Chain syntax ────────────────────────────────────────────────────────

  describe('chain syntax', () => {
    it('parses A --> B --> C as 2 edges', () => {
      const { graph } = parseMermaid('flowchart LR\n  A --> B --> C');
      expect(graph.edges).toHaveLength(2);
      expect(graph.edges[0]).toMatchObject({ from: 'A', to: 'B', op: '>' });
      expect(graph.edges[1]).toMatchObject({ from: 'B', to: 'C', op: '>' });
    });
  });

  // ── Subgraphs ──────────────────────────────────────────────────────────

  describe('subgraphs', () => {
    it('parses subgraph with quoted label into Group', () => {
      const input = `flowchart LR
  subgraph auth ["Authentication"]
    login
    validate
  end`;
      const { graph, errors } = parseMermaid(input);
      expect(errors).toHaveLength(0);
      expect(graph.groups).toHaveLength(1);
      expect(graph.groups[0]).toMatchObject({
        id: 'auth',
        label: 'Authentication',
        members: ['login', 'validate'],
      });
    });

    it('parses subgraph with bare name (no label)', () => {
      const input = `flowchart LR
  subgraph backend
    api
    db
  end`;
      const { graph } = parseMermaid(input);
      expect(graph.groups).toHaveLength(1);
      expect(graph.groups[0].id).toBe('backend');
      expect(graph.groups[0].members).toEqual(['api', 'db']);
    });
  });

  // ── Style directives ───────────────────────────────────────────────────

  describe('style directives', () => {
    it('single fill property sets node color', () => {
      const { graph } = parseMermaid('flowchart LR\n  A\n  style A fill:#fff');
      const node = graph.nodes.find(n => n.id === 'A');
      expect(node!.color).toBe('#fff');
    });

    it('multiple properties produce a Style entry', () => {
      const { graph } = parseMermaid('flowchart LR\n  A\n  style A fill:#fff,stroke:#333');
      expect(graph.styles).toHaveLength(1);
      expect(graph.styles[0]).toMatchObject({
        selector: '#A',
        properties: { fill: '#fff', stroke: '#333' },
      });
    });
  });

  // ── classDef ────────────────────────────────────────────────────────────

  describe('classDef', () => {
    it('creates a Style with dot-prefixed selector', () => {
      const { graph } = parseMermaid('flowchart LR\n  classDef highlight fill:#ff0');
      expect(graph.styles).toHaveLength(1);
      expect(graph.styles[0]).toMatchObject({
        selector: '.highlight',
        properties: { fill: '#ff0' },
      });
    });

    it('maps Glypho shape classes back to :shape selectors', () => {
      const { graph } = parseMermaid('flowchart LR\n  classDef glypho_shape_r fill:#ff0');
      expect(graph.styles[0]).toMatchObject({
        selector: ':r',
        properties: { fill: '#ff0' },
      });
    });
  });

  describe('class directives', () => {
    it('assigns classes to nodes', () => {
      const { graph } = parseMermaid('flowchart LR\n  A["Start"]\n  class A highlight');
      expect(graph.nodes.find(n => n.id === 'A')?.classes).toEqual(['highlight']);
    });

    it('ignores Glypho shape helper classes', () => {
      const { graph } = parseMermaid('flowchart LR\n  A["Start"]\n  class A glypho_shape_r');
      expect(graph.nodes.find(n => n.id === 'A')?.classes).toBeUndefined();
    });
  });

  // ── Semicolons ─────────────────────────────────────────────────────────

  describe('semicolons', () => {
    it('splits statements on semicolons', () => {
      const { graph } = parseMermaid('flowchart LR\n  A --> B; C --> D');
      expect(graph.edges).toHaveLength(2);
      expect(graph.edges[0]).toMatchObject({ from: 'A', to: 'B' });
      expect(graph.edges[1]).toMatchObject({ from: 'C', to: 'D' });
    });
  });

  // ── Comments ────────────────────────────────────────────────────────────

  describe('comments', () => {
    it('ignores %% comments', () => {
      const { graph } = parseMermaid('flowchart LR\n  A --> B %% this is a comment');
      expect(graph.edges).toHaveLength(1);
      expect(graph.edges[0]).toMatchObject({ from: 'A', to: 'B', op: '>' });
      // The comment text should not appear as a node
      const nodeIds = graph.nodes.map(n => n.id);
      expect(nodeIds).not.toContain('this');
      expect(nodeIds).not.toContain('comment');
    });
  });

  // ── Error handling ──────────────────────────────────────────────────────

  describe('error handling', () => {
    it('reports error for unclosed subgraph', () => {
      const { errors, graph } = parseMermaid('flowchart LR\n  subgraph auth\n    A');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.message.includes('never closed'))).toBe(true);
      // The unclosed subgraph should still be included in groups
      expect(graph.groups).toHaveLength(1);
    });

    it('reports error for missing target after edge operator', () => {
      const { errors } = parseMermaid('flowchart LR\n  A -->');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.message.includes('Expected node after edge operator'))).toBe(true);
    });

    it('reports unsupported subgraph direction directives without corrupting the graph', () => {
      const { errors, graph } = parseMermaid(`flowchart LR
  subgraph auth
    direction TB
    A --> B
  end`);

      expect(errors.some(e => e.message.includes('Subgraph direction directives are not supported'))).toBe(true);
      expect(graph.nodes.map(n => n.id)).toEqual(['A', 'B']);
      expect(graph.groups).toHaveLength(1);
      expect(graph.groups[0].members).toEqual(['A', 'B']);
    });

    it('reports unexpected top-level direction directives after the header', () => {
      const { errors, graph } = parseMermaid('flowchart LR\n  direction TB\n  A --> B');
      expect(errors.some(e => e.message.includes('Unexpected direction directive after flowchart header'))).toBe(true);
      expect(graph.nodes.map(n => n.id)).toEqual(['A', 'B']);
      expect(graph.edges).toHaveLength(1);
    });
  });

  // ── Full integration ───────────────────────────────────────────────────

  describe('full integration', () => {
    it('parses a complete Mermaid flowchart', () => {
      const input = `flowchart LR
  start(("Start"))
  login["Enter Credentials"]
  validate{"Valid?"}
  dashboard["Dashboard"]
  start --> login
  login --> validate
  validate -->|"yes"| dashboard
  validate -->|"no"| login
  subgraph auth ["Auth Flow"]
    login
    validate
  end
  style start fill:#0f0
  classDef important fill:#f00,stroke:#900`;

      const { graph, errors } = parseMermaid(input);

      // No errors expected
      expect(errors).toHaveLength(0);

      // Direction
      expect(graph.direction).toBe('LR');

      // Nodes
      expect(graph.nodes.length).toBeGreaterThanOrEqual(4);
      const start = graph.nodes.find(n => n.id === 'start');
      expect(start).toMatchObject({ id: 'start', shape: 'c', label: 'Start' });
      const login = graph.nodes.find(n => n.id === 'login');
      expect(login).toMatchObject({ id: 'login', shape: 'r', label: 'Enter Credentials' });
      const validate = graph.nodes.find(n => n.id === 'validate');
      expect(validate).toMatchObject({ id: 'validate', shape: 'd', label: 'Valid?' });

      // Edges
      expect(graph.edges).toHaveLength(4);
      expect(graph.edges[0]).toMatchObject({ from: 'start', to: 'login', op: '>' });
      expect(graph.edges[2]).toMatchObject({ from: 'validate', to: 'dashboard', op: '>', label: 'yes' });
      expect(graph.edges[3]).toMatchObject({ from: 'validate', to: 'login', op: '>', label: 'no' });

      // Groups
      expect(graph.groups).toHaveLength(1);
      expect(graph.groups[0]).toMatchObject({
        id: 'auth',
        label: 'Auth Flow',
      });
      expect(graph.groups[0].members).toContain('login');
      expect(graph.groups[0].members).toContain('validate');

      // Node color from style directive (single fill)
      expect(start!.color).toBe('#0f0');

      // classDef → Style
      const importantStyle = graph.styles.find(s => s.selector === '.important');
      expect(importantStyle).toBeDefined();
      expect(importantStyle!.properties).toEqual({ fill: '#f00', stroke: '#900' });

      // Positions always empty (Mermaid has no position syntax)
      expect(graph.positions).toHaveLength(0);
    });
  });

  // ── Delimiter-aware parsing ────────────────────────────────────────────

  describe('delimiter-aware parsing', () => {
    it('does not match edge operators inside quoted labels', () => {
      const { graph, errors } = parseMermaid('flowchart LR\n  A["a --> b"] --> C');
      expect(errors).toHaveLength(0);
      expect(graph.edges).toHaveLength(1);
      expect(graph.edges[0]).toMatchObject({ from: 'A', to: 'C', op: '>' });
      expect(graph.nodes.find(n => n.id === 'A')!.label).toBe('a --> b');
    });

    it('does not match edge operators inside unquoted bracket labels', () => {
      const { graph, errors } = parseMermaid('flowchart LR\n  A[a --> b] --> C');
      expect(errors).toHaveLength(0);
      expect(graph.edges).toHaveLength(1);
      expect(graph.edges[0]).toMatchObject({ from: 'A', to: 'C' });
    });

    it('handles semicolons inside quoted labels', () => {
      const { graph, errors } = parseMermaid('flowchart LR\n  A["hello;world"] --> B');
      expect(errors).toHaveLength(0);
      expect(graph.nodes.find(n => n.id === 'A')!.label).toBe('hello;world');
      expect(graph.edges).toHaveLength(1);
    });

    it('handles %% inside quoted labels', () => {
      const { graph } = parseMermaid('flowchart LR\n  A["100%%"] --> B');
      expect(graph.nodes.find(n => n.id === 'A')!.label).toBe('100%%');
      expect(graph.edges).toHaveLength(1);
    });

    it('handles labels containing close delimiter chars', () => {
      const { graph } = parseMermaid('flowchart LR\n  A["has ] bracket"]');
      expect(graph.nodes.find(n => n.id === 'A')!.label).toBe('has ] bracket');
    });
  });

  // ── Robustness ──────────────────────────────────────────────────────────

  describe('robustness', () => {
    it('handles a 10000+ node edge chain without stack overflow', () => {
      const count = 10_001;
      const nodeIds = Array.from({ length: count }, (_, i) => `N${i}`);
      const chain = nodeIds.join(' --> ');
      const input = `flowchart LR\n  ${chain}`;

      const { graph, errors } = parseMermaid(input);

      expect(errors).toHaveLength(0);
      expect(graph.nodes).toHaveLength(count);
      expect(graph.edges).toHaveLength(count - 1);
      expect(graph.edges[0]).toMatchObject({ from: 'N0', to: 'N1', op: '>' });
      expect(graph.edges[count - 2]).toMatchObject({ from: `N${count - 2}`, to: `N${count - 1}`, op: '>' });
    });
  });

  // ── Nested subgraphs ──────────────────────────────────────────────────

  describe('nested subgraphs', () => {
    it('preserves nested subgraph hierarchy', () => {
      const input = `flowchart LR
  subgraph outer ["Outer"]
    subgraph inner ["Inner"]
      A
      B
    end
    C
  end`;
      const { graph, errors } = parseMermaid(input);
      expect(errors).toHaveLength(0);
      expect(graph.groups).toHaveLength(1);
      const outer = graph.groups[0];
      expect(outer.id).toBe('outer');
      expect(outer.members).toContain('C');
      expect(outer.children).toHaveLength(1);
      const inner = outer.children![0];
      expect(inner.id).toBe('inner');
      expect(inner.members).toContain('A');
      expect(inner.members).toContain('B');
    });

    it('handles 3-level Mermaid nesting', () => {
      const input = `flowchart TD
  subgraph l1
    subgraph l2
      subgraph l3
        X
      end
      Y
    end
    Z
  end`;
      const { graph, errors } = parseMermaid(input);
      expect(errors).toHaveLength(0);
      expect(graph.groups).toHaveLength(1);
      expect(graph.groups[0].children).toHaveLength(1);
      expect(graph.groups[0].children![0].children).toHaveLength(1);
      expect(graph.groups[0].children![0].children![0].members).toContain('X');
    });
  });
});
