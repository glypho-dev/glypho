// Regression tests for bugs found in the 2026-10 / 2026-11 parser reviews.
// Each describe block matches one reported problem.
import { describe, it, expect } from 'vitest';
import {
  parse, parseMermaid, parseDot,
  graphToGlypho, graphToDot, graphToMermaid, graphToJsonCanvas,
} from '../src/index.js';
import { Lexer, TokenType } from '../src/lexer.js';
import { Parser } from '../src/parser.js';
import type { Graph, Node } from '../src/types.js';

function graphOf(nodes: Node[], extra: Partial<Graph> = {}): Graph {
  return { nodes, edges: [], groups: [], positions: [], styles: [], ...extra };
}

describe('unterminated strings and escapes', () => {
  it('reports an unterminated quoted string at its opening quote', () => {
    const { errors } = parse('a:r "foo bar\nb:r x');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ line: 1, column: 5 });
    expect(errors[0].message).toMatch(/Unterminated string/);
  });

  it('reports an unclosed triple-quoted string instead of swallowing the file', () => {
    const { errors } = parse('x:r ok\na:r """foo\nb\nc');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ line: 2, column: 5 });
    expect(errors[0].message).toMatch(/Unterminated multiline string/);
  });

  it('does not produce "undefined" for a backslash at EOF', () => {
    const { graph, errors } = parse('a:r "abc\\');
    expect(graph.nodes[0].label).toBe('abc');
    expect(errors[0].message).toMatch(/Unterminated string/);
  });

  it('keeps line numbers right after a backslash before a line break', () => {
    const { errors } = parse('a:r "x\\\nb:r ok\nc:r one two');
    expect(errors.map(e => e.line)).toEqual([1, 3]);
    expect(errors[1].message).toMatch(/multi-word labels must be quoted/);
  });

  it('rejects unknown escape sequences', () => {
    const { errors } = parse('a:r "C:\\path"');
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/Unknown escape sequence '\\p'/);
  });

  it('still accepts the four supported escapes', () => {
    const { graph, errors } = parse('a:r "q\\" b\\\\ n\\n t\\t"');
    expect(errors).toEqual([]);
    expect(graph.nodes[0].label).toBe('q" b\\ n\n t\t');
  });
});

describe('id selectors that look like hex colors', () => {
  for (const id of ['add', 'bad', 'face01', 'fff']) {
    it(`$#${id}{...} is an id selector`, () => {
      const { graph, errors } = parse(`$#${id}{fill:#f00}`);
      expect(errors).toEqual([]);
      expect(graph.styles[0]).toMatchObject({ selector: `#${id}`, properties: { fill: '#f00' } });
    });
  }

  it('does not split #abcxyz into the color #abc and the id xyz', () => {
    const { errors } = parse('a:r A #abcxyz');
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/Invalid hex color '#abcxyz'/);
  });

  it('still lexes node colors as HEX_COLOR', () => {
    const types = new Lexer('a #add').tokenize().map(t => t.type);
    expect(types).toEqual([TokenType.ID, TokenType.HASH, TokenType.HEX_COLOR, TokenType.EOF]);
  });
});

describe('style values', () => {
  it('accepts decimals and unit suffixes', () => {
    const { graph, errors } = parse('$:r{stroke-width:1.5 opacity:0.5 font-size:12px}');
    expect(errors).toEqual([]);
    expect(graph.styles[0].properties).toEqual({
      'stroke-width': '1.5', opacity: '0.5', 'font-size': '12px',
    });
  });

  it('accepts any run of non-reserved characters', () => {
    const { graph, errors } = parse('$:r{width:50% font-family:sans-serif}');
    expect(errors).toEqual([]);
    expect(graph.styles[0].properties).toEqual({ width: '50%', 'font-family': 'sans-serif' });
  });

  it('keeps integers and quoted values working', () => {
    const { graph, errors } = parse('$:r{stroke-width:2 data-note:"two words"}');
    expect(errors).toEqual([]);
    expect(graph.styles[0].properties).toEqual({ 'stroke-width': '2', 'data-note': 'two words' });
  });

  it('rejects a bare # value', () => {
    const { graph, errors } = parse('$:r{fill:#}');
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/Invalid hex color '#'/);
    expect(graph.styles).toEqual([]);
  });

  it('rejects an invalid hex value', () => {
    const { errors } = parse('$:r{fill:#abcd}');
    expect(errors[0].message).toMatch(/Invalid hex color '#abcd'/);
  });

  it('rejects an unknown shape selector', () => {
    const { graph, errors } = parse('$:zzz{}');
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/Unknown shape 'zzz'/);
    expect(graph.styles).toEqual([]);
  });

  it('does not treat a colon outside a style block as a value prefix', () => {
    const { graph, errors } = parse('a:r 1');
    expect(errors).toEqual([]);
    expect(graph.nodes[0]).toMatchObject({ shape: 'r', label: '1' });
  });
});

