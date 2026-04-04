# glypho

Compact text notation for diagrams. Describe nodes and connections in a few short lines, get SVG out. Like Mermaid, but radically shorter — designed for LLMs and humans who value brevity.

**[Try the Glypho Editor](https://glypho.dev/editor/)** — write `.g` and see the graph render in real time.

```bash
npm install glypho
```

## Render SVG (no React needed)

```typescript
import { parse, render } from 'glypho';

const { svg } = render('a:r Hello\nb:c World\na>b');
// svg is a complete SVG string — embed in HTML, write to file, serve from API
```

## React component

```bash
npm install glypho react
```

```tsx
import { GlyphoGraph } from 'glypho/react';
import { parse } from 'glypho';

const { graph } = parse('a:r Hello\nb:c World\na>b');

<GlyphoGraph graph={graph} width={800} height={600} />
```

## What's included

| Entry point | What you get | React required? |
|-------------|-------------|-----------------|
| `glypho` | Parser + SVG renderer | No |
| `glypho/react` | Parser + SVG renderer + GlyphoGraph component | Yes (peer dep) |

## CLI

The CLI is a separate package to keep this install lightweight:

```bash
npm install -g @glypho/cli    # install globally
glypho render flow.g -o flow.svg
```

Or run locally in a project without installing globally:

```bash
npm install @glypho/cli
npx glypho render flow.g -o flow.svg
```

## Individual packages

| Package | Description |
|---------|-------------|
| [`@glypho/parser`](https://www.npmjs.com/package/@glypho/parser) | Lexer + recursive descent parser, AST types, serializers |
| [`@glypho/renderer`](https://www.npmjs.com/package/@glypho/renderer) | Layout engine, SVG renderer, React component |
| [`@glypho/cli`](https://www.npmjs.com/package/@glypho/cli) | CLI for validation, rendering, and format conversion |

## Links

- [Documentation](https://github.com/glypho-dev/glypho)
- [Full specification](https://github.com/glypho-dev/glypho/blob/main/spec/specification.md)
- [Glypho Editor](https://glypho.dev/editor/) — try it online
- [License (MIT)](https://github.com/glypho-dev/glypho/blob/main/LICENSE)
