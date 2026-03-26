# @glypho/parser

Parse, convert, and serialize [Glypho](https://glypho.dev) (`.g`) graph notation — an LLM-optimized format for compact flowcharts and directed graphs.

## Install

```bash
npm install @glypho/parser
```

## Quick Start

```ts
import { parse } from '@glypho/parser'

const { graph, errors } = parse(`
  >LR
  idea:c Idea #f90
  ship:p Ship #0af
  idea > ship "let's go"
`)

console.log(graph.nodes)  // [{ id: 'idea', shape: 'c', ... }, { id: 'ship', shape: 'p', ... }]
console.log(graph.edges)  // [{ from: 'idea', to: 'ship', op: '>', label: "let's go" }]
```

## API

### Parse

| Function | Input | Output |
|----------|-------|--------|
| `parse(input)` | `.g` text | `{ graph, errors }` |
| `parseMermaid(input)` | Mermaid flowchart | `{ graph, errors }` |
| `parseDot(input)` | Graphviz DOT | `{ graph, errors }` |

### Serialize

| Function | Input | Output |
|----------|-------|--------|
| `graphToGlypho(graph)` | Graph AST | `.g` text |
| `graphToMermaid(graph)` | Graph AST | Mermaid syntax |
| `graphToDot(graph)` | Graph AST | Graphviz DOT |
| `graphToJsonCanvas(graph)` | Graph AST | JSON Canvas |

### Types

```ts
interface Graph {
  direction?: Direction        // 'LR' | 'TB' | 'RL' | 'BT'
  nodes: Node[]
  edges: Edge[]
  groups: Group[]
  positions: Position[]
  styles: Style[]
}

interface Node {
  id: string
  label?: string
  shape?: Shape                // 'r' | 'd' | 'c' | 'o' | 'p' | 'h'
  color?: string
  classes?: string[]
}

interface Edge {
  from: string
  to: string
  op: EdgeOp                   // '>' | '~' | '=' | '--' | '<>'
  label?: string
  color?: string
}
```

## Format Reference

```
>LR                           // direction: LR, TB, RL, BT
node:c "Label" #f90           // shape + label + color
a > b "label"                 // edge with label
a ~ b                         // dashed edge
a = b                         // thick edge
a -- b                        // undirected
a <> b                        // bidirectional
@group {a b c}                // group nodes
.highlight{a b}              // assign nodes to a class
$:r{fill:#fff}                // style all rects
$.highlight{fill:#ff0}        // style a class
```

**Shapes:** `r` rect, `d` diamond, `c` circle, `o` oval, `p` pill, `h` hexagon

## Mermaid Scope

`parseMermaid()` targets Mermaid **flowcharts**. Unsupported constructs are returned as parse errors instead of being translated lossily.

## License

MIT
