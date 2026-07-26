import type { ReactNode } from 'react';
import {
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useViewport,
  type Edge,
  type Node,
} from '@xyflow/react';

import { FlowCanvas } from './flow-canvas.tsx';
import { FLOW_NODE_TYPES } from './flow-nodes.tsx';
import { ARROW_MARKER, EDGE_COLOR } from './adapt.ts';
import { FLOW_NODE_HEIGHT, FLOW_NODE_WIDTH, type FlowNodeData } from '../data/sample-graph.ts';

// A tileable "blueprint" grid, embedded as a data URI so it works fully offline.
const TILE_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48'>
  <path d='M48 0H0V48' fill='none' stroke='#6b7bb0' stroke-opacity='0.5' stroke-width='1'/>
  <circle cx='0' cy='0' r='1.6' fill='#6b7bb0' fill-opacity='0.7'/>
</svg>`;
const BG_IMAGE = `data:image/svg+xml,${encodeURIComponent(TILE_SVG)}`;
const TILE_SIZE = 48;

interface Site {
  readonly id: string;
  readonly label: string;
  readonly x: number;
  readonly y: number;
}

const SITES: readonly Site[] = [
  { id: 'hq', label: 'HQ', x: 120, y: 120 },
  { id: 'dc-west', label: 'DC West', x: 420, y: 60 },
  { id: 'dc-east', label: 'DC East', x: 700, y: 220 },
  { id: 'store-a', label: 'Store A', x: 300, y: 320 },
  { id: 'store-b', label: 'Store B', x: 620, y: 400 },
];

const ROUTES: ReadonlyArray<readonly [string, string]> = [
  ['hq', 'dc-west'],
  ['hq', 'dc-east'],
  ['dc-west', 'store-a'],
  ['dc-east', 'store-b'],
  ['dc-west', 'store-b'],
];

const INITIAL_NODES: Node<FlowNodeData>[] = SITES.map((site) => ({
  id: site.id,
  type: 'flow',
  position: { x: site.x, y: site.y },
  data: { label: site.label, kind: 'io' },
  style: { width: FLOW_NODE_WIDTH, height: FLOW_NODE_HEIGHT },
}));

const INITIAL_EDGES: Edge[] = ROUTES.map(([from, to]) => ({
  id: `${from}~${to}`,
  source: from,
  target: to,
  type: 'floating',
  markerEnd: ARROW_MARKER,
  style: { stroke: EDGE_COLOR, strokeWidth: 2, strokeDasharray: '4 6' },
}));

/**
 * A tiled image behind the graph, offset and scaled to match the live viewport
 * transform — so it stays aligned with the nodes under pan/zoom, mirroring the
 * JointJS `background.image` option.
 */
function ViewportImage(): ReactNode {
  const { x, y, zoom } = useViewport();
  return (
    <div
      className="rf-underlay-layer"
      style={{
        backgroundImage: `url("${BG_IMAGE}")`,
        backgroundSize: `${TILE_SIZE * zoom}px ${TILE_SIZE * zoom}px`,
        backgroundPosition: `${x}px ${y}px`,
      }}
    />
  );
}

function BackgroundStage(): ReactNode {
  const [nodes, , onNodesChange] = useNodesState<Node<FlowNodeData>>(INITIAL_NODES);
  const [edges, , onEdgesChange] = useEdgesState(INITIAL_EDGES);

  return (
    <div className="stage">
      <div className="toolbar">
        <span className="hint">
          A tiled SVG image is drawn as a background underlay; it stays aligned with the shapes as you
          pan and zoom.
        </span>
      </div>
      <div className="stage__canvas">
        <FlowCanvas
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={FLOW_NODE_TYPES}
          underlay={<ViewportImage />}
        />
      </div>
    </div>
  );
}

/** Background-image demo (React Flow) — a map-style image underlay beneath the diagram. */
export function FlowBackgroundDemo(): ReactNode {
  return (
    <ReactFlowProvider>
      <BackgroundStage />
    </ReactFlowProvider>
  );
}