describe('undeclared group members and positions create nodes', () => {
  it('creates nodes for group members nothing else mentions', () => {
    const { graph, errors } = parse('@g{x y}');
    expect(errors).toEqual([]);
    expect(graph.nodes.map(n => n.id)).toEqual(['x', 'y']);
    expect(graph.groups[0].members).toEqual(['x', 'y']);
  });

  it('creates nodes for members of nested groups', () => {
    const { graph } = parse('@outer{@inner{a} b}');
    expect(graph.nodes.map(n => n.id).sort()).toEqual(['a', 'b']);
  });

  it('creates a node for a position nothing else mentions', () => {
    const { graph, errors } = parse('x@1,2');
    expect(errors).toEqual([]);
    expect(graph.nodes).toEqual([{ id: 'x', line: 1 }]);
  });

  it('lets a later node statement define an implicitly created node', () => {
    const { graph, errors } = parse('@g{x}\nx:r Label');
    expect(errors).toEqual([]);
    expect(graph.nodes).toEqual([{ id: 'x', line: 1, shape: 'r', label: 'Label' }]);
  });
});

describe('deep nesting', () => {
  it('reports groups nested past the limit instead of crashing or going silent', () => {
    const depth = 150;
    const src = '@g{'.repeat(depth) + 'x' + '}'.repeat(depth);
    const { errors } = parse(src);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toMatch(/nested more than 100 levels/);
  });

  it('accepts nesting up to the limit', () => {
    const depth = 100;
    const src = '@g{'.repeat(depth) + 'x' + '}'.repeat(depth);
    expect(parse(src).errors).toEqual([]);
  });

  it('does not swallow non-parse exceptions such as stack overflows', () => {
    const parser = new Parser(new Lexer('a:r x').tokenize());
    (parser as unknown as { parseNodeDef: () => void }).parseNodeDef = () => {
      throw new RangeError('Maximum call stack size exceeded');
    };
    expect(() => parser.parse()).toThrow(RangeError);
  });
});

describe('graphToGlypho quoting', () => {
  for (const label of ['3D', '2FA', '_x', 'a-', 'a--b', '-a', 'a b', '']) {
    it(`round-trips the label ${JSON.stringify(label)}`, () => {
      const src = graphToGlypho(graphOf([{ id: 'n', shape: 'r', label }]));
      const { graph, errors } = parse(src);
      expect(errors).toEqual([]);
      expect(graph.nodes[0].label).toBe(label);
    });
  }

  it('keeps simple labels bare', () => {
    expect(graphToGlypho(graphOf([{ id: 'n', shape: 'r', label: 'my-label_2' }]))).toBe('n:r my-label_2');
    expect(graphToGlypho(graphOf([{ id: 'n', shape: 'r', label: '42' }]))).toBe('n:r 42');
  });

  for (const label of ['a\nb """ c', 'a\nends in "', 'line\n"quoted"\n', 'back\\slash\nx']) {
    it(`round-trips the multiline label ${JSON.stringify(label)}`, () => {
      const src = graphToGlypho(graphOf([{ id: 'n', shape: 'r', label }]));
      const { graph, errors } = parse(src);
      expect(errors).toEqual([]);
      expect(graph.nodes[0].label).toBe(label);
    });
  }

  it('uses triple quotes when they are safe', () => {
    expect(graphToGlypho(graphOf([{ id: 'n', shape: 'r', label: 'a\nb' }]))).toBe('n:r """a\nb"""');
  });

  it('round-trips edge labels that need quoting', () => {
    const src = graphToGlypho(graphOf([{ id: 'a' }, { id: 'b' }], {
      edges: [{ from: 'a', to: 'b', op: '>', label: '3D' }],
    }));
    expect(parse(src).graph.edges[0].label).toBe('3D');
  });

  it('keeps quotes on style values that need them', () => {
    const src = graphToGlypho(parse('$:r{data-note:"two words" fill:#fff w:1.5}').graph);
    expect(src).toBe('$:r{data-note:"two words" fill:#fff w:1.5}');
    expect(parse(src).graph.styles[0].properties['data-note']).toBe('two words');
  });

  it('quotes style values containing reserved characters', () => {
    const src = graphToGlypho(graphOf([], { styles: [{ selector: ':r', properties: { x: 'a:b', y: '' } }] }));
    const { graph, errors } = parse(src);
    expect(errors).toEqual([]);
    expect(graph.styles[0].properties).toEqual({ x: 'a:b', y: '' });
  });

  it('drops colors that are not hex instead of writing them as labels', () => {
    const src = graphToGlypho(graphOf([{ id: 'a', color: 'red' }]));
    expect(src).toBe('a');
  });
});

