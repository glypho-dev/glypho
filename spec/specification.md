# .g Format Specification

**Version**: 1.0.0-draft

## Introduction

The `.g` format is an LLM-optimized graph notation designed for maximum token efficiency while retaining full expressiveness for nodes, edges, groups, layout, and styling.

### Purpose

Create a format that LLMs can efficiently reason about, produce as output, and receive as input - enabling graph visualization through a custom TypeScript parser and React renderer.

### Design Principles

1. **Fewest tokens possible** - Every character earns its place
2. **Regular patterns** - Easy for LLMs to learn and generate correctly
3. **No quotes unless necessary** - Single words don't need quoting
4. **Single-char operators** - `:` for type, `>` for edge, `@` for position
5. **Implicit defaults** - Omit what's common
6. **Newline as delimiter** - No commas or semicolons
7. **Syntax-as-semantics** - Operators carry meaning, no prefixes needed
8. **Layered concerns** - Semantic -> Layout -> Style (each optional)

---

## Token Efficiency

Compared to formats that solve the same problem (text/JSON notation for directed graphs and diagrams):

| Format          | Relative Tokens |
|-----------------|-----------------|
| Excalidraw JSON | ~500%           |
| JSON Canvas     | 100%            |
| PlantUML        | ~70%            |
| Mermaid         | ~50%            |
| Graphviz DOT    | ~45%            |
| **.g format**   | **~20%**        |

---

## Quick Start

### Minimal Graph

```g
a>b
```

Two nodes, one edge. That's a complete graph.

### Chain Syntax

```g
a>b>c>d
```

Four nodes, three edges in one line.

### Labeled Flow

```g
Login>Check success
Check>Dashboard yes
Check>Error no
```

Nodes created implicitly from edges with labels.

### Full Example

```g
>LR

login:r Login #0f0
mfa:d MFA?
dash:r Dashboard
err:r Error

login>mfa success
mfa>dash yes
mfa>err no

@auth{login mfa dash}
```

See the [examples/](examples/) folder for more.

---

## Syntax Reference

### File Structure

A `.g` file consists of lines, where each line contains exactly one statement. Blank lines and comments are allowed.

**Important constraints:**
- One statement per line
- Comments may appear on their own line or at the end of a statement (`// comment`)

### Direction

Sets the layout direction for auto-layout engines.

```g
>LR
```

| Value | Direction      |
|-------|----------------|
| `LR`  | Left to Right  |
| `TB`  | Top to Bottom  |
| `RL`  | Right to Left  |
| `BT`  | Bottom to Top  |

### Nodes

Nodes define the vertices in your graph.

**Syntax:** `id[:shape] [label] [#color]`

```g
// Just an ID (ID becomes display label)
login

// ID with shape
login:r

// ID with shape and label
login:r Login

// ID with shape, label, and color
login:r Login #0f0

// Multi-word labels require quotes
auth:r "User Login" #0af

// Multiline labels
desc:r """First line
Second line
Third line"""
```

#### Shapes

| Char | Shape        | Typical Use                |
|------|--------------|----------------------------|
| `r`  | rectangle    | Actions, processes         |
| `d`  | diamond      | Decisions, conditions      |
| `c`  | circle       | Start/end, events          |
| `o`  | oval         | States, containers         |
| `p`  | pill/rounded | Buttons, tags              |
| `h`  | hexagon      | Preparation, complex steps |

#### Node IDs

- Must start with a letter (a-z, A-Z)
- May contain letters, digits, underscores, and hyphens
- Examples: `login`, `myNode`, `step_1`, `my-node`
- Invalid: `1step` (starts with number), `_private` (starts with underscore)
- Defining the same node ID twice is a parse error (edges may reference an ID before its definition)

#### Labels

- **Single word**: No quotes needed (`Login`). A bare label must be a single identifier or integer token, so words like `3D`, `2FA` or `_draft` need quotes
- **Multiple words**: Use quotes (`"User Login"`) — a multi-word bare label is a parse error
- **Non-ASCII text** (CJK, emoji, accents): Use quotes (`"日本語"`) — unquoted non-ASCII is a parse error
- **Numeric labels**: Valid without quotes (`42`)
- **Special characters**: Use quotes (`"Error: 404"`)
- **Multiline**: Use triple quotes with real line breaks, or `\n` escapes inside regular quotes

#### Colors

Colors use hex notation only. Named colors are not supported.

- 3-digit hex: `#f00` (red)
- 6-digit hex: `#ff0000` (red)

### Edges

Edges connect nodes with various relationship types.

**Syntax:** `id operator id [label] [#color]`

```g
// Simple edge
a>b

// Edge with label
a>b success

// Edge with label and color
a>b success #0f0

// Different operators
a~b optional
a=b primary
a--b associated
a<>b bidirectional
```

#### Edge Operators

