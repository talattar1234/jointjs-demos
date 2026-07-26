import { useCallback, useState, type ReactNode } from 'react';
import { ReactFlowProvider, useEdgesState, useNodesState, useReactFlow, type Node } from '@xyflow/react';

import { FlowCanvas } from './flow-canvas.tsx';
import { FLOW_NODE_TYPES } from './flow-nodes.tsx';
import { cellsToFlow } from './adapt.ts';
import { DATASETS, type Dataset } from '../data/datasets.ts';
import type { FlowNodeData } from '../data/sample-graph.ts';

/** Wait for React Flow to measure the freshly-set nodes, then frame them. */
const FIT_DELAY_MS = 60;

const initial = cellsToFlow(DATASETS[0].build(), 'flow');

function DatasetStage(): ReactNode {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<FlowNodeData>>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
  const { fitView } = useReactFlow();
  const [activeId, setActiveId] = useState(DATASETS[0].id);

  const load = useCallback(
    (dataset: Dataset) => {
      const { nodes: nextNodes, edges: nextEdges } = cellsToFlow(dataset.build(), 'flow');
      setNodes(nextNodes);
      setEdges(nextEdges);
      setActiveId(dataset.id);
      window.setTimeout(() => void fitView({ duration: 500 }), FIT_DELAY_MS);
    },
    [setNodes, setEdges, fitView]
  );

  return (
    <div className="stage">
      <div className="toolbar">
        <div className="chips">
          {DATASETS.map((dataset) => (
            <button
              key={dataset.id}
              type="button"
              className={`btn ${dataset.id === activeId ? 'btn--primary' : ''}`}
              onClick={() => load(dataset)}
            >
              {dataset.label}
            </button>
          ))}
        </div>
        <span className="hint">Each button loads a different dataset and refits the view.</span>
      </div>
      <div className="stage__canvas">
        <FlowCanvas
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={FLOW_NODE_TYPES}
        />
      </div>
    </div>
  );
}

/** Demo f (React Flow) — switch between datasets; the view refits each time. */
export function FlowDatasetsDemo(): ReactNode {
  return (
    <ReactFlowProvider>
      <DatasetStage />
    </ReactFlowProvider>
  );
}
