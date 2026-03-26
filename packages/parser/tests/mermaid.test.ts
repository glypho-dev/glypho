import { describe, it, expect } from 'vitest';
import { Lexer } from '../src/lexer.js';
import { Parser } from '../src/parser.js';
import { graphToMermaid } from '../src/mermaid.js';
import type { Graph } from '../src/types.js';

function parse(input: string): Graph {
  const tokens = new Lexer(input).tokenize();
  return new Parser(tokens).parse().graph;
}

function convert(input: string): string {
  return graphToMermaid(parse(input));
}

describe('graphToMermaid', () => {
  // ── Direction ──────────────────────────────────────────────────────────

  describe('direction', () => {
    it('maps >LR to flowchart LR', () => {
      expect(convert('>LR\na>b')).toMatch(/^flowchart LR/);
    });

    it('maps >TB to flowchart TD', () => {
      expect(convert('>TB\na>b')).toMatch(/^flowchart TD/);
    });

    it('maps >RL to flowchart RL', () => {
      expect(convert('>RL\na>b')).toMatch(/^flowchart RL/);
    });

    it('maps >BT to flowchart BT', () => {
      expect(convert('>BT\na>b')).toMatch(/^flowchart BT/);
    });

    it('defaults to TD when no direction', () => {
      expect(convert('a>b')).toMatch(/^flowchart TD/);
    });
  });

  // ── Shapes ─────────────────────────────────────────────────────────────

  describe('shapes', () => {
    it('rect → square brackets', () => {
      expect(convert('a:r Label')).toContain('a["Label"]');
    });

    it('diamond → curly braces', () => {
      expect(convert('a:d Decision')).toContain('a{"Decision"}');
    });

    it('circle → double parens', () => {
      expect(convert('a:c Start')).toContain('a(("Start"))');
    });

    it('oval → bracket-paren (stadium)', () => {
      expect(convert('a:o Status')).toContain('a(["Status"])');
    });

    it('pill → rounded parens', () => {
      expect(convert('a:p Submit')).toContain('a("Submit")');
    });

    it('hexagon → double curly braces', () => {
      expect(convert('a:h Init')).toContain('a{{"Init"}}');
    });

    it('node without shape defaults to rect', () => {
      expect(convert('a Label')).toContain('a["Label"]');
    });

    it('node with no label uses id as label', () => {
      expect(convert('a:c')).toContain('a(("a"))');
    });
  });

  // ── Edge operators ─────────────────────────────────────────────────────

  describe('edges', () => {
    it('> maps to -->', () => {
      expect(convert('a>b')).toContain('a --> b');
    });

    it('~ maps to -.->', () => {
      expect(convert('a~b')).toContain('a -.-> b');
    });

    it('= maps to ==>', () => {
      expect(convert('a=b')).toContain('a ==> b');
    });

    it('-- maps to ---', () => {
      expect(convert('a--b')).toContain('a --- b');
    });

    it('<> maps to <-->', () => {
      expect(convert('a<>b')).toContain('a <--> b');
    });
  });

  // ── Edge labels ────────────────────────────────────────────────────────

  describe('edge labels', () => {
    it('includes label with pipe syntax', () => {
      expect(convert('a>b yes')).toContain('a -->|"yes"| b');
    });

    it('handles quoted edge label', () => {
      expect(convert('a>b "go next"')).toContain('a -->|"go next"| b');
    });
  });

  // ── Groups → subgraphs ────────────────────────────────────────────────

  describe('groups', () => {
    it('converts group to subgraph block', () => {
      const result = convert('@auth{login validate}');
      expect(result).toContain('subgraph auth [auth]');
      expect(result).toContain('login');
      expect(result).toContain('validate');
      expect(result).toContain('end');
    });

    it('includes group label when present', () => {
      const result = convert('@auth "Authentication" {login mfa}');
      expect(result).toContain('subgraph auth ["Authentication"]');
    });
  });

  // ── Node colors → style directives ─────────────────────────────────────

  describe('node colors', () => {
    it('emits style directive for node color', () => {
      const result = convert('start:c Start #0f0');
      expect(result).toContain('style start fill:#0f0');
    });

    it('handles multiple colored nodes', () => {
      const result = convert('a:r A #f00\nb:r B #00f');
      expect(result).toContain('style a fill:#f00');
      expect(result).toContain('style b fill:#00f');
    });
  });

  // ── Style selectors ────────────────────────────────────────────────────

  describe('styles', () => {
    it('shape selector → classDef + class', () => {
      const result = convert('a:r A\nb:r B\n$:r{fill:#fff stroke:#333}');
      expect(result).toContain('classDef glypho_shape_r fill:#fff,stroke:#333');
      expect(result).toContain('class a,b glypho_shape_r');
    });

    it('id selector → style directive', () => {
      const result = convert('api:r API\n$#api{fill:#e0e0ff stroke:#00f}');
      expect(result).toContain('style api fill:#e0e0ff,stroke:#00f');
    });

    it('class selector → classDef', () => {
      const result = convert('a:r A\n$.highlight{fill:#ff0}\n.highlight{a}');
      expect(result).toContain('classDef highlight fill:#ff0');
      expect(result).toContain('class a highlight');
    });
  });

  // ── Multiline labels ───────────────────────────────────────────────────

  describe('multiline labels', () => {
    it('converts newlines to <br/>', () => {
      const result = convert('a:r """First\nSecond"""');
      expect(result).toContain('a["First<br/>Second"]');
    });
  });

  // ── Quote escaping ─────────────────────────────────────────────────────

  describe('label escaping', () => {
    it('escapes quotes in labels', () => {
      const graph: Graph = {
        nodes: [{ id: 'a', shape: 'r', label: 'Say "hello"' }],
        edges: [],
        groups: [],
        positions: [],
        styles: [],
      };
      const result = graphToMermaid(graph);
      expect(result).toContain('a["Say &quot;hello&quot;"]');
    });
  });

  // ── Empty / edge cases ─────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles empty graph', () => {
      const graph: Graph = {
        nodes: [],
        edges: [],
        groups: [],
        positions: [],
        styles: [],
      };
      const result = graphToMermaid(graph);
      expect(result).toBe('flowchart TD');
    });

    it('skips positions (no Mermaid equivalent)', () => {
      const result = convert('a:r A\na@100,200');
      expect(result).not.toContain('100');
      expect(result).not.toContain('200');
    });

    it('handles graph with only positions', () => {
      const result = convert('a@0,0\nb@100,100');
      // Should have node declarations (bare nodes) but no position data
      expect(result).toContain('flowchart TD');
      expect(result).not.toContain('@');
    });
  });

  // ── Integration ────────────────────────────────────────────────────────

  describe('integration', () => {
    it('converts minimal example', () => {
      const result = convert('a>b');
      expect(result).toBe('flowchart TD\n    a --> b');
    });

    it('converts flowchart example', () => {
      const result = convert(`>LR
start:c Start #0f0
login:r "Enter Credentials"
validate:d "Valid?"
start>login
login>validate
validate>login no
@auth{login validate}`);
      expect(result).toContain('flowchart LR');
      expect(result).toContain('start(("Start"))');
      expect(result).toContain('login["Enter Credentials"]');
      expect(result).toContain('validate{"Valid?"}');
      expect(result).toContain('start --> login');
      expect(result).toContain('validate -->|"no"| login');
      expect(result).toContain('subgraph auth [auth]');
      expect(result).toContain('style start fill:#0f0');
    });

    it('converts mind map example with undirected edges', () => {
      const result = convert(`>TB
project:c "Project Planning" #f0f
scope:p Scope #faa
project--scope`);
      expect(result).toContain('flowchart TD');
      expect(result).toContain('project(("Project Planning"))');
      expect(result).toContain('scope("Scope")');
      expect(result).toContain('project --- scope');
      expect(result).toContain('style project fill:#f0f');
      expect(result).toContain('style scope fill:#faa');
    });
  });
});
