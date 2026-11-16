import type { EdgeOp } from '@glypho/parser';
import type { LayoutEdge } from '../layout/types.js';
import { pointsToPath, shortenEnd, shortenStart, ARROW_END_LENGTH, ARROW_START_LENGTH } from './paths.js';
import { resolveEdgeColor } from '../styles/resolve.js';
import { markerEndRef, markerStartRef } from './markers.js';
import { EDGE_LABEL_FONT_SIZE, EDGE_LABEL_LINE_HEIGHT } from '../layout/sizing.js';

interface EdgePathProps {
  layoutEdge: LayoutEdge;
  suffixMap: Map<string, string>;
  markerPrefix: string;
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

export function EdgePath({ layoutEdge, suffixMap, markerPrefix, onClick }: EdgePathProps) {
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
  const suffix = suffixMap.get(color) ?? '';

  return (
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={visual.strokeWidth}
      strokeDasharray={visual.strokeDasharray}
      markerEnd={markerEndRef(edge.op, markerPrefix, suffix)}
      markerStart={markerStartRef(edge.op, markerPrefix, suffix)}
      onClick={onClick ? () => onClick(edge.from, edge.to) : undefined}
      style={onClick ? { cursor: 'pointer' } : undefined}
    />
  );
}

interface EdgeLabelProps {
  layoutEdge: LayoutEdge;
}

export function EdgeLabel({ layoutEdge }: EdgeLabelProps) {
  const box = layoutEdge.labelBox;
  if (!box) return null;

  return (
    <g transform={`translate(${box.x}, ${box.y})`}>
      <rect
        x={-box.width / 2}
        y={-box.height / 2}
        width={box.width}
        height={box.height}
        fill="white"
        stroke="#bbb"
        strokeWidth={0.5}
        rx={3}
      />
      {box.lines.map((line, i) => (
        <text
          key={i}
          y={(i - (box.lines.length - 1) / 2) * EDGE_LABEL_LINE_HEIGHT}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#333333"
          fontSize={EDGE_LABEL_FONT_SIZE}
          fontFamily="system-ui, sans-serif"
        >
          {line}
        </text>
      ))}
    </g>
  );
}
