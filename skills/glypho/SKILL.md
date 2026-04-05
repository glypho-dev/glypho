---
name: glypho
description: "Create flowcharts, architecture diagrams, pipelines, and node-and-edge diagrams using Glypho's ultra-compact .g notation. Use this skill whenever the user asks to create, draw, render, or generate a diagram, flowchart, graph, pipeline, architecture diagram, system design, decision tree, mind map, org chart, or any visual that can be expressed as nodes connected by edges. Also triggers when the user mentions .g files, Glypho, or asks to convert Mermaid/DOT diagrams. Does NOT apply to sequence diagrams, ER diagrams, Gantt charts, timing diagrams, or other specialized diagram types that require ordered message flows or temporal axes."
---

# Glypho — .g Graph Notation

Glypho is the most token-efficient text-to-diagram format. A `.g` file describes nodes and connections in a few short lines and renders to SVG. One statement per line. No commas, no semicolons.

## Language Reference

### Direction

Sets auto-layout flow. Must be the first non-comment line if present.

```
>LR
```

| Code | Direction |
|------|-----------|
| `LR` | Left to Right |
| `TB` | Top to Bottom |
| `RL` | Right to Left |
| `BT` | Bottom to Top |

### Nodes

**Syntax:** `id[:shape] [label] [#color]`

```
a                        // bare ID — ID becomes the label
a:r                      // with shape
a:r "Start"              // with label
a:r "Start" #0af         // with color
```

**IDs** must start with a letter, then letters/digits/underscores/hyphens. Valid: `login`, `step_1`, `my-node`. Invalid: `1step`, `_x`.

**Shape codes:**

| Code | Shape | Use for |
|------|-------|---------|
| `r` | rectangle | processes, actions |
| `d` | diamond | decisions, conditions |
| `c` | circle | start/end, events |
| `o` | oval | states |
| `p` | pill | tags, buttons, terminals |
| `h` | hexagon | preparation, complex steps |

**Labels:**
- Single word, no quotes needed: `a:r Start`
- Multiple words need double quotes: `a:r "User Login"`
- Multiline with `\n`: `a:r "Line one\nLine two"`
- Multiline with triple quotes: `a:r """Line one\nLine two\nLine three"""`
- Escape sequences: `\n` `\t` `\\` `\"`
- Bare numbers are valid: `a:r 42`

**Colors** are hex only (`#f00` or `#ff0000`). Named colors like `red` are not supported.

**Implicit nodes:** Referencing an ID in an edge that hasn't been declared creates the node automatically.

### Edges

**Syntax:** `source op target [label] [#color]`

```
a>b                      // solid arrow
a>b "yes"                // with label
a>b yes #0f0             // with label + color
```

| Operator | Style | Meaning |
|----------|-------|---------|
| `>` | solid arrow | flow, dependency |
| `~` | dashed arrow | optional, async |
| `=` | thick arrow | primary path, emphasis |
| `--` | line, no arrowhead | association, undirected |
| `<>` | double arrowhead | bidirectional |

`--` uses two dashes to avoid ambiguity with hyphenated IDs.

### Chains

Connect multiple nodes in one line:

```
a>b>c>d
```

This creates edges a>b, b>c, c>d. Chains **cannot** have labels — use separate edge lines when you need labels.

### Groups

Visual containers for nodes.

**Flat (single line):**
```
@auth { login mfa verify }
@auth "Authentication" { login mfa verify }
```

**Nested (multiline):**
```
@system "System" {
  @frontend { webapp mobile }
  @backend { api worker }
  gateway
}
```

- Define nodes before or after grouping — groups reference node IDs
- A node can belong to multiple groups
- Empty groups are valid: `@empty {}`

### Classes

Assign nodes to style classes:

```
.critical { db auth }
.optional { cache logger }
```

Use with style rules (see below).

### Styling

**Syntax:** `$selector { property:value property:value }`

Three selector types:

| Selector | Targets | Example |
|----------|---------|---------|
| `:shape` | all nodes of that shape | `$:r { fill:#fff stroke:#333 }` |
| `.class` | nodes in that class | `$.critical { fill:#fee stroke:#c00 }` |
| `#id` | specific node | `$#login { fill:#0af }` |

Properties are **space-separated** (not semicolons). Standard CSS properties: `fill`, `stroke`, `stroke-width`, `font-family`, `font-weight`, etc. Quote values with spaces: `font-family:"Helvetica Neue"`.

### Positioning

Explicit placement (overrides auto-layout for that node):

