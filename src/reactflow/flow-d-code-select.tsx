import { useCallback, useState, type ReactNode } from 'react';
import {
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useOnSelectionChange,
  useReactFlow,
  type Node,
} from '@xyflow/react';

import { FlowCanvas } from './flow-canvas.tsx';
import { FLOW_NODE_TYPES } from './flow-nodes.tsx';
import { cellsToFlow } from './adapt.ts';
import { createSampleCells, type FlowNodeData } from '../data/sample-graph.ts';

const { nodes: INITIAL_NODES, edges: INITIAL_EDGES } = cellsToFlow(createSampleCells(false), 'flow');

function CodeSelectStage(): ReactNode {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<FlowNodeData>>(INITIAL_NODES);
  const [edges, , onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const { fitView } = useReactFlow();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('process');
  const [error, setError] = useState<string | null>(null);

  useOnSelectionChange({
    onChange: ({ nodes: selectedNodes }) => setSelectedId(selectedNodes[0]?.id ?? null),
  });

  const clear = useCallback(() => {
    setNodes((previous) => previous.map((node) => (node.selected ? { ...node, selected: false } : node)));
  }, [setNodes]);

  const selectByQuery = useCallback(() => {
    const term = query.trim();
    if (term === '') {
      setError('Type a shape id or label first.');
      return;
    }
    const match =
      nodes.find((node) => node.id === term) ??
      nodes.find((node) => node.data.label.toLowerCase() === term.toLowerCase());
    if (match === undefined) {
      setError(`No shape matches “${term}”.`);
      return;
    }
    setError(null);
    setNodes((previous) => previous.map((node) => ({ ...node, selected: node.id === match.id })));
    void fitView({ nodes: [{ id: match.id }], duration: 500, maxZoom: 1.4, padding: 0.6 });
  }, [nodes, query, fitView, setNodes]);

  return (
    <div className="stage">
      <div className="toolbar">
        <label className="field">
          <span className="field__label">Shape id or label</span>
          <input
            className="field__input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                selectByQuery();
              }
            }}
          />
        </label>
        <button type="button" className="btn btn--primary" onClick={selectByQuery}>
          Select
        </button>
        <button type="button" className="btn" onClick={clear} disabled={selectedId === null}>
          Clear
        </button>
        <div className="chips">
          <span className="chip">
            selected <b>{selectedId ?? '—'}</b>
          </span>
        </div>
        {error !== null && <span className="warn-pill">{error}</span>}
        <span className="hint">Try: start · validate · decision · process · notify · reject · done</span>
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

/** Demo d (React Flow) — select a shape from code (input + button), then frame it. */
export function FlowCodeSelectDemo(): ReactNode {
  return (
    <ReactFlowProvider>
      <CodeSelectStage />
    </ReactFlowProvider>
  );
}
