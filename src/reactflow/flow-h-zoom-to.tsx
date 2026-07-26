import { useState, type ReactNode } from 'react';
import {
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useOnSelectionChange,
  useReactFlow,
  useViewport,
  type Node,
} from '@xyflow/react';

import { FlowCanvas } from './flow-canvas.tsx';
import { FLOW_NODE_TYPES } from './flow-nodes.tsx';
import { cellsToFlow } from './adapt.ts';
import { createSampleCells, type FlowNodeData } from '../data/sample-graph.ts';

const { nodes: INITIAL_NODES, edges: INITIAL_EDGES } = cellsToFlow(createSampleCells(false), 'flow');

/** Overlay panel of code-driven zoom buttons; reads the live viewport zoom. */
function ZoomToolbar({ selectedId }: Readonly<{ selectedId: string | null }>): ReactNode {
  const { zoomIn, zoomOut, zoomTo, fitView } = useReactFlow();
  const { zoom } = useViewport();
  const canZoomToSelected = selectedId !== null;

  return (
    <div className="zoom-panel">
      <div className="zoom-panel__title">Programmatic zoom</div>
      <div className="zoom-panel__grid">
        <button type="button" className="btn" onClick={() => void zoomIn({ duration: 200 })}>
          Zoom in
        </button>
        <button type="button" className="btn" onClick={() => void zoomOut({ duration: 200 })}>
          Zoom out
        </button>
        <button type="button" className="btn" onClick={() => void zoomTo(1, { duration: 300 })}>
          Reset 100%
        </button>
        <button type="button" className="btn" onClick={() => void fitView({ duration: 300 })}>
          Fit all
        </button>
      </div>
      <button
        type="button"
        className="btn btn--primary"
        disabled={!canZoomToSelected}
        onClick={() => {
          if (selectedId !== null) {
            void fitView({ nodes: [{ id: selectedId }], duration: 400, maxZoom: 1.5, padding: 0.6 });
          }
        }}
      >
        Zoom to selected
      </button>
      <div className="zoom-panel__hint">
        {Math.round(zoom * 100)}% · click a node to select, then zoom to it
      </div>
    </div>
  );
}

function ZoomStage(): ReactNode {
  const [nodes, , onNodesChange] = useNodesState<Node<FlowNodeData>>(INITIAL_NODES);
  const [edges, , onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useOnSelectionChange({
    onChange: ({ nodes: selectedNodes }) => setSelectedId(selectedNodes[0]?.id ?? null),
  });

  return (
    <div className="stage">
      <div className="stage__canvas">
        <FlowCanvas
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={FLOW_NODE_TYPES}
        >
          <ZoomToolbar selectedId={selectedId} />
        </FlowCanvas>
      </div>
    </div>
  );
}

/** Demo h (React Flow) — drive zoom entirely from code, including zoom-to-selected. */
export function FlowZoomToDemo(): ReactNode {
  return (
    <ReactFlowProvider>
      <ZoomStage />
    </ReactFlowProvider>
  );
}
