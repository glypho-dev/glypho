import { useMemo } from 'react';
import type { Graph } from '@glypho/parser';
import { computeLayout } from './layout/layout.js';
import { computeViewBox } from './layout/viewbox.js';
import { MarkerDefs } from './edges/markers.js';
import { resolveEdgeColor } from './styles/resolve.js';
import { GroupRenderer } from './groups/GroupRenderer.js';
import { EdgePath, EdgeLabel } from './edges/EdgeRenderer.js';
import { NodeRenderer } from './nodes/NodeRenderer.js';

export interface GlyphoGraphProps {
  graph: Graph;
  className?: string;
  style?: React.CSSProperties;
  width?: number;
  height?: number;
  padding?: number;
  onNodeClick?: (id: string) => void;
  onEdgeClick?: (from: string, to: string) => void;
}

export function GlyphoGraph({
  graph,
  className,
  style,
  width,
  height,
  padding = 40,
  onNodeClick,
  onEdgeClick,
}: GlyphoGraphProps) {
  const layout = useMemo(() => computeLayout(graph), [graph]);

  const viewBox = computeViewBox(layout, padding);

  return (
    <svg
      viewBox={viewBox}
      width={width}
      height={height}
      className={className}
      style={{ maxWidth: '100%', ...style }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <MarkerDefs colors={layout.edges.map(e => resolveEdgeColor(e.edge.color))} />
      {/* Layer 1: Groups (background) */}
      {layout.groups.map(g => (
        <GroupRenderer key={g.group.id} layoutGroup={g} />
      ))}
      {/* Layer 2: Edge paths */}
      {layout.edges.map((e, i) => (
        <EdgePath
          key={`path-${e.edge.from}-${e.edge.to}-${i}`}
          layoutEdge={e}
          onClick={onEdgeClick}
        />
      ))}
      {/* Layer 3: Nodes */}
      {layout.nodes.map(n => (
        <NodeRenderer
          key={n.id}
          layoutNode={n}
          styles={graph.styles}
          onClick={onNodeClick}
        />
      ))}
      {/* Layer 4: Edge labels (on top of everything) */}
      {layout.edges.map((e, i) => (
        <EdgeLabel
          key={`label-${e.edge.from}-${e.edge.to}-${i}`}
          layoutEdge={e}
        />
      ))}
    </svg>
  );
}
