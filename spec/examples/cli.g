// Glypho CLI — Current command map
// Shows what each command accepts, produces, and opens.

>TB

// ══════════════════════════════════════════════════
// ENTRYPOINT
// ══════════════════════════════════════════════════

cli:h "glypho" #f90

// ══════════════════════════════════════════════════
// INPUTS
// ══════════════════════════════════════════════════

g_src:p ".g source" #4af
mermaid_src:p ".mmd /.mermaid" #4c9
dot_src:p ".dot /.gv" #5bd
svg_src:p ".svg file" #e94
stdin:o "stdin (-)"

g_src>cli
mermaid_src>cli
dot_src>cli
svg_src>cli
stdin~cli "pipe"

// ══════════════════════════════════════════════════
// COMMANDS
// ══════════════════════════════════════════════════

check:r "check"
parse_cmd:r "parse"
info:r "info"
render:r "render"
preview:r "preview"
to_mermaid:r "to mermaid"
from_mermaid:r "from mermaid"
from_dot:r "from dot"

cli=check
cli=parse_cmd
cli=info
cli=render
cli=preview
cli=to_mermaid
cli=from_mermaid
cli=from_dot

// ══════════════════════════════════════════════════
// CHECK / PARSE / INFO — Glypho input only
// ══════════════════════════════════════════════════

valid:c OK #0c6
errors:c Errors #f44
check_json:p "--json"

ast:r "JSON AST"
compact:p "--compact"

stats:r """Nodes
Edges
Groups"""
token_cmp:r """Token
comparison"""
info_json:p "--json"

g_src>check
stdin~check "pipe .g"
check>valid
check>errors
check~check_json "machine output"

g_src>parse_cmd
stdin~parse_cmd "pipe .g"
parse_cmd>ast
parse_cmd~compact "single line"

g_src>info
stdin~info "pipe .g"
info>stats
info>token_cmp
info~info_json "machine output"

// ══════════════════════════════════════════════════
// RENDER — Glypho, Mermaid, or DOT to SVG / PNG
// ══════════════════════════════════════════════════

svg_out:p "SVG output" #e94
png_out:p "PNG output" #e94
format_flag:p "--format svg|png"
output_flag:p "--output path"
dims:p "--width --height"
scale:p "--scale"

g_src>render
mermaid_src>render
dot_src>render
stdin~render "pipe .g"

render>svg_out "default svg"
render>png_out "--format png"
render~format_flag
render~output_flag
render~dims "SVG only"
render~scale "PNG only"

// ══════════════════════════════════════════════════
// PREVIEW — open an existing SVG
// ══════════════════════════════════════════════════

browser:r "Browser"
force:p "--force"
guard:c "Refuse in CI / non-interactive" #f6a

svg_out>preview "render first"
svg_src>preview "existing file"
preview>browser "open"
preview~force "override"
preview>guard "default"

// ══════════════════════════════════════════════════
// CONVERT — text formats only
// ══════════════════════════════════════════════════

mermaid_text:p "Mermaid text" #4c9
g_text:p ".g text" #4af

g_src>to_mermaid
stdin~to_mermaid "pipe .g"
to_mermaid>mermaid_text

mermaid_src>from_mermaid
stdin~from_mermaid "pipe Mermaid"
from_mermaid>g_text

dot_src>from_dot
stdin~from_dot "pipe DOT"
from_dot>g_text

// ══════════════════════════════════════════════════
// GROUPS
// ══════════════════════════════════════════════════

@entry "Entry" {cli}
@inputs "Inputs" {g_src mermaid_src dot_src svg_src stdin}
@commands "Commands" {check parse_cmd info render preview to_mermaid from_mermaid from_dot}
@inspect "Inspect Glypho" {valid errors check_json ast compact stats token_cmp info_json}
@rendering "Render Files" {svg_out png_out format_flag output_flag dims scale}
@previewing "Preview SVG" {browser force guard}
@convert "Convert Text" {mermaid_text g_text}

// ══════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════

$:h{fill:#fff3e0 stroke:#f90 stroke-width:3}
$:r{fill:#f8f8ff stroke:#445 stroke-width:1}
$:p{fill:#eef9ff stroke:#2a78b8}
$:o{fill:#f5ecff stroke:#8b5cf6}
$:c{stroke-width:2}
