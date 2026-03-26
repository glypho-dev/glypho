import type { NodeStyle } from '../styles/defaults.js';

interface ShapeProps {
  width: number;
  height: number;
  style: NodeStyle;
}

export function RectShape({ width, height, style }: ShapeProps) {
  return (
    <rect
      x={0}
      y={0}
      width={width}
      height={height}
      rx={4}
      ry={4}
      fill={style.fill}
      stroke={style.stroke}
      strokeWidth={style.strokeWidth}
    />
  );
}

export function DiamondShape({ width, height, style }: ShapeProps) {
  const cx = width / 2;
  const cy = height / 2;
  const points = `${cx},0 ${width},${cy} ${cx},${height} 0,${cy}`;
  return (
    <polygon
      points={points}
      fill={style.fill}
      stroke={style.stroke}
      strokeWidth={style.strokeWidth}
    />
  );
}

export function CircleShape({ width, height, style }: ShapeProps) {
  const r = Math.min(width, height) / 2;
  return (
    <circle
      cx={width / 2}
      cy={height / 2}
      r={r}
      fill={style.fill}
      stroke={style.stroke}
      strokeWidth={style.strokeWidth}
    />
  );
}

export function OvalShape({ width, height, style }: ShapeProps) {
  return (
    <ellipse
      cx={width / 2}
      cy={height / 2}
      rx={width / 2}
      ry={height / 2}
      fill={style.fill}
      stroke={style.stroke}
      strokeWidth={style.strokeWidth}
    />
  );
}

export function PillShape({ width, height, style }: ShapeProps) {
  return (
    <rect
      x={0}
      y={0}
      width={width}
      height={height}
      rx={height / 2}
      ry={height / 2}
      fill={style.fill}
      stroke={style.stroke}
      strokeWidth={style.strokeWidth}
    />
  );
}

export function HexagonShape({ width, height, style }: ShapeProps) {
  const inset = width * 0.2;
  const points = [
    `${inset},0`,
    `${width - inset},0`,
    `${width},${height / 2}`,
    `${width - inset},${height}`,
    `${inset},${height}`,
    `0,${height / 2}`,
  ].join(' ');
  return (
    <polygon
      points={points}
      fill={style.fill}
      stroke={style.stroke}
      strokeWidth={style.strokeWidth}
    />
  );
}
