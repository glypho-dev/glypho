# @glypho/renderer

Render [Glypho](https://glypho.dev) (`.g`) graphs to SVG — as a pure function or as a React component.

## Install

```bash
npm install @glypho/renderer
```

If you use the React component entry point, install a compatible React version too:

```bash
npm install react
```

If you want to parse `.g` text into a `Graph` yourself, also install `@glypho/parser`:

```bash
npm install @glypho/parser
```

## Two Entry Points

`react` is only required when you import `@glypho/renderer`. The `@glypho/renderer/svg` entry point is React-free.

| Import | Requires React? | Use case |
|--------|----------------|----------|
| `@glypho/renderer/svg` | No | Pure SVG string rendering — works anywhere |
| `@glypho/renderer` | Yes | React component with click handlers, reactive updates |

## Pure SVG Renderer (no React)

```ts
import { render } from '@glypho/renderer/svg'

const { svg, errors } = render(`
  >LR
  idea:c Idea #f90
  ship:p Ship #0af
  idea > ship
`)

// svg is a complete <svg>...</svg> string
document.getElementById('diagram').innerHTML = svg
```

Or with a pre-parsed graph:

```ts
import { parse } from '@glypho/parser'
import { renderSvg } from '@glypho/renderer/svg'

const { graph } = parse(source)
const svg = renderSvg(graph, { width: 800, padding: 50 })
```

### Embedding

```html
<!-- Safest: static file or <img> tag (no script execution) -->
<img src="/diagram.svg" alt="My diagram">
```

```js
// Plain DOM — only use with trusted or self-generated .g input
container.innerHTML = svg
```

```tsx
// React — only use with trusted or self-generated .g input
<div dangerouslySetInnerHTML={{ __html: svg }} />
```

> **Note:** The SVG string renderer escapes user-derived values (labels, colors, IDs), but `innerHTML` and `dangerouslySetInnerHTML` interpret the full SVG as markup. For untrusted input, prefer `<img src="...">` or the `<GlyphoGraph>` React component, which renders through React's DOM and does not parse raw HTML.

## React Component

```tsx
import { parse } from '@glypho/parser'
import { GlyphoGraph } from '@glypho/renderer'

const { graph } = parse(source)

<GlyphoGraph
  graph={graph}
  width={800}
  height={600}
  padding={40}
  onNodeClick={(id) => console.log('clicked', id)}
  onEdgeClick={(from, to) => console.log('edge', from, to)}
/>
```

## API

### `@glypho/renderer/svg` (pure, no React)

| Export | Description |
|--------|-------------|
| `render(source, options?)` | `.g` text → `{ svg: string, errors: ParseError[] }` |
| `renderSvg(graph, options?)` | Graph AST → SVG string |
| `computeLayout(graph)` | Graph AST → positioned layout data |

### `@glypho/renderer` (React)

| Export | Description |
|--------|-------------|
| `<GlyphoGraph>` | React component with optional `onNodeClick`/`onEdgeClick` props |
| `computeLayout(graph)` | Graph AST → positioned layout data |

### Options

```ts
interface RenderSvgOptions {
  width?: number      // SVG width attribute
  height?: number     // SVG height attribute
  padding?: number    // Viewport padding (default: 40)
}
```

## How It Works

1. **Layout** — dagre auto-positions nodes, routes edges, sizes groups
2. **Shapes** — 6 shapes rendered as SVG primitives (rect, polygon, circle, ellipse, path)
3. **Styles** — CSS-like cascade: shape defaults → `$:shape` rules → `$#id` rules → inline color
4. **Output** — self-contained `<svg>` with no external dependencies

Text sizing uses a character-width heuristic (no DOM/`getBBox` needed), so rendering works anywhere — Node.js, Deno, edge functions, CI pipelines — without a browser.

## License

MIT