describe('graphToDot id quoting', () => {
  it('quotes hyphenated ids and DOT keywords', () => {
    const dot = graphToDot(parse('my-node>node\nedge>b').graph);
    expect(dot).toContain('"my-node" -> "node";');
    expect(dot).toContain('"edge" -> b;');
    expect(dot).toContain('"node" [label="node"];');
  });

  it('round-trips those ids through parseDot', () => {
    const { graph, errors } = parseDot(graphToDot(parse('my-node>node\nedge>b\nGraph>b').graph));
    expect(errors).toEqual([]);
    expect(graph.nodes.map(n => n.id)).toEqual(['my-node', 'node', 'edge', 'b', 'Graph']);
    expect(graph.edges).toHaveLength(3);
  });

  it('quotes cluster names built from hyphenated group ids', () => {
    const dot = graphToDot(parse('@my-group{a}').graph);
    expect(dot).toContain('subgraph "cluster_my-group" {');
    expect(parseDot(dot).graph.groups[0].id).toBe('my-group');
  });
});

describe('Mermaid import', () => {
  it('splits ids from arrows that start with hyphens', () => {
    const { graph, errors } = parseMermaid('flowchart LR\nA-->B\nC---D\nE-.->F');
    expect(errors).toEqual([]);
    expect(graph.nodes.map(n => n.id)).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
    expect(graph.edges.map(e => e.op)).toEqual(['>', '--', '~']);
  });

  it('keeps hyphenated ids', () => {
    const { graph } = parseMermaid('flowchart LR\nmy-node-->other-node');
    expect(graph.edges[0]).toMatchObject({ from: 'my-node', to: 'other-node' });
  });

  it('parses text-on-link edges', () => {
    const { graph, errors } = parseMermaid([
      'flowchart LR',
      'A -- yes --> B',
      'B -- "two words" --- C',
      'C == strong ==> D',
      'D -. maybe .-> E',
      'E-- tight -->F',
    ].join('\n'));
    expect(errors).toEqual([]);
    expect(graph.edges.map(e => [e.from, e.op, e.to, e.label])).toEqual([
      ['A', '>', 'B', 'yes'],
      ['B', '--', 'C', 'two words'],
      ['C', '=', 'D', 'strong'],
      ['D', '~', 'E', 'maybe'],
      ['E', '>', 'F', 'tight'],
    ]);
  });

  it('only closes a subgraph on lowercase end', () => {
    const { graph, errors } = parseMermaid('flowchart LR\nsubgraph s\nEnd\nEND\nx\nend');
    expect(errors).toEqual([]);
    expect(graph.groups[0].members).toEqual(['End', 'END', 'x']);
  });

  it('decodes HTML and Mermaid entities in labels', () => {
    const { graph } = parseMermaid([
      'flowchart LR',
      'A["a &#35; &quot;b&quot; &amp; #quot;c#quot; #35;"]',
      'A -->|"x &#35;1"| B',
      'subgraph s ["S &quot;1&quot;"]',
      'A',
      'end',
    ].join('\n'));
    expect(graph.nodes[0].label).toBe('a # "b" & "c" #');
    expect(graph.edges[0].label).toBe('x #1');
    expect(graph.groups[0].label).toBe('S "1"');
  });

  it('rewrites ids that are invalid in .g and keeps the original as label', () => {
    const { graph, errors } = parseMermaid('flowchart LR\n_start-->1\n1-->b');
    expect(errors).toEqual([]);
    expect(graph.nodes).toMatchObject([
      { id: 'start', label: '_start' },
      { id: 'n1', label: '1' },
      { id: 'b' },
    ]);
    expect(graph.edges.map(e => [e.from, e.to])).toEqual([['start', 'n1'], ['n1', 'b']]);
    expect(parse(graphToGlypho(graph)).errors).toEqual([]);
  });

  it('prefers an explicit label over the rewritten id', () => {
    const { graph } = parseMermaid('flowchart LR\n_s-->b\n_s["Start"]');
    expect(graph.nodes[0]).toMatchObject({ id: 's', label: 'Start' });
  });

  it('keeps rewritten ids unique', () => {
    const { graph } = parseMermaid('flowchart LR\n_a-->a');
    expect(graph.nodes.map(n => n.id)).toEqual(['a', 'a_2']);
  });

  it('converts named fill colors to hex', () => {
    const { graph } = parseMermaid('flowchart LR\nA\nstyle A fill:red');
    expect(graph.nodes[0].color).toBe('#ff0000');
  });

  it('escapes ampersands on export so labels round-trip', () => {
    const src = graphOf([{ id: 'a', label: 'x &quot; y <br/> z' }]);
    const { graph } = parseMermaid(graphToMermaid(src));
    expect(graph.nodes[0].label).toBe('x &quot; y <br/> z');
  });
});

