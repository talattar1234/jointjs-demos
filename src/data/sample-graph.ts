import type { CellRecord } from '@joint/react';

/** Visual kind of a flow node, mapped to a color in CSS. */
export type FlowKind = 'start' | 'process' | 'decision' | 'io' | 'end';

/** Data payload for the shared flow-node used across the interactive demos. */
export interface FlowNodeData {
  readonly [key: string]: unknown;
  readonly label: string;
  readonly kind: FlowKind;
  /** When true, the node pulses to grab attention (demo a). */
  readonly alert?: boolean;
}

export const FLOW_NODE_WIDTH = 168;
export const FLOW_NODE_HEIGHT = 58;

interface NodeSeed {
  readonly id: string;
  readonly label: string;
  readonly kind: FlowKind;
  readonly x: number;
  readonly y: number;
  readonly alert?: boolean;
}

interface EdgeSeed {
  readonly from: string;
  readonly to: string;
  readonly label?: string;
}

const NODE_SEEDS: readonly NodeSeed[] = [
  { id: 'start', label: 'Start', kind: 'start', x: 60, y: 40 },
  { id: 'validate', label: 'Validate input', kind: 'process', x: 60, y: 160 },
  { id: 'decision', label: 'Valid?', kind: 'decision', x: 60, y: 280 },
  { id: 'process', label: 'Process order', kind: 'process', x: 320, y: 220 },
  { id: 'notify', label: 'Send confirmation', kind: 'io', x: 320, y: 340 },
  { id: 'reject', label: 'Reject & alert', kind: 'process', x: 60, y: 400, alert: true },
  { id: 'done', label: 'Done', kind: 'end', x: 580, y: 280 },
];

const EDGE_SEEDS: readonly EdgeSeed[] = [
  { from: 'start', to: 'validate' },
  { from: 'validate', to: 'decision' },
  { from: 'decision', to: 'process', label: 'yes' },
  { from: 'decision', to: 'reject', label: 'no' },
  { from: 'process', to: 'notify' },
  { from: 'notify', to: 'done' },
  { from: 'reject', to: 'done' },
];

/** Build the shared sample flow graph. Pass `withAlert` to keep the pulsing node. */
export function createSampleCells(withAlert = true): CellRecord<FlowNodeData>[] {
  const elements: CellRecord<FlowNodeData>[] = NODE_SEEDS.map((seed) => ({
    id: seed.id,
    type: 'element',
    position: { x: seed.x, y: seed.y },
    size: { width: FLOW_NODE_WIDTH, height: FLOW_NODE_HEIGHT },
    data: { label: seed.label, kind: seed.kind, alert: withAlert ? seed.alert : false },
  }));

  const links: CellRecord<FlowNodeData>[] = EDGE_SEEDS.map((edge) => ({
    id: `${edge.from}->${edge.to}`,
    type: 'link',
    source: { id: edge.from },
    target: { id: edge.to },
    style: { color: '#7c8bff', width: 2, targetMarker: 'arrow' },
    ...(edge.label === undefined ? {} : { labelMap: { main: { text: edge.label } } }),
  }));

  return [...elements, ...links];
}
