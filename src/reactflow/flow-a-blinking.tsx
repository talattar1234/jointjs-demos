import { useCallback, useState, type ReactNode } from 'react';
import { ReactFlowProvider, useEdgesState, useNodesState, type Node } from '@xyflow/react';

import { FlowCanvas } from './flow-canvas.tsx';
import { FLOW_NODE_TYPES } from './flow-nodes.tsx';
import { cellsToFlow } from './adapt.ts';
import { createSampleCells, type FlowNodeData } from '../data/sample-graph.ts';

/** The node that carries the alert in this demo. */
const ALERT_NODE_ID = 'reject';
const { nodes: INITIAL_NODES, edges: INITIAL_EDGES } = cellsToFlow(createSampleCells(true), 'flow');

function BlinkingStage(): ReactNode {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<FlowNodeData>>(INITIAL_NODES);
  const [edges, , onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const [isAlerting, setIsAlerting] = useState(true);

  const toggle = useCallback(() => {
    setIsAlerting((current) => {
      const next = !current;
      setNodes((previous) =>
        previous.map((node) =>
          node.id === ALERT_NODE_ID ? { ...node, data: { ...node.data, alert: next } } : node
        )
      );
      return next;
    });
  }, [setNodes]);

  return (
    <div className="stage">
      <div className="toolbar">
        <button type="button" className={`btn ${isAlerting ? '' : 'btn--primary'}`} onClick={toggle}>
          {isAlerting ? 'Silence alert' : 'Trigger alert'}
        </button>
        <span className="hint">
          The “Reject &amp; alert” node pulses red via a CSS animation. It falls back to a static red
          outline when the OS prefers reduced motion.
        </span>
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

/** Demo a (React Flow) — a specific shape pulses red to grab attention. */
export function FlowBlinkingDemo(): ReactNode {
  return (
    <ReactFlowProvider>
      <BlinkingStage />
    </ReactFlowProvider>
  );
}
