import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  addEdge,
  Handle,
  Position,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useOnSelectionChange,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from '@xyflow/react';

import { FlowCanvas } from './flow-canvas.tsx';
import { EDGE_DEFAULTS } from './adapt.ts';

interface EditorData extends Record<string, unknown> {
  readonly label: string;
}

const NODE_W = 150;
const NODE_H = 56;

const INITIAL_NODES: Node<EditorData>[] = [
  { id: 'a', type: 'editor', position: { x: 80, y: 80 }, data: { label: 'Ingest' }, style: { width: NODE_W, height: NODE_H } },
  { id: 'b', type: 'editor', position: { x: 360, y: 80 }, data: { label: 'Transform' }, style: { width: NODE_W, height: NODE_H } },
  { id: 'c', type: 'editor', position: { x: 360, y: 240 }, data: { label: 'Store' }, style: { width: NODE_W, height: NODE_H } },
];
const INITIAL_EDGES: Edge[] = [{ id: 'a->b', source: 'a', target: 'b', ...EDGE_DEFAULTS }];

/* -------------------------------------------------------------------------- */
/* Inline-edit context                                                         */
/* -------------------------------------------------------------------------- */

interface EditorContextValue {
  readonly editingId: string | null;
  readonly beginEdit: (id: string) => void;
  readonly commit: (id: string, label: string) => void;
  readonly cancel: () => void;
}

const EditorContext = createContext<EditorContextValue | null>(null);

function useEditor(): EditorContextValue {
  const value = useContext(EditorContext);
  if (value === null) {
    throw new Error('useEditor must be used within the editor stage');
  }
  return value;
}

/* -------------------------------------------------------------------------- */
/* Node renderer                                                               */
/* -------------------------------------------------------------------------- */

function EditInput({
  initial,
  onCommit,
  onCancel,
}: Readonly<{ initial: string; onCommit: (value: string) => void; onCancel: () => void }>): ReactNode {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  return (
    <input
      ref={ref}
      className="rf-ednode__input nodrag nopan"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          onCommit(value);
        } else if (event.key === 'Escape') {
          onCancel();
        }
      }}
      onBlur={() => onCommit(value)}
    />
  );
}

function EditorNodeView({ id, data }: NodeProps<Node<EditorData>>): ReactNode {
  const { editingId, commit, cancel } = useEditor();
  const isEditing = editingId === id;

  return (
    <div className="rf-ednode">
      <Handle type="target" position={Position.Left} className="rf-port" />
      {isEditing ? (
        <EditInput initial={data.label} onCommit={(value) => commit(id, value)} onCancel={cancel} />
      ) : (
        <span className="rf-ednode__text">{data.label}</span>
      )}
      <Handle type="source" position={Position.Right} className="rf-port" />
    </div>
  );
}

const EDITOR_NODE_TYPES: NodeTypes = { editor: EditorNodeView };

/* -------------------------------------------------------------------------- */
/* Stage (state, history, wiring)                                              */
/* -------------------------------------------------------------------------- */

interface Snapshot {
  readonly nodes: Node<EditorData>[];
  readonly edges: Edge[];
}

function EditorStage(): ReactNode {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<EditorData>>(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const counter = useRef(0);

  // Live mirrors so history snapshots capture the latest immutable arrays.
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const edgesRef = useRef(edges);
  edgesRef.current = edges;

  const past = useRef<Snapshot[]>([]);
  const future = useRef<Snapshot[]>([]);
  const [, force] = useReducer((count: number) => count + 1, 0);

  /** Push the current state onto the undo stack before a mutation. */
  const record = useCallback(() => {
    past.current.push({ nodes: nodesRef.current, edges: edgesRef.current });
    future.current = [];
    force();
  }, []);

  const undo = useCallback(() => {
    const snapshot = past.current.pop();
    if (snapshot === undefined) {
      return;
    }
    future.current.push({ nodes: nodesRef.current, edges: edgesRef.current });
    setNodes(snapshot.nodes);
    setEdges(snapshot.edges);
    force();
  }, [setNodes, setEdges]);

  const redo = useCallback(() => {
    const snapshot = future.current.pop();
    if (snapshot === undefined) {
      return;
    }
    past.current.push({ nodes: nodesRef.current, edges: edgesRef.current });
    setNodes(snapshot.nodes);
    setEdges(snapshot.edges);
    force();
  }, [setNodes, setEdges]);

  useOnSelectionChange({
    onChange: ({ nodes: selectedNodes }) => setSelectedId(selectedNodes[0]?.id ?? null),
  });

  const editor = useMemo<EditorContextValue>(
    () => ({
      editingId,
      beginEdit: (id) => setEditingId(id),
      commit: (id, label) => {
        const trimmed = label.trim();
        if (trimmed !== '') {
          record();
          setNodes((previous) =>
            previous.map((node) => (node.id === id ? { ...node, data: { ...node.data, label: trimmed } } : node))
          );
        }
        setEditingId(null);
      },
      cancel: () => setEditingId(null),
    }),
    [editingId, record, setNodes]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      record();
      setEdges((previous) => addEdge({ ...connection, ...EDGE_DEFAULTS }, previous));
    },
    [record, setEdges]
  );

  const addNode = useCallback(() => {
    counter.current += 1;
    const index = counter.current;
    const id = `new-${index}`;
    record();
    setNodes((previous) => [
      ...previous.map((node) => ({ ...node, selected: false })),
      {
        id,
        type: 'editor',
        position: { x: 100 + (index % 4) * 60, y: 380 + Math.floor(index / 4) * 40 },
        data: { label: `Node ${index}` },
        style: { width: NODE_W, height: NODE_H },
        selected: true,
      },
    ]);
  }, [record, setNodes]);

  const deleteSelected = useCallback(() => {
    if (selectedId === null) {
      return;
    }
    record();
    setNodes((previous) => previous.filter((node) => node.id !== selectedId));
    setEdges((previous) => previous.filter((edge) => edge.source !== selectedId && edge.target !== selectedId && edge.id !== selectedId));
  }, [selectedId, record, setNodes, setEdges]);

  return (
    <EditorContext value={editor}>
      <div className="stage">
        <div className="toolbar">
          <button type="button" className="btn btn--primary" onClick={addNode}>
            + Add node
          </button>
          <button type="button" className="btn" onClick={deleteSelected} disabled={selectedId === null}>
            Delete selected
          </button>
          <div className="chips">
            <button type="button" className="btn" onClick={undo} disabled={past.current.length === 0}>
              ↶ Undo
            </button>
            <button type="button" className="btn" onClick={redo} disabled={future.current.length === 0}>
              ↷ Redo
            </button>
          </div>
          <span className="hint">
            Drag a port (○) to another node to connect · double-click a node to rename · click to select
          </span>
        </div>
        <div className="stage__canvas">
          <FlowCanvas<Node<EditorData>, Edge>
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={EDITOR_NODE_TYPES}
            deleteKeyCode={null}
            zoomOnDoubleClick={false}
            onNodeDragStart={record}
            onNodeDoubleClick={(_event: React.MouseEvent, node: Node) => setEditingId(node.id)}
          />
        </div>
      </div>
    </EditorContext>
  );
}

/** Demo j (React Flow) — connect by dragging ports, rename inline, undo/redo. */
export function FlowEditorDemo(): ReactNode {
  return (
    <ReactFlowProvider>
      <EditorStage />
    </ReactFlowProvider>
  );
}
