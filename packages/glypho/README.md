<h1 align="center">glypho</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/glypho"><img src="https://img.shields.io/npm/v/glypho?label=npm&color=0a5" alt="npm version"></a>
  <a href="https://github.com/glypho-dev/glypho/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/glypho-dev/glypho/ci.yml?branch=main&label=CI" alt="CI status"></a>
  <a href="https://www.npmjs.com/package/glypho"><img src="https://img.shields.io/npm/types/glypho" alt="TypeScript types"></a>
  <a href="https://github.com/glypho-dev/glypho/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/glypho" alt="MIT license"></a>
</p>

<p align="center">
  Compact text notation for diagrams. Write nodes and arrows in a few short lines, get SVG out.<br>
  Like Mermaid, but radically shorter — built for LLMs and for humans who value brevity.
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/glypho-dev/glypho/main/assets/readme-hero.svg" alt="A flowchart rendered by Glypho: idea → write .g → valid? → render SVG → shipped, with a fix loop" width="100%">
</p>

The 14 lines of `.g` that drew the diagram above:

```
>LR
idea:c Idea #a5f
draft:r "Write .g" #08f
check:d "Valid?" #fa0
render:r "Render SVG" #08f
fix:h "Fix line 3" #f55
ship:p Shipped #0a5
@loop "write - check - render" { draft check render fix }
idea>draft
draft>check
check>render "yes"
check>fix "no"
fix>draft
render>ship
```

**[Try it live in the Glypho Editor →](https://glypho.dev/editor/)**

## Quick start

```bash
npm install glypho
```

```typescript
import { render } from 'glypho';

const { svg } = render('a:r Hello\nb:c World\na>b');
// svg is a complete <svg> string — embed it in HTML, write it to a file, serve it from an API
```

No DOM, no React, no headless browser. Parsing and layout are pure functions.

## Why Glypho

The same diagram costs a fraction of the tokens in `.g` — which matters when an LLM writes, reads, or edits it:

| Format | Tokens (diagram above) | Relative |
|--------|----------------------:|---------:|
| **Glypho `.g`** | **102** | **1×** |
| Mermaid | 155 | 1.5× |
| Graphviz DOT | 204 | 2.0× |
| JSON Canvas | 580 | 5.7× |

The parser is built for the write → check → render loop: common authoring mistakes (unquoted multi-word labels, bad hex colors, chain labels) are loud, line-anchored errors with fix hints — never a silently wrong graph.

## Syntax in 60 seconds

| Write | Get |
|-------|-----|
| `>LR` | Layout direction (`LR`, `TB`, `RL`, `BT`) |
| `a:r "User Login" #08f` | Node: id `a`, rectangle, label, color |
| `a>b "yes"` | Arrow with a label |
| `a>b>c>d` | Chain of arrows |
| `a~b` &nbsp;`a=b` &nbsp;`a--b` &nbsp;`a<>b` | Dashed, thick, undirected, bidirectional |
| `@auth { login mfa }` | Group box (nesting supported) |
| `$:d { fill:#ffa }` | Style every diamond |

Shapes: `r` rectangle · `d` diamond · `c` circle · `o` oval · `p` pill · `h` hexagon

Full grammar, groups, classes, positions: [specification](https://github.com/glypho-dev/glypho/blob/main/spec/specification.md).

## React component

```bash
npm install glypho react
```

```tsx
import { GlyphoGraph } from 'glypho/react';
import { parse } from 'glypho';

const { graph } = parse('a:r Hello\nb:c World\na>b');

<GlyphoGraph graph={graph} width={800} height={600} onNodeClick={id => select(id)} />
```

| Entry point | What you get | React required? |
|-------------|--------------|-----------------|
| `glypho` | Parser + SVG renderer | No |
| `glypho/react` | Everything above + `<GlyphoGraph>` component | Yes (peer dep, React 18/19) |

## CLI

The command line lives in a separate package so this one stays lightweight:

```bash
npm install -g @glypho/cli

glypho check flow.g          # validate, with file:line:col errors
glypho render flow.g         # → flow.svg
glypho render flow.g -f png  # → flow.png (CJK-safe fonts)
glypho from mermaid flow.mmd # convert Mermaid → .g
glypho info flow.g           # token cost vs Mermaid / DOT / JSON Canvas
```

## The Glypho family

| Package | Description |
|---------|-------------|
| [`glypho`](https://www.npmjs.com/package/glypho) | **This package** — parser + renderer in one install |
| [`@glypho/parser`](https://www.npmjs.com/package/@glypho/parser) | Lexer + parser, AST types, Mermaid/DOT/JSON Canvas converters |
| [`@glypho/renderer`](https://www.npmjs.com/package/@glypho/renderer) | Layout engine, SVG renderer, React component |
| [`@glypho/cli`](https://www.npmjs.com/package/@glypho/cli) | `glypho` command: check, render, preview, convert |

## Links

- [Glypho Editor](https://glypho.dev/editor/) — write `.g`, see it render live
- [Documentation](https://github.com/glypho-dev/glypho)
- [Specification](https://github.com/glypho-dev/glypho/blob/main/spec/specification.md)
- [License (MIT)](https://github.com/glypho-dev/glypho/blob/main/LICENSE)
