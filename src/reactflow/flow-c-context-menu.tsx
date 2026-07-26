import { useCallback, useRef, useState, type ReactNode } from 'react';
import {
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react';

import { FlowCanvas } from './flow-canvas.tsx';
import { FLOW_NODE_TYPES } from './flow-nodes.tsx';
import { cellsToFlow } from './adapt.ts';
import { ContextMenu, type MenuState } from '../components/context-menu.tsx';
import {
  createSampleCells,
  FLOW_NODE_HEIGHT,
  FLOW_NODE_WIDTH,
  type FlowNodeData,
} from '../data/sample-graph.ts';

const { nodes: INITIAL_NODES, edges: INITIAL_EDGES } = cellsToFlow(createSampleCells(false), 'flow');

function ContextMenuStage(): ReactNode {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<FlowNodeData>>(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const { screenToFlowPosition, fitView } = useReactFlow();
  const [menu, setMenu] = useState<MenuState | null>(null);
  const counter = useRef(0);

  const deleteNode = useCallback(
    (id: string) => {
      setNodes((previous) => previous.filter((node) => node.id !== id));
      setEdges((previous) => previous.filter((edge) => edge.source !== id && edge.target !== id));
    },
    [setNodes, setEdges]
  );

  const toggleAlert = useCallback(
    (id: string) => {
      setNodes((previous) =>
        previous.map((node) =>
          node.id === id ? { ...node, data: { ...node.data, alert: node.data.alert !== true } } : node
        )
      );
    },
    [setNodes]
  );

  const deleteEdge = useCallback((id: string) => setEdges((previous) => previous.filter((edge) => edge.id !== id)), [setEdges]);

  const addNodeAt = useCallback(
    (clientX: number, clientY: number) => {
      counter.current += 1;
      const index = counter.current;
      const position = screenToFlowPosition({ x: clientX, y: clientY });
      const newNode: Node<FlowNodeData> = {
        id: `ctx-${index}`,
        type: 'flow',
        position: { x: position.x - FLOW_NODE_WIDTH / 2, y: position.y - FLOW_NODE_HEIGHT / 2 },
        data: { label: `Node ${index}`, kind: 'process' },
        style: { width: FLOW_NODE_WIDTH, height: FLOW_NODE_HEIGHT },
      };
      setNodes((previous) => [...previous, newNode]);
    },
    [screenToFlowPosition, setNodes]
  );

  const closeMenu = useCallback(() => setMenu(null), []);

  return (
    <div className="stage">
      <div className="toolbar">
        <span className="hint">
          Right-click a node, an edge, or empty canvas for a context-specific React menu.
        </span>
      </div>
      <div className="stage__canvas">
        <FlowCanvas<Node<FlowNodeData>, Edge>
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={FLOW_NODE_TYPES}
          onNodeContextMenu={(event: React.MouseEvent, node: Node) => {
            event.preventDefault();
            setMenu({
              x: event.clientX,
              y: event.clientY,
              title: node.id,
              items: [
                { label: 'Toggle alert', onSelect: () => toggleAlert(node.id) },
                { label: 'Delete node', danger: true, onSelect: () => deleteNode(node.id) },
              ],
            });
          }}
          onEdgeContextMenu={(event: React.MouseEvent, edge: Edge) => {
            event.preventDefault();
            setMenu({
              x: event.clientX,
              y: event.clientY,
              title: 'Link',
              items: [{ label: 'Delete link', danger: true, onSelect: () => deleteEdge(edge.id) }],
            });
          }}
          onPaneContextMenu={(event: MouseEvent | React.MouseEvent) => {
            event.preventDefault();
            setMenu({
              x: event.clientX,
              y: event.clientY,
              title: 'Canvas',
              items: [
                { label: 'Add node here', onSelect: () => addNodeAt(event.clientX, event.clientY) },
                { label: 'Fit to view', onSelect: () => void fitView({ duration: 400 }) },
              ],
            });
          }}
        />
      </div>
      <ContextMenu state={menu} onClose={closeMenu} />
    </div>
  );
}

/** Demo c (React Flow) — a custom React context menu, per target type, viewport-aware. */
export function FlowContextMenuDemo(): ReactNode {
  return (
    <ReactFlowProvider>
      <ContextMenuStage />
    </ReactFlowProvider>
  );
}
