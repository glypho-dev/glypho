import { useId, useMemo } from 'react';
import type { Graph } from '@glypho/parser';
import { computeLayout } from './layout/layout.js';
import { computeViewBox } from './layout/viewbox.js';
import { MarkerDefs, buildSuffixMap } from './edges/markers.js';
import { resolveEdgeColor } from './styles/resolve.js';
import { sanitizeIdPrefix } from './svg/markers.js';
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
  const edgeColors = useMemo(() => layout.edges.map(e => resolveEdgeColor(e.edge.color)), [layout]);
  const suffixMap = useMemo(() => buildSuffixMap(edgeColors), [edgeColors]);
  // Marker IDs are document-global; namespace them per component instance so
  // two graphs on one page never resolve each other's arrowheads.
  const markerPrefix = `glypho-${sanitizeIdPrefix(useId())}`;

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
      <MarkerDefs colors={edgeColors} prefix={markerPrefix} />
      {/* Layer 1: Groups (background) */}
      {/* Group names may repeat, so key by position */}
      {layout.groups.map((g, i) => (
        <GroupRenderer key={`group-${i}`} layoutGroup={g} />
      ))}
      {/* Layer 2: Edge paths */}
      {layout.edges.map((e, i) => (
        <EdgePath
          key={`path-${e.edge.from}-${e.edge.to}-${i}`}
          layoutEdge={e}
          suffixMap={suffixMap}
          markerPrefix={markerPrefix}
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