describe('DOT import', () => {
  it('imports numeral ids', () => {
    const { graph, errors } = parseDot('digraph { 1 -> 2; 3 [label="three"] }');
    expect(errors).toEqual([]);
    expect(graph.nodes).toEqual([
      { id: 'n1', label: '1' },
      { id: 'n2', label: '2' },
      { id: 'n3', label: 'three' },
    ]);
    expect(graph.edges).toEqual([{ from: 'n1', to: 'n2', op: '>' }]);
  });

  it('converts named fill colors to hex and drops ones without a hex form', () => {
    const { graph } = parseDot('digraph { a [fillcolor=red]; b [style=filled, color="0.5 0.5 0.5"] }');
    expect(graph.nodes[0].color).toBe('#ff0000');
    expect(graph.nodes[1].color).toBeUndefined();
    const src = graphToGlypho(graph);
    expect(parse(src).graph.nodes[0]).toEqual({ id: 'a', color: '#ff0000', line: 1 });
  });

  it('keeps quoted hyphenated ids', () => {
    const { graph } = parseDot('digraph { "my-node" -> b }');
    expect(graph.nodes.map(n => n.id)).toEqual(['my-node', 'b']);
  });

  it('rewrites ids that are invalid in .g', () => {
    const { graph, errors } = parseDot('digraph { _start -> "two words"; "a--b" }');
    expect(errors).toEqual([]);
    expect(graph.nodes).toMatchObject([
      { id: 'start', label: '_start' },
      { id: 'two_words', label: 'two words' },
      { id: 'a_-b', label: 'a--b' },
    ]);
    expect(parse(graphToGlypho(graph)).errors).toEqual([]);
  });

  it('treats quoted keywords as node ids', () => {
    const { graph } = parseDot('digraph { "node" -> "edge"; node [shape=box] }');
    expect(graph.nodes.map(n => n.id)).toEqual(['node', 'edge']);
  });

  it('does not turn graph attributes into nodes', () => {
    const { graph } = parseDot('digraph { label="Title"; splines=ortho; a }');
    expect(graph.nodes.map(n => n.id)).toEqual(['a']);
  });

  it('flattens anonymous subgraphs into the parent scope', () => {
    const { graph, errors } = parseDot('digraph { { rank=same; a; b } subgraph { c } a -> c }');
    expect(errors).toEqual([]);
    expect(graph.nodes.map(n => n.id)).toEqual(['a', 'b', 'c']);
    expect(graph.groups).toEqual([]);
  });

  it('reports unsupported edge endpoints with a line number instead of dropping them', () => {
    const { errors } = parseDot('digraph {\n  a -> b\n  a -> {b c}\n}');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ line: 3 });
    expect(errors[0].message).toMatch(/Unsupported DOT edge endpoint/);
  });

  it('counts lines across block comments', () => {
    const { errors } = parseDot('digraph {\n/* one\ntwo */\n  a -> {b}\n}');
    expect(errors[0]).toMatchObject({ line: 4 });
  });

  it('splits edges only outside quoted ids', () => {
    const { graph } = parseDot('digraph { "a->b" -> c }');
    expect(graph.edges).toHaveLength(1);
    expect(graph.nodes[0].label).toBe('a->b');
  });

  it('reads subgraph labels set with graph [label=...]', () => {
    const { graph } = parseDot('digraph { subgraph cluster_x { graph [label="X Team"]; a } }');
    expect(graph.groups[0]).toMatchObject({ id: 'x', label: 'X Team', members: ['a'] });
  });
});

describe('graphToJsonCanvas edge ends', () => {
  it('maps undirected and bidirectional edges to arrow ends', () => {
    const json = JSON.parse(graphToJsonCanvas(parse('a--b\nb<>c\nc>d #f00').graph));
    expect(json.edges[0]).toMatchObject({ toEnd: 'none' });
    expect(json.edges[0].fromEnd).toBeUndefined();
    expect(json.edges[1]).toMatchObject({ fromEnd: 'arrow' });
    expect(json.edges[1].toEnd).toBeUndefined();
    expect(json.edges[2]).toMatchObject({ color: '#f00' });
  });
});
