import type { CellRecord } from '@joint/react';

import {
  createSampleCells,
  FLOW_NODE_HEIGHT,
  FLOW_NODE_WIDTH,
  type FlowKind,
  type FlowNodeData,
} from './sample-graph.ts';

interface NodeSpec {
  readonly id: string;
  readonly label: string;
  readonly kind: FlowKind;
  readonly x: number;
  readonly y: number;
}

interface EdgeSpec {
  readonly from: string;
  readonly to: string;
  readonly label?: string;
}

function build(nodes: readonly NodeSpec[], edges: readonly EdgeSpec[]): CellRecord<FlowNodeData>[] {
  const elements: CellRecord<FlowNodeData>[] = nodes.map((node) => ({
    id: node.id,
    type: 'element',
    position: { x: node.x, y: node.y },
    size: { width: FLOW_NODE_WIDTH, height: FLOW_NODE_HEIGHT },
    data: { label: node.label, kind: node.kind },
  }));
  const links: CellRecord<FlowNodeData>[] = edges.map((edge) => ({
    id: `${edge.from}->${edge.to}`,
    type: 'link',
    source: { id: edge.from },
    target: { id: edge.to },
    style: { color: '#7c8bff', width: 2, targetMarker: 'arrow' },
    ...(edge.label === undefined ? {} : { labelMap: { main: { text: edge.label } } }),
  }));
  return [...elements, ...links];
}

/** A named, buildable dataset for the switcher demo. */
export interface Dataset {
  readonly id: string;
  readonly label: string;
  readonly build: () => CellRecord<FlowNodeData>[];
}

export const DATASETS: readonly Dataset[] = [
  { id: 'order', label: 'Order flow', build: () => createSampleCells(false) },
  {
    id: 'services',
    label: 'Microservices',
    build: () =>
      build(
        [
          { id: 'gw', label: 'API Gateway', kind: 'start', x: 40, y: 200 },
          { id: 'auth', label: 'Auth', kind: 'process', x: 300, y: 60 },
          { id: 'orders', label: 'Orders', kind: 'process', x: 300, y: 200 },
          { id: 'pay', label: 'Payments', kind: 'process', x: 300, y: 340 },
          { id: 'db', label: 'Database', kind: 'io', x: 580, y: 130 },
          { id: 'queue', label: 'Queue', kind: 'io', x: 580, y: 300 },
          { id: 'worker', label: 'Worker', kind: 'end', x: 840, y: 300 },
        ],
        [
          { from: 'gw', to: 'auth' },
          { from: 'gw', to: 'orders' },
          { from: 'gw', to: 'pay' },
          { from: 'orders', to: 'db' },
          { from: 'pay', to: 'db' },
          { from: 'pay', to: 'queue' },
          { from: 'queue', to: 'worker' },
        ]
      ),
  },
  {
    id: 'org',
    label: 'Org chart',
    build: () =>
      build(
        [
          { id: 'ceo', label: 'CEO', kind: 'start', x: 380, y: 40 },
          { id: 'cto', label: 'CTO', kind: 'process', x: 180, y: 180 },
          { id: 'cfo', label: 'CFO', kind: 'process', x: 580, y: 180 },
          { id: 'eng1', label: 'Eng Lead', kind: 'io', x: 40, y: 320 },
          { id: 'eng2', label: 'Data Lead', kind: 'io', x: 300, y: 320 },
          { id: 'fin1', label: 'Accounting', kind: 'io', x: 580, y: 320 },
          { id: 'fin2', label: 'Treasury', kind: 'io', x: 820, y: 320 },
        ],
        [
          { from: 'ceo', to: 'cto' },
          { from: 'ceo', to: 'cfo' },
          { from: 'cto', to: 'eng1' },
          { from: 'cto', to: 'eng2' },
          { from: 'cfo', to: 'fin1' },
          { from: 'cfo', to: 'fin2' },
        ]
      ),
  },
  {
    id: 'pipeline',
    label: 'CI/CD pipeline',
    build: () =>
      build(
        [
          { id: 'commit', label: 'Commit', kind: 'start', x: 40, y: 180 },
          { id: 'build', label: 'Build', kind: 'process', x: 250, y: 180 },
          { id: 'test', label: 'Test', kind: 'process', x: 460, y: 180 },
          { id: 'stage', label: 'Staging', kind: 'io', x: 670, y: 180 },
          { id: 'prod', label: 'Production', kind: 'end', x: 880, y: 180 },
        ],
        [
          { from: 'commit', to: 'build' },
          { from: 'build', to: 'test' },
          { from: 'test', to: 'stage', label: 'pass' },
          { from: 'stage', to: 'prod', label: 'approve' },
        ]
      ),
  },
];
