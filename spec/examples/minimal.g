// Minimal .g Examples
// These demonstrate the simplest valid .g graphs

// -----------------------------------------------------------------------------
// Example 1: Two nodes, one edge
// This is the smallest valid graph
// -----------------------------------------------------------------------------

a>b

// -----------------------------------------------------------------------------
// Example 2: Chain syntax
// Four nodes, three edges in one line
// -----------------------------------------------------------------------------

// a>b>c>d

// -----------------------------------------------------------------------------
// Example 3: Implicit nodes from edges
// Nodes are created automatically when referenced in edges
// -----------------------------------------------------------------------------

// Login>Check
// Check>Dashboard
// Check>Error

// -----------------------------------------------------------------------------
// Example 4: Nodes with shapes
// -----------------------------------------------------------------------------

// start:c
// process:r
// decision:d
// end:c

// start>process
// process>decision
// decision>end

// -----------------------------------------------------------------------------
// Example 5: Simple labeled edges
// -----------------------------------------------------------------------------

// yes:c Yes
// no:c No
// check:d Check?

// check>yes true
// check>no false
