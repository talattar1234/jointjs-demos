import { useCallback, useRef, useState, type ReactNode } from 'react';
import {
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useOnSelectionChange,
  type Edge,
  type Node,
  type OnSelectionChangeFunc,
} from '@xyflow/react';

import { FlowCanvas } from './flow-canvas.tsx';
import { FLOW_NODE_TYPES } from './flow-nodes.tsx';
import { cellsToFlow } from './adapt.ts';
import {
  createSampleCells,
  FLOW_NODE_HEIGHT,
  FLOW_NODE_WIDTH,
  type FlowKind,
  type FlowNodeData,
} from '../data/sample-graph.ts';

const KINDS: readonly FlowKind[] = ['process', 'io', 'decision', 'start', 'end'];
const COLUMNS = 5;

function build(): { nodes: Node<FlowNodeData>[]; edges: Edge[] } {
  return cellsToFlow(createSampleCells(false), 'flow');
}

function AddRemoveStage(): ReactNode {
  const initial = build();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<FlowNodeData>>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const counter = useRef(0);

  // Memoized so useOnSelectionChange keeps a stable subscription (an inline
  // handler resubscribes every render and breaks selection tracking).
  const onSelectionChange = useCallback<OnSelectionChangeFunc>(
    ({ nodes: selectedNodes }) => setSelectedId(selectedNodes[0]?.id ?? null),
    []
  );
  useOnSelectionChange({ onChange: onSelectionChange });

  const addNode = useCallback(() => {
    counter.current += 1;
    const index = counter.current;
    const id = `added-${index}`;
    const column = (index - 1) % COLUMNS;
    const row = Math.floor((index - 1) / COLUMNS);
    const newNode: Node<FlowNodeData> = {
      id,
      type: 'flow',
      position: { x: 60 + column * (FLOW_NODE_WIDTH + 24), y: 520 + row * (FLOW_NODE_HEIGHT + 26) },
      data: { label: `Node ${index}`, kind: KINDS[index % KINDS.length] },
      style: { width: FLOW_NODE_WIDTH, height: FLOW_NODE_HEIGHT },
      selected: true,
    };
    setNodes((previous) => [...previous.map((node) => ({ ...node, selected: false })), newNode]);
  }, [setNodes]);

  const removeSelected = useCallback(() => {
    if (selectedId === null) {
      return;
    }
    setNodes((previous) => previous.filter((node) => node.id !== selectedId));
    setEdges((previous) => previous.filter((edge) => edge.source !== selectedId && edge.target !== selectedId));
  }, [selectedId, setNodes, setEdges]);

  const reset = useCallback(() => {
    counter.current = 0;
    const fresh = build();
    setNodes(fresh.nodes);
    setEdges(fresh.edges);
  }, [setNodes, setEdges]);

  const clearAll = useCallback(() => {
    setNodes([]);
    setEdges([]);
  }, [setNodes, setEdges]);

  return (
    <div className="stage">
      <div className="toolbar">
        <button type="button" className="btn btn--primary" onClick={addNode}>
          + Add node
        </button>
        <button type="button" className="btn" onClick={removeSelected} disabled={selectedId === null}>
          Remove selected
        </button>
        <button type="button" className="btn" onClick={reset}>
          Reset
        </button>
        <button type="button" className="btn" onClick={clearAll}>
          Clear all
        </button>
        <div className="chips">
          <span className="chip">
            nodes <b>{nodes.length}</b>
          </span>
          <span className="chip">
            selected <b>{selectedId ?? '—'}</b>
          </span>
        </div>
        <span className="hint">Adds/removes update only the changed nodes — the rest is never redrawn.</span>
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

/** Demo e (React Flow) — add and remove shapes incrementally. */
export function FlowAddRemoveDemo(): ReactNode {
  return (
    <ReactFlowProvider>
      <AddRemoveStage />
    </ReactFlowProvider>
  );
}