| Op   | Style           | Meaning                    |
|------|-----------------|----------------------------|
| `>`  | solid arrow     | Flow, dependency           |
| `~`  | dashed arrow    | Optional, async            |
| `=`  | thick arrow     | Primary path, strong link  |
| `--` | line (no arrow) | Association, undirected    |
| `<>` | bidirectional   | Two-way relationship       |

> **Note**: `--` uses two dashes to avoid ambiguity with hyphenated IDs (e.g., `my-node`).

#### Edge Chains

Chain multiple nodes in one statement:

```g
a>b>c>d
```

**Important**: Edge chains cannot have labels. If you need labeled edges, use separate statements:

```g
// Correct: separate statements for labels
a>b first
b>c second
c>d third

// Invalid: labels on chains
a>b>c>d label
```

### Groups

Groups create visual containers for related nodes.

**Syntax:** `@id [label] {member1 member2 ...}`

```g
// Simple group
@auth{login mfa verify}

// Group with label
@auth "Authentication" {login mfa verify}

// Empty group (valid but typically unused)
@empty{}

// Single member
@single{one}
```

#### Nested Groups

Groups may contain other groups to create hierarchy:

```g
@system "System" {
  @frontend "Frontend" {
    webapp
    mobile
  }
  @backend "Backend" {
    api
    worker
  }
  gateway
}
```

Single-line flat groups remain valid: `@auth{login mfa}`

**Constraints:**
- Nodes may belong to multiple groups
- A member that no other statement mentions is created as a plain node (as with edges and class assignments), so `@g{x y}` alone yields nodes `x` and `y` inside group `g`
- Groups nest at most 100 levels deep; deeper nesting is a parse error

### Class Assignments

Assign nodes to reusable style classes.

**Syntax:** `.class{member1 member2 ...}`

```g
.highlight{login mfa}
.danger{err}
```

**Notes:**
- Nodes may belong to multiple classes
- Class assignments create implicit nodes if needed
- Class membership is used by `$.class{...}` style rules and Mermaid `class` import/export

### Layout Layer

Explicitly position and size nodes for canvas mode.

#### Position

**Syntax:** `id@x,y`

```g
login@100,200
```

- A position for a node that nothing else declares creates that node
- Coordinates are integers only (no decimals)
- Origin (0,0) is typically top-left
- Negative coordinates are not yet supported (using one is a parse error)

#### Size

**Syntax:** `id@x,y^widthxheight`

```g
login@100,200^120x40
```

**Important**: Size requires position. Standalone `node^120x40` is invalid.

### Style Layer

Apply CSS-like styles to shapes and classes.

**Syntax:** `$selector{property:value property:value ...}`

#### Selectors

| Selector | Targets                    | Example      |
|----------|----------------------------|--------------|
| `:shape` | All nodes of that shape    | `$:r{...}`   |
| `.class` | Nodes assigned to that class | `$.error{...}` |
| `#id`    | Specific node by ID        | `$#login{...}` |

#### Properties

The renderer applies exactly three properties:

| Property | Value |
|----------|-------|
| `fill` | Hex color (`#f00` or `#ff0000`) |
| `stroke` | Hex color (`#f00` or `#ff0000`) |
| `stroke-width` | Number (pixels) |

```g
$:r{fill:#fff stroke:#333 stroke-width:2}
$:d{fill:#ffa}
$.highlight{fill:#ff0 stroke:#f00}
```

Colors must be hex — named colors (e.g. `fill:red`) are not valid and fall back to a gray default. A value starting with `#` must be a valid 3- or 6-digit hex color. Other properties (e.g. `font-family`) parse without error but have no effect on rendered output.

Unquoted values are any run of non-whitespace characters other than the reserved `> ~ = : @ ^ # { } "`, so decimals and units need no quotes: `$:r{stroke-width:1.5 opacity:0.5 font-size:12px}`. For property values with spaces, use quotes: `$:r{data-note:"two words"}`.

A shape selector must name one of the six shapes (`$:zzz{}` is a parse error).

### Comments

Comments start with `//` and extend to the end of the line.

```g
// This is a comment
login:r Login

// Another comment
login>mfa
```

End-of-line comments are also supported:

```g
login:r Login  // inline comment
login>mfa      // edge comment
```

### Multiline Labels

#### Triple Quotes

```g
desc:r """This is a
multiline label
spanning three lines"""
```

#### Escape Sequences

```g
desc:r "Line one\nLine two\nLine three"
```

| Escape | Meaning   |
|--------|-----------|
| `\n`   | Newline   |
| `\t`   | Tab       |
| `\\`   | Backslash |
| `\"`   | Quote     |

Escape sequences are processed only inside regular (single `"`) quotes. Any other escape (e.g. `\p`) is a parse error. Triple-quoted content is taken literally: a `\n` inside `"""..."""` stays as backslash-n; use real line breaks instead. Triple-quoted content cannot contain `"""` or end with `"`; use a regular quoted string with `\n` escapes for those labels.

