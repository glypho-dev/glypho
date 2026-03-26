// Why Glypho?

>TB

glypho:h "Glypho (.g)" #f90

// The problem
verbose:r """JSON Canvas
Mermaid
Graphviz DOT"""
tokens:c """Too many
tokens""" #f44

verbose>tokens "bloated"

// The solution
compact:r """6 shapes
5 edges
groups + styles""" #0af
efficient:c "~20%" #0c6

glypho>compact concise
compact>efficient "token cost"

// Where it renders
react:p React #61d
svg:p "Pure SVG" #f90
any:p "Any framework" #a4f
cli:p CLI #888

glypho>react
glypho>svg
glypho>any
glypho>cli

// The key difference
nodom:d "No DOM needed?" #0c6
nodom_yes:r """Pure function
text in, SVG out""" #0c6

svg>nodom
nodom>nodom_yes yes

@problem "The problem" {verbose tokens}
@solution "The solution" {compact efficient}
@render "Renders everywhere" {react svg any cli}
