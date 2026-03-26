// The .g Format — Explained in .g
// This file uses every feature it describes. Meta, right?

>TB

// ══════════════════════════════════════════════════
// WHAT IS GLYPH?
// ══════════════════════════════════════════════════

glyph:h "Glyph (.g)" #f90
motto:p """LLM-Optimized
Graph Notation"""
tokens:c "~20%" #0c6

glyph>motto
glyph=tokens "token cost vs JSON Canvas" #0c6

// ══════════════════════════════════════════════════
// THE THREE LAYERS — every .g file has up to three
// ══════════════════════════════════════════════════

semantic:r "Semantic Layer" #4af
lay:r "Layout Layer" #fa4
sty:r "Style Layer" #a4f

glyph>semantic required
glyph~lay optional
glyph~sty optional

// Cross-layer relationships (bidirectional edges!)
semantic<>lay
lay<>sty

// ══════════════════════════════════════════════════
// SEMANTIC LAYER — the core of every graph
// ══════════════════════════════════════════════════

dir:d Direction?
nodes:r Nodes
edges:r Edges
groups:r Groups
cmt:o "// Comments"

semantic>dir
semantic>nodes
semantic>edges
semantic>groups
semantic>cmt

// ── Direction options ─────────────────────────────

lr:p LR
tb:p TB
rl:p RL
bt:p BT

// Edge chain! Four nodes, no labels, one line.
dir>lr>tb>rl>bt

// ── The 6 node shapes ─────────────────────────────
// Each shape shown AS that shape

shape_r:r "r rect"
shape_d:d "d diamond"
shape_c:c "c circle"
shape_o:o "o oval"
shape_p:p "p pill"
shape_h:h "h hexagon"

// Another chain showcasing all shapes in sequence
nodes>shape_r>shape_d>shape_c>shape_o>shape_p>shape_h

// ── The 5 edge operators ──────────────────────────

flow_demo:r "a>b"
dash_demo:r "a~b"
thick_demo:r "a=b"
undir_demo:r "a--b"
bidir_demo:r "a<>b"

edges>flow_demo "solid arrow" #4af
edges>dash_demo "dashed arrow" #fa4
edges>thick_demo "thick arrow" #a4f
edges>undir_demo "no arrow" #999
edges>bidir_demo "both arrows" #f44

// ── Groups explained ──────────────────────────────

grp_syntax:r "@name{members}"
grp_label:r """@name "Label"
{a b c}"""

groups>grp_syntax
groups>grp_label

// ── Comments ──────────────────────────────────────

cmt_own:r "Own line only"
cmt_no:r "No end-of-line"

cmt>cmt_own yes
cmt~cmt_no "not supported"

// ══════════════════════════════════════════════════
// LAYOUT LAYER — explicit positioning
// ══════════════════════════════════════════════════

pos:r "id@x,y"
possize:r "id@x,y^wxh"

lay>pos position
lay>possize "position + size"

// Positions with sizes (demonstrating the feature!)
pos@400,600
possize@400,650^140x40

// ══════════════════════════════════════════════════
// STYLE LAYER — CSS-like visual control
// ══════════════════════════════════════════════════

sel_shape:r "$:r{...}" #a4f
sel_class:r "$.cls{...}" #a4f
sel_id:r "$#id{...}" #a4f

sty>sel_shape "by shape"
sty>sel_class "by class"
sty>sel_id "by node"

// ── How labels work ───────────────────────────────

bare:r single
quoted:r "Multi Word"
multiline:r """Triple
Quotes"""
escaped:r "Line1\nLine2"

sel_shape--bare
sel_shape--quoted
sel_shape--multiline
sel_shape--escaped

// ══════════════════════════════════════════════════
// NODE COLORS — hex only, 3 or 6 digit
// ══════════════════════════════════════════════════

col3:c "#f00" #f00
col6:c "#00ff88" #0f8
colnode:r "On nodes" #4af
coledge:r "On edges"

colnode>col3
colnode>col6
coledge>colnode "also on edges" #f90

// ══════════════════════════════════════════════════
// GROUPS — this file's own groups!
// ══════════════════════════════════════════════════

@core "Glyph" {glyph motto tokens}
@layers "Three Layers" {semantic lay sty}
@sem "Semantic Elements" {dir nodes edges groups cmt}
@dirs "Directions" {lr tb rl bt}
@shapes "6 Shapes" {shape_r shape_d shape_c shape_o shape_p shape_h}
@ops "5 Edge Operators" {flow_demo dash_demo thick_demo undir_demo bidir_demo}
@layout "Layout" {pos possize}
@styling "Styling" {sel_shape sel_class sel_id}
@labels "Label Styles" {bare quoted multiline escaped}
@colors "Colors" {col3 col6 colnode coledge}

// ══════════════════════════════════════════════════
// STYLES — this file's own styles!
// ══════════════════════════════════════════════════

// Style all rectangles
$:r{fill:#f8f8ff stroke:#445 stroke-width:1}

// Style all diamonds
$:d{fill:#fff8e0 stroke:#da0 stroke-width:2}

// Style all hexagons
$:h{fill:#fff3e0 stroke:#f90 stroke-width:3}

// Style all ovals
$:o{fill:#f0e8ff stroke:#a4f}

// Style all pills
$:p{fill:#e8fff0 stroke:#0a6}

// Style all circles
$:c{stroke-width:2}

// Style specific node by ID
$#glyph{fill:#fff8e0 font-weight:bold}
