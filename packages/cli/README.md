# @glypho/cli

<p>
  <a href="https://www.npmjs.com/package/@glypho/cli"><img src="https://img.shields.io/npm/v/%40glypho%2Fcli?label=npm&color=0a5" alt="npm version"></a>
  <a href="https://github.com/glypho-dev/glypho/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/glypho-dev/glypho/ci.yml?branch=main&label=CI" alt="CI status"></a>
  <a href="https://github.com/glypho-dev/glypho/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/%40glypho%2Fcli" alt="MIT license"></a>
</p>

Command-line tool for [Glypho](https://glypho.dev) (`.g`) — validate, render, and convert graph diagrams.

<img src="https://raw.githubusercontent.com/glypho-dev/glypho/main/assets/readme-hero.svg" alt="A flowchart rendered with glypho render" width="100%">

## Install

```bash
npm install -g @glypho/cli
```

## Commands

### Validate

```bash
glypho check diagram.g              # human-readable validation
glypho check diagram.g --json       # machine-readable output
```

### Render

```bash
glypho render diagram.g             # → diagram.svg
glypho render diagram.g -f png      # → diagram.png
glypho render diagram.g -o out.svg  # custom output path
glypho render flow.mmd              # Mermaid input → SVG
glypho render graph.dot -f png      # DOT input → PNG
glypho render diagram.g --width 800 --height 600
glypho render diagram.g -f png --scale 3
glypho render diagram.g -f png -b transparent  # transparent PNG (default is white)
glypho render diagram.g -b '#eee'              # SVG with background color
```

### Preview

```bash
glypho render diagram.g -o diagram.svg
glypho preview diagram.svg          # open an existing SVG in browser
glypho preview diagram.svg --force  # allow GUI side effects in CI/non-interactive runs
```

### Convert

```bash
# .g → text formats
glypho to mermaid diagram.g         # print Mermaid to stdout

# other formats → .g
glypho from mermaid flow.mmd        # print .g to stdout
glypho from dot graph.dot           # print .g to stdout
```

### Inspect

```bash
glypho parse diagram.g              # print JSON AST
glypho parse diagram.g --compact    # minified JSON
glypho info diagram.g               # stats + token comparison
glypho info diagram.g --json        # machine-readable stats
```

## Piping

Commands accept `-` for stdin, and if no file is given they read from stdin when input is piped:

```bash
echo 'a > b > c' | glypho check
echo 'a:c A\nb:p B\na > b' | glypho render -o pipe.svg
echo 'a > b' | glypho to mermaid
cat flow.mmd | glypho from mermaid
```

`render` is the only file-producing conversion command. Use `to` / `from` for text format conversion, use `render` for SVG or PNG output, and use `preview` only to open an existing SVG.

## Token Comparison

`glypho info` shows how `.g` compares to other formats:

```
$ glypho info diagram.g

  Nodes: 5  Edges: 5  Groups: 1

  Format        Tokens
  .g                28
  Mermaid           52  (1.9x)
  Graphviz DOT      68  (2.4x)
  JSON Canvas      143  (5.1x)
```

## License

MIT