A regular quoted string must close on the line it opens, and a triple-quoted string must be closed before the end of the file. An unterminated string is a parse error reported at its opening quote.

---

## Layers

The format supports three conceptual layers:

| Layer    | Required | Purpose                              |
|----------|----------|--------------------------------------|
| Semantic | Yes      | Nodes, edges, groups, labels         |
| Layout   | No       | Explicit x,y positions, sizes        |
| Style    | No       | Colors, fills, strokes, fonts        |

A minimal `.g` file needs only the semantic layer. Layout and style layers can be added for precise control or left to auto-layout engines.

---

## Grammar

The formal EBNF grammar is defined in [grammar.ebnf](grammar.ebnf).

### Summary

```ebnf
graph           = { line } ;
line            = statement , [ comment ] | comment | blank ;
statement       = direction | node | edge | edge_chain | group | class_assignment
                | position | style_block ;

direction       = ">" , ( "LR" | "TB" | "RL" | "BT" ) ;
node            = id , [ ":" , shape ] , [ label ] , [ color ] ;
edge            = id , edge_op , id , [ label ] , [ color ] ;
edge_chain      = id , edge_op , id , { edge_op , id } ;
group           = "@" , id , [ label ] , "{" , { group_member } , "}" ;
group_member    = id | group ;
class_assignment = "." , class_name , "{" , { id } , "}" ;
position        = id , "@" , integer , "," , integer , [ "^" , integer , "x" , integer ] ;
style_block     = "$" , selector , "{" , { property } , "}" ;
selector        = ":" , shape | "." , class_name | "#" , id ;
property        = prop_name , ":" , prop_value ;
prop_value      = color | value_char , { value_char } | quoted_string ;
comment         = "//" , { line_char } ;

id              = letter , { id_char | "-" , id_char } ;
shape           = "r" | "d" | "c" | "o" | "p" | "h" ;
edge_op         = ">" | "~" | "=" | "--" | "<>" ;
label           = word | quoted_string | multiline_string ;
word            = id | integer ;
```

---

## AST Structure

For parser implementers, the expected Abstract Syntax Tree structure:

```typescript
interface Graph {
  direction?: 'LR' | 'TB' | 'RL' | 'BT';
  nodes: Node[];
  edges: Edge[];
  groups: Group[];
  positions: Position[];
  styles: Style[];
}

interface Node {
  id: string;
  shape?: 'r' | 'd' | 'c' | 'o' | 'p' | 'h';
  label?: string;
  color?: string;
  classes?: string[];
  line?: number;       // source line of the first statement that mentions the node
}

interface Edge {
  from: string;
  to: string;
  op: '>' | '~' | '=' | '--' | '<>';
  label?: string;
  color?: string;
  line?: number;
}

interface Group {
  id: string;
  label?: string;
  members: string[];   // direct node members only
  children?: Group[];  // nested groups
  line?: number;
}

interface Position {
  id: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  line?: number;
}

interface Style {
  selector: string;    // ':r', '.class' or '#id'
  properties: Record<string, string>;
  line?: number;
}
```

`line` fields are 1-based source line numbers, set by the parser and optional for producers that build graphs in code.

---

## Resolved Ambiguities

The following grammar edge cases have explicit resolutions:

| Case | Resolution |
|------|------------|
| IDs starting with numbers | **Invalid** - IDs must start with a letter |
| Bare number as label | **Valid** - `node:r 42` is allowed |
| Chain label semantics | **Not allowed** - chains cannot have labels |
| Named colors (e.g., `red`) | **Not supported** - hex only |
| Nested groups | **Supported** - `@outer{@inner{a b} c}` |
| Decimal positions | **Not supported** - integers only |
| Size without position | **Not supported** - use `id@x,y^wxh` |
| Multiple statements per line | **Not supported** - one statement per line |
| End-of-line comments | **Supported** - `login:r Login // comment` |
| Undeclared group members / positions | **Created implicitly** - like edge endpoints and class members |
| Bare labels like `3D`, `_x`, `a-` | **Invalid** - a bare label must be one id or integer; quote the rest |
| Unterminated strings | **Parse error** - at the opening quote |
| `$#abc{...}` | **Id selector** - `#` after `$` always starts an id, even a hex-looking one |
| Decimal / unit style values | **Supported** - `stroke-width:1.5`, `font-size:12px` |

---

## Examples

See the [examples/](examples/) folder for complete, runnable examples:

- [minimal.g](examples/minimal.g) - Simplest valid graphs
- [flowchart.g](examples/flowchart.g) - Authentication flow with decisions
- [mindmap.g](examples/mindmap.g) - Undirected connections
- [erd.g](examples/erd.g) - Entity-relationship diagram
- [full-example.g](examples/full-example.g) - All features demonstrated
