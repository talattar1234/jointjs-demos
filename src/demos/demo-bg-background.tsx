import { useCallback, type ReactNode } from 'react';
import { GraphProvider, type CellRecord, type RenderElement } from '@joint/react';

import { DiagramCanvas } from '../components/diagram-canvas.tsx';
import { FlowNode } from '../components/flow-node.tsx';
import { FLOW_NODE_HEIGHT, FLOW_NODE_WIDTH, type FlowNodeData } from '../data/sample-graph.ts';

// A tileable "blueprint" grid, embedded as a data URI so it works fully offline.
const TILE_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48'>
  <path d='M48 0H0V48' fill='none' stroke='#6b7bb0' stroke-opacity='0.5' stroke-width='1'/>
  <circle cx='0' cy='0' r='1.6' fill='#6b7bb0' fill-opacity='0.7'/>
</svg>`;
const BG_IMAGE = `data:image/svg+xml,${encodeURIComponent(TILE_SVG)}`;

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

const initialCells: CellRecord<FlowNodeData>[] = [
  ...SITES.map<CellRecord<FlowNodeData>>((site) => ({
    id: site.id,
    type: 'element',
    position: { x: site.x, y: site.y },
    size: { width: FLOW_NODE_WIDTH, height: FLOW_NODE_HEIGHT },
    data: { label: site.label, kind: 'io' },
  })),
  ...ROUTES.map<CellRecord<FlowNodeData>>(([from, to]) => ({
    id: `${from}~${to}`,
    type: 'link',
    source: { id: from },
    target: { id: to },
    style: { color: '#7c8bff', width: 2, dasharray: '4 6', targetMarker: 'arrow' },
  })),
];

const renderElement: RenderElement<FlowNodeData> = (data) => <FlowNode data={data} />;

function BackgroundStage(): ReactNode {
  const renderElementCb = useCallback(renderElement, []);
  return (
    <div className="stage">
      <div className="toolbar">
        <span className="hint">
          The paper renders a tiled SVG image as a background underlay; it stays aligned with the
          shapes as you pan and zoom.
        </span>
      </div>
      <div className="stage__canvas">
        <DiagramCanvas<FlowNodeData>
          renderElement={renderElementCb}
          paperProps={{
            background: { image: BG_IMAGE, repeat: 'repeat', opacity: 0.5 },
            options: {
              defaultRouter: { name: 'orthogonal' },
              defaultConnector: { name: 'rounded', args: { radius: 10 } },
            },
          }}
        />
      </div>
    </div>
  );
}

/** Background-image demo — a map-style image underlay beneath the diagram. */
export function BackgroundDemo(): ReactNode {
  return (
    <GraphProvider initialCells={initialCells}>
      <BackgroundStage />
    </GraphProvider>
  );
}
