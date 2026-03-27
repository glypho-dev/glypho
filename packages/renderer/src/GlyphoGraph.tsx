import { useMemo } from 'react';
import type { Graph } from '@glypho/parser';
import { computeLayout } from './layout/layout.js';
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

  // Compute viewBox from layout bounds
  const allX = [
    ...layout.nodes.map(n => n.x),
    ...layout.nodes.map(n => n.x + n.width),
    ...layout.groups.map(g => g.x),
    ...layout.groups.map(g => g.x + g.width),
  ];
  const allY = [
    ...layout.nodes.map(n => n.y),
    ...layout.nodes.map(n => n.y + n.height),
    ...layout.groups.map(g => g.y),
    ...layout.groups.map(g => g.y + g.height),
  ];

  const minX = allX.length > 0 ? Math.min(...allX) : 0;
  const minY = allY.length > 0 ? Math.min(...allY) : 0;
  const maxX = allX.length > 0 ? Math.max(...allX) : 100;
  const maxY = allY.length > 0 ? Math.max(...allY) : 100;

  const viewBox = `${minX - padding} ${minY - padding} ${maxX - minX + padding * 2} ${maxY - minY + padding * 2}`;

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
