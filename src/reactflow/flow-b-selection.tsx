import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useOnSelectionChange,
  type Node,
} from '@xyflow/react';

import { FlowCanvas } from './flow-canvas.tsx';
import { FLOW_NODE_TYPES } from './flow-nodes.tsx';
import { cellsToFlow } from './adapt.ts';
import { createSampleCells, type FlowNodeData } from '../data/sample-graph.ts';

const { nodes: INITIAL_NODES, edges: INITIAL_EDGES } = cellsToFlow(createSampleCells(false), 'flow');

function SelectionStage(): ReactNode {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<FlowNodeData>>(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // React Flow owns the selection interaction; we just observe it for the chip.
  useOnSelectionChange({
    onChange: ({ nodes: selectedNodes, edges: selectedEdges }) => {
      setSelectedId(selectedNodes[0]?.id ?? selectedEdges[0]?.id ?? null);
    },
  });

  const clear = useCallback(() => {
    setNodes((previous) => previous.map((node) => (node.selected ? { ...node, selected: false } : node)));
    setEdges((previous) => previous.map((edge) => (edge.selected ? { ...edge, selected: false } : edge)));
  }, [setNodes, setEdges]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        clear();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [clear]);

  return (
    <div className="stage">
      <div className="toolbar">
        <div className="chips">
          <span className="chip">
            selected <b>{selectedId ?? '—'}</b>
          </span>
        </div>
        <span className="hint">Click any node or edge to select it · click empty space or press Esc to clear</span>
        <button type="button" className="btn" onClick={clear} disabled={selectedId === null}>
          Clear selection
        </button>
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

/** Demo b (React Flow) — single selection across nodes and edges. */
export function FlowSelectionDemo(): ReactNode {
  return (
    <ReactFlowProvider>
      <SelectionStage />
    </ReactFlowProvider>
  );
}
