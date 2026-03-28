import type { EdgeOp } from '@glypho/parser';
import type { LayoutEdge } from '../layout/types.js';
import { pointsToPath, pathMidpoint, shortenEnd, shortenStart, ARROW_END_LENGTH, ARROW_START_LENGTH } from './paths.js';
import { resolveEdgeColor } from '../styles/resolve.js';
import { markerEndRef, markerStartRef } from './markers.js';

interface EdgePathProps {
  layoutEdge: LayoutEdge;
  onClick?: (from: string, to: string) => void;
}

interface EdgeVisual {
  strokeDasharray?: string;
  strokeWidth: number;
}

const EDGE_VISUALS: Record<EdgeOp, EdgeVisual> = {
  '>': { strokeWidth: 2 },
  '~': { strokeWidth: 2, strokeDasharray: '6 4' },
  '=': { strokeWidth: 4 },
  '--': { strokeWidth: 2 },
  '<>': { strokeWidth: 2 },
};

export function EdgePath({ layoutEdge, onClick }: EdgePathProps) {
  const { edge } = layoutEdge;
  let points = layoutEdge.points;
  const color = resolveEdgeColor(edge.color);
  const visual = EDGE_VISUALS[edge.op];

  // Shorten path so stroke ends behind the arrowhead base
  const endLen = ARROW_END_LENGTH[edge.op];
  if (endLen) points = shortenEnd(points, endLen);
  const startLen = ARROW_START_LENGTH[edge.op];
  if (startLen) points = shortenStart(points, startLen);

  const d = pointsToPath(points);

  return (
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={visual.strokeWidth}
      strokeDasharray={visual.strokeDasharray}
      markerEnd={markerEndRef(edge.op, color)}
      markerStart={markerStartRef(edge.op, color)}
      onClick={onClick ? () => onClick(edge.from, edge.to) : undefined}
      style={onClick ? { cursor: 'pointer' } : undefined}
    />
  );
}

interface EdgeLabelProps {
  layoutEdge: LayoutEdge;
}

export function EdgeLabel({ layoutEdge }: EdgeLabelProps) {
  const { edge, points } = layoutEdge;
  if (!edge.label) return null;

  const mid = pathMidpoint(points);

  return (
    <g transform={`translate(${mid.x}, ${mid.y - 14})`}>
      <rect
        x={-(edge.label.length * 3.5 + 8)}
        y={-10}
        width={edge.label.length * 7 + 16}
        height={20}
        fill="white"
        stroke="#bbb"
        strokeWidth={0.5}
        rx={3}
      />
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fill="#333333"
        fontSize={13}
        fontFamily="system-ui, sans-serif"
      >
        {edge.label}
      </text>
    </g>
  );
}
