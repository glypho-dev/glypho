import type { Graph } from './types.js';

interface CanvasNode {
  id: string;
  type: 'text';
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
}

interface CanvasEdge {
  id: string;
  fromNode: string;
  toNode: string;
  label?: string;
}

interface JsonCanvas {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

const DEFAULT_WIDTH = 250;
const DEFAULT_HEIGHT = 60;
const SPACING_X = 300;
const SPACING_Y = 100;

export function graphToJsonCanvas(graph: Graph): string {
  // Build a position lookup from explicit positions
  const posMap = new Map<string, { x: number; y: number; width?: number; height?: number }>();
  for (const pos of graph.positions) {
    posMap.set(pos.id, { x: pos.x, y: pos.y, width: pos.width, height: pos.height });
  }

  // Build canvas nodes
  const canvasNodes: CanvasNode[] = graph.nodes.map((node, i) => {
    const pos = posMap.get(node.id);

    // If no explicit position, lay out sequentially in a grid
    const x = pos?.x ?? (i % 4) * SPACING_X;
    const y = pos?.y ?? Math.floor(i / 4) * SPACING_Y;
    const width = pos?.width ?? DEFAULT_WIDTH;
    const height = pos?.height ?? DEFAULT_HEIGHT;

    const canvasNode: CanvasNode = {
      id: node.id,
      type: 'text',
      text: node.label ?? node.id,
      x,
      y,
      width,
      height,
    };

    if (node.color) {
      canvasNode.color = node.color;
    }

    return canvasNode;
  });

  // Build canvas edges
  const canvasEdges: CanvasEdge[] = graph.edges.map((edge, i) => {
    const canvasEdge: CanvasEdge = {
      id: `edge-${i}`,
      fromNode: edge.from,
      toNode: edge.to,
    };

    if (edge.label) {
      canvasEdge.label = edge.label;
    }

    return canvasEdge;
  });

  const canvas: JsonCanvas = {
    nodes: canvasNodes,
    edges: canvasEdges,
  };

  return JSON.stringify(canvas, null, 2);
}
