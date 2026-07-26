import type { ReactNode } from 'react';

import { Cookbook, type Snippet } from '../components/cookbook.tsx';

const SNIPPETS: readonly Snippet[] = [
  {
    id: 'minimal',
    title: '1 · Minimal diagram',
    desc: 'A graph is arrays of nodes and edges. Feed them to <ReactFlow>; wrap once in <ReactFlowProvider>.',
    code: `import { ReactFlow, ReactFlowProvider, type Node, type Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const nodes: Node[] = [
  { id: '1', position: { x: 40, y: 40 }, data: { label: 'Hello' } },
  { id: '2', position: { x: 240, y: 160 }, data: { label: 'World' } },
];
const edges: Edge[] = [{ id: 'e1', source: '1', target: '2' }];

export function Diagram() {
  return (
    <ReactFlowProvider>
      <div style={{ width: '100%', height: 400 }}>
        <ReactFlow nodes={nodes} edges={edges} fitView />
      </div>
    </ReactFlowProvider>
  );
}`,
    demo: 'i-dashboard',
  },
  {
    id: 'custom-node',
    title: '2 · Custom node',
    desc: 'A node type is just a React component. Register it in a stable nodeTypes map.',
    code: `import type { Node, NodeProps, NodeTypes } from '@xyflow/react';

interface CardData extends Record<string, unknown> { label: string }

function Card({ data }: NodeProps<Node<CardData>>) {
  return <div className="card">{data.label}</div>;
}

// Module constant → stable identity (React Flow warns otherwise).
const nodeTypes: NodeTypes = { card: Card };

<ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} />;`,
    demo: 'a-blinking',
  },
  {
    id: 'controlled-state',
    title: '3 · Controlled nodes & edges',
    desc: 'useNodesState / useEdgesState give you managed arrays plus the change handlers.',
    code: `import { useNodesState, useEdgesState } from '@xyflow/react';

const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

<ReactFlow
  nodes={nodes}
  edges={edges}
  onNodesChange={onNodesChange}
  onEdgesChange={onEdgesChange}
/>;`,
    demo: 'b-selection',
  },
  {
    id: 'add-remove',
    title: '4 · Add & remove nodes',
    desc: 'setNodes/setEdges take an updater. Removing a node? Drop its connected edges too.',
    code: `// Add
setNodes((ns) => [...ns, { id, position: { x, y }, data: { label } }]);

// Remove a node and anything attached to it
setNodes((ns) => ns.filter((n) => n.id !== id));
setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));`,
    demo: 'e-add-remove',
  },
  {
    id: 'update-data',
    title: '5 · Update node data live',
    desc: 'Map over the nodes and replace the one you touch — only that node re-renders.',
    code: `setNodes((ns) =>
  ns.map((n) =>
    n.id === 'cpu' ? { ...n, data: { ...n.data, value: n.data.value + 1 } } : n
  )
);`,
    demo: 'i-dashboard',
  },
  {
    id: 'selection',
    title: '6 · Track the selection',
    desc: 'React Flow owns the selection interaction; observe it with useOnSelectionChange.',
    code: `import { useOnSelectionChange } from '@xyflow/react';

const [selectedId, setSelectedId] = useState<string | null>(null);

// Memoize the handler — useOnSelectionChange resubscribes on every
// identity change, so an inline function breaks selection tracking.
const onChange = useCallback(
  ({ nodes }) => setSelectedId(nodes[0]?.id ?? null),
  [],
);
useOnSelectionChange({ onChange });

// Select from code by toggling the node's \`selected\` flag.
setNodes((ns) => ns.map((n) => ({ ...n, selected: n.id === targetId })));`,
    demo: 'd-code-select',
  },
  {
    id: 'events',
    title: '7 · Listen to events',
    desc: 'Every interaction is a prop: node, edge, pane, connect, and viewport events.',
    code: `<ReactFlow
  onNodeClick={(_e, node) => console.log('clicked', node.id)}
  onEdgeClick={(_e, edge) => console.log('edge', edge.id)}
  onNodeContextMenu={(e, node) => openMenu(e.clientX, e.clientY, node.id)}
  onConnect={(c) => console.log('connect', c.source, '→', c.target)}
  onMove={() => console.log('viewport moved')}
/>;`,
    demo: 'g-events',
  },
  {
    id: 'zoom',
    title: '8 · Zoom & pan from code',
    desc: 'useReactFlow exposes imperative viewport controls; useViewport reads it reactively.',
    code: `import { useReactFlow, useViewport } from '@xyflow/react';

const { zoomIn, zoomOut, fitView } = useReactFlow();
const { zoom } = useViewport();

<button onClick={() => zoomIn({ duration: 200 })}>Zoom in</button>;
// Frame a single node
fitView({ nodes: [{ id }], duration: 400, padding: 0.6 });`,
    demo: 'h-zoom-to',
  },
  {
    id: 'connect',
    title: '9 · Connect by dragging',
    desc: 'Render <Handle>s on your node, then append the new edge in onConnect with addEdge.',
    code: `import { Handle, Position, addEdge } from '@xyflow/react';

function Node() {
  return (
    <div className="node">
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

<ReactFlow onConnect={(c) => setEdges((es) => addEdge(c, es))} />;`,
    demo: 'j-editor',
  },
  {
    id: 'datasets',
    title: '10 · Load / switch datasets',
    desc: 'Swap both arrays, then refit once React Flow has measured the new nodes.',
    code: `function load(next) {
  setNodes(next.nodes);
  setEdges(next.edges);
  setTimeout(() => fitView({ duration: 500 }), 60);
}`,
    demo: 'f-datasets',
  },
  {
    id: 'virtualize',
    title: '11 · Virtualize a big graph',
    desc: 'onlyRenderVisibleElements mounts just the viewport. DOM nodes cap far lower than SVG/WebGL.',
    code: `<ReactFlow
  nodes={nodes}
  edges={edges}
  onlyRenderVisibleElements
  nodesDraggable={false}
  elementsSelectable={false}
/>;`,
    demo: 'k-scale',
  },
];

/** React Flow code cookbook — the minimal snippets behind every pattern in this tab. */
export function FlowCookbookDemo(): ReactNode {
  return (
    <Cookbook
      basePath="/reactflow/demo"
      snippets={SNIPPETS}
      intro={
        <>
          The smallest correct snippets for the core patterns, using{' '}
          <code>@xyflow/react</code> (React Flow). Copy a block, or open its live demo.
        </>
      }
    />
  );
}
