import { MarkerType, type Edge, type Node } from '@xyflow/react';
import type { CellRecord } from '@joint/react';

/** Concrete link color shared with the JointJS side (kept identical across tabs). */
export const EDGE_COLOR = '#7c8bff';

/** Arrow head used on every directed edge. */
export const ARROW_MARKER = {
  type: MarkerType.ArrowClosed,
  color: EDGE_COLOR,
  width: 16,
  height: 16,
} as const;

/** Default presentation for a converted edge (floating router + arrow). */
export const EDGE_DEFAULTS = {
  type: 'floating',
  markerEnd: ARROW_MARKER,
  style: { stroke: EDGE_COLOR, strokeWidth: 2 },
} as const;

interface FlowConversion<TData extends Record<string, unknown>> {
  readonly nodes: Node<TData>[];
  readonly edges: Edge[];
}

/** The subset of a JointJS element record we read (its record type is loose). */
interface ElementCellShape<TData> {
  readonly id: string | number;
  readonly position: { readonly x: number; readonly y: number };
  readonly size: { readonly width: number; readonly height: number };
  readonly data: TData;
}

/** The subset of a JointJS link record we read. */
interface LinkCellShape {
  readonly id: string | number;
  readonly source: { readonly id: string | number };
  readonly target: { readonly id: string | number };
}

/**
 * Read a JointJS link's primary label without leaking `any`. The label lives at
 * `labelMap.main.text` on the link record; anything else yields `undefined`.
 */
function readEdgeLabel(cell: unknown): string | undefined {
  const labelMap = (cell as { labelMap?: { main?: { text?: unknown } } }).labelMap;
  return typeof labelMap?.main?.text === 'string' ? labelMap.main.text : undefined;
}

/**
 * Convert a JointJS cell array (the single source of truth reused from the
 * `src/data` modules) into React Flow `nodes` + `edges`. Element records become
 * nodes of `nodeType`; link records become floating edges. Node size is carried
 * on `style` so the custom node fills the same box the JointJS element used.
 * The JointJS `CellRecord` union is loosely typed, so we narrow on `type` and
 * read through a concrete local shape.
 */
export function cellsToFlow<TData extends Record<string, unknown>>(
  cells: readonly CellRecord<TData>[],
  nodeType: string
): FlowConversion<TData> {
  const nodes: Node<TData>[] = [];
  const edges: Edge[] = [];

  for (const cell of cells) {
    if (cell.type === 'element') {
      const element = cell as unknown as ElementCellShape<TData>;
      nodes.push({
        id: String(element.id),
        type: nodeType,
        position: { x: element.position.x, y: element.position.y },
        data: element.data,
        style: { width: element.size.width, height: element.size.height },
      });
    } else if (cell.type === 'link') {
      const link = cell as unknown as LinkCellShape;
      const label = readEdgeLabel(cell);
      edges.push({
        id: String(link.id),
        source: String(link.source.id),
        target: String(link.target.id),
        ...EDGE_DEFAULTS,
        ...(label === undefined ? {} : { data: { label } }),
      });
    }
  }

  return { nodes, edges };
}
