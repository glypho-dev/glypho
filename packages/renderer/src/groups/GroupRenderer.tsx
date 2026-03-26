import type { LayoutGroup } from '../layout/types.js';
import { DEFAULT_GROUP_STROKE, DEFAULT_GROUP_FILL } from '../styles/defaults.js';

interface GroupRendererProps {
  layoutGroup: LayoutGroup;
}

export function GroupRenderer({ layoutGroup }: GroupRendererProps) {
  const { group, x, y, width, height, depth } = layoutGroup;
  const label = group.label ?? group.id;
  const fillOpacity = Math.max(0.3, 1 - depth * 0.15);

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={DEFAULT_GROUP_FILL}
        fillOpacity={fillOpacity}
        stroke={DEFAULT_GROUP_STROKE}
        strokeWidth={1.5}
        strokeDasharray="6 3"
        rx={8}
        ry={8}
      />
      <text
        x={x + 10}
        y={y + 16}
        fill="#555555"
        fontSize={13}
        fontFamily="system-ui, sans-serif"
        fontWeight="bold"
      >
        {label}
      </text>
    </g>
  );
}
