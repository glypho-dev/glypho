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
