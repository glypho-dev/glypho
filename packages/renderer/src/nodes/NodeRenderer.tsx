import type { Shape, Style } from '@glypho/parser';
import type { LayoutNode } from '../layout/types.js';
import { resolveNodeStyle } from '../styles/resolve.js';
import { DEFAULT_TEXT_COLOR } from '../styles/defaults.js';
import {
  RectShape,
  DiamondShape,
  CircleShape,
  OvalShape,
  PillShape,
  HexagonShape,
} from './shapes.js';

interface NodeRendererProps {
  layoutNode: LayoutNode;
  styles: Style[];
  onClick?: (id: string) => void;
}

const SHAPE_COMPONENT: Record<Shape, typeof RectShape> = {
  r: RectShape,
  d: DiamondShape,
  c: CircleShape,
  o: OvalShape,
  p: PillShape,
  h: HexagonShape,
};

export function NodeRenderer({ layoutNode, styles, onClick }: NodeRendererProps) {
  const { node, x, y, width, height } = layoutNode;
  const shape: Shape = node.shape ?? 'r';
  const style = resolveNodeStyle(node, styles);
  const ShapeComponent = SHAPE_COMPONENT[shape];
  const label = node.label ?? node.id;
  const lines = label.split('\n');

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={onClick ? () => onClick(node.id) : undefined}
      style={onClick ? { cursor: 'pointer' } : undefined}
      data-node-id={node.id}
    >
      <ShapeComponent width={width} height={height} style={style} />
      {lines.map((line, i) => (
        <text
          key={i}
          x={width / 2}
          y={height / 2 + (i - (lines.length - 1) / 2) * 20}
          textAnchor="middle"
          dominantBaseline="central"
          fill={DEFAULT_TEXT_COLOR}
          fontSize={14}
          fontFamily="system-ui, sans-serif"
        >
          {line}
        </text>
      ))}
    </g>
  );
}