```
login@100,200              // position only
login@100,200^120x40       // position + size (width x height)
```

Coordinates are non-negative integers. Size requires position.

### Comments

```
// Full-line comment
```

## Tooling Setup

### Install

```bash
# Library (parser + renderer)
npm install glypho

# CLI
npm install @glypho/cli

# For React projects
npm install glypho react
```

### CLI Usage

The CLI is invoked via `npx glypho` (or `glypho` if installed globally):

```bash
# Validate syntax
npx glypho check diagram.g

# Render to SVG
npx glypho render diagram.g -o diagram.svg

# Render to PNG
npx glypho render diagram.g -f png -o diagram.png

# Render PNG at 2x resolution
npx glypho render diagram.g -f png --scale 2 -o diagram.png

# Render with background color
npx glypho render diagram.g -b white -o diagram.svg

# Print JSON AST
npx glypho parse diagram.g

# Token stats comparison
npx glypho info diagram.g

# Open SVG in browser
npx glypho preview diagram.svg

# Read from stdin
echo 'a:r Hello\nb:c World\na>b' | npx glypho render - -o out.svg
```

### JavaScript / TypeScript API

```typescript
import { parse, render } from 'glypho';

// Render to SVG string
const { svg } = render('a:r "Hello"\nb:c "World"\na>b');
// svg is a complete <svg> string

// Parse to AST (for inspection or custom rendering)
const { graph } = parse('a:r "Hello"\nb:c "World"\na>b');
// graph.nodes, graph.edges, graph.groups, etc.
```

### React Component

```tsx
import { GlyphoGraph } from 'glypho/react';
import { parse } from 'glypho';

const source = `>LR
a:r "Start"
b:d "Decision"
c:p "End"
a>b
b>c "yes"`;

function Diagram() {
  const { graph } = parse(source);
  return <GlyphoGraph graph={graph} width={800} height={600} />;
}
```

`glypho` has an optional peer dependency on React 18 or 19. The `glypho/react` entry point provides the `GlyphoGraph` component.

## Format Conversion

```bash
# Mermaid to Glypho
npx glypho from mermaid flow.mmd

# DOT to Glypho
npx glypho from dot graph.dot

# Glypho to Mermaid
npx glypho to mermaid flow.g

# Render Mermaid/DOT directly (auto-detects by extension)
npx glypho render flow.mmd -o flow.svg
npx glypho render graph.dot -o graph.svg
```

In code:

```typescript
import { parseMermaid, parseDot, graphToMermaid, graphToDot } from 'glypho';
```

## Complete Examples

**Decision flow:**
```
>LR
start:p "Begin"
check:d "Valid?"
process:r "Process"
error:h "Handle Error"
done:p "Done"
start>check
check>process "yes"
check>error "no"
process>done
error>check
```

**CI/CD pipeline with styling:**
```
>LR
code:r "Push Code"
build:r "Build"
test:d "Tests?"
stage:r "Staging"
prod:p "Production"
fix:h "Fix"
$:d { fill:#fff3e0 stroke:#e65100 }
$:p { fill:#e8f5e9 stroke:#2e7d32 }
$:h { fill:#ffebee stroke:#c62828 }
code>build>test
test>stage "pass"
test>fix "fail"
fix>code
stage>prod
```

**Architecture with groups:**
```
>TB
ui:r "Web App"
mobile:r "Mobile App"
gw:r "API Gateway"
auth:h "Auth"
users:r "User Service"
orders:r "Order Service"
db:c "PostgreSQL"
cache:o "Redis"
queue:p "Message Queue"
@frontend { ui mobile }
@backend { gw auth users orders }
@infra { db cache queue }
ui>gw
mobile>gw
gw>auth
gw>users
gw>orders
users>db
orders>db
users>cache
orders>queue
```

**All edge types:**
```
>TB
a:r "Source"
b:r "Required"
c:r "Optional"
d:r "Critical"
e:r "Peer"
f:r "Linked"
a>b "depends on"
a~c "may use"
a=d "must have"
e<>f "syncs with"
e--f "related"
```

## Key Rules Summary

1. One statement per line
2. No commas or semicolons — whitespace separates
3. Chains cannot have labels
4. Colors are hex only (#rgb or #rrggbb)
5. Style properties are space-separated, not semicolons
6. `--` for undirected edges (not `-`, which conflicts with hyphenated IDs)
7. Define nodes explicitly when you need shapes/labels; edges auto-create plain nodes
8. Always validate with `npx glypho check file.g` before rendering
