// Full Feature Showcase
// Demonstrates all .g format features

>LR

// =============================================================================
// NODES - All shapes with various label styles
// =============================================================================

// Rectangle (default for processes)
login:r Login

// Diamond (decisions)
mfa:d """MFA
Required?"""

// Circle (start/end points)
start:c Start #0f0
end:c End #f00

// Oval (states)
pending:o "Pending Review"

// Pill (tags/buttons)
submit:p Submit #0af

// Hexagon (preparation steps)
init:h Initialize

// Node with just ID (ID becomes label)
simple

// Node with numeric label
count:r 42

// Node with special characters in label
api:r "/api/v1/users"

// =============================================================================
// EDGES - All operators
// =============================================================================

// Solid arrow (flow)
start>login

// Dashed arrow (optional/async)
login~mfa

// Thick arrow (primary path)
mfa=end

// Undirected (association)
simple--count

// Bidirectional
api<>pending

// Edges with labels
init>submit begin
submit>pending "await review"

// Edge with color
pending>end approved #0f0

// =============================================================================
// GROUPS - Organizing nodes
// =============================================================================

@auth "Authentication" {login mfa}
@outcomes{end pending}
@process{init submit}

// =============================================================================
// STYLES - CSS-like styling
// =============================================================================

// Style all rectangles
$:r{fill:#fff stroke:#333 stroke-width:2}

// Style all diamonds
$:d{fill:#ffa stroke:#a80}

// Style by class
$.highlight{fill:#ff0}

// Style specific node
$#api{fill:#e0e0ff stroke:#00f}
