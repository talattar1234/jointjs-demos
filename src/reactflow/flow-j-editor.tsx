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
  NodeResizer,
  Position,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useOnSelectionChange,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
  type OnSelectionChangeFunc,
} from '@xyflow/react';

import { FlowCanvas } from './flow-canvas.tsx';
import { EDGE_DEFAULTS } from './adapt.ts';

interface EditorData extends Record<string, unknown> {
  readonly label: string;
  /** Rotation in degrees, clockwise. Applied as a CSS transform — see {@link EditorNodeView}. */
  readonly angle: number;
}

const NODE_W = 150;
const NODE_H = 56;
/** Floor for interactive resizing, matching the other two tabs. */
const MIN_W = 96;
const MIN_H = 40;
/** How far above the node's top edge the rotate handle floats, in px. */
const ROTATE_HANDLE_OFFSET = 28;
/** Rotation snaps to this many degrees unless Shift is held. */
const SNAP_DEGREES = 15;

const INITIAL_NODES: Node<EditorData>[] = [
  { id: 'a', type: 'editor', position: { x: 80, y: 80 }, data: { label: 'Ingest', angle: 0 }, width: NODE_W, height: NODE_H },
  { id: 'b', type: 'editor', position: { x: 360, y: 80 }, data: { label: 'Transform', angle: 0 }, width: NODE_W, height: NODE_H },
  { id: 'c', type: 'editor', position: { x: 360, y: 240 }, data: { label: 'Store', angle: 0 }, width: NODE_W, height: NODE_H },
];
const INITIAL_EDGES: Edge[] = [{ id: 'a->b', source: 'a', target: 'b', ...EDGE_DEFAULTS }];

/**
 * The clockwise angle, in degrees, that points from `center` to `point` — offset
 * so that "pointer directly above the center" reads as 0°, which is where the
 * rotate handle sits at rest. Snaps to {@link SNAP_DEGREES} unless Shift is held
 * (GoJS's convention, mirrored here so the three tabs feel the same).
 */
function angleFromCenter(
  center: { readonly x: number; readonly y: number },
  point: { readonly x: number; readonly y: number },
  isFreeAngle: boolean
): number {
  const degrees = (Math.atan2(point.y - center.y, point.x - center.x) * 180) / Math.PI + 90;
  const wrapped = ((degrees % 360) + 360) % 360;
  return isFreeAngle ? Math.round(wrapped) : Math.round(wrapped / SNAP_DEGREES) * SNAP_DEGREES;
}

/* -------------------------------------------------------------------------- */
/* Inline-edit context                                                         */
/* -------------------------------------------------------------------------- */

interface EditorContextValue {
  readonly editingId: string | null;
  readonly beginEdit: (id: string) => void;
  readonly commit: (id: string, label: string) => void;
  readonly cancel: () => void;
  /** Push the current graph onto the undo stack, before a gesture mutates it. */
  readonly record: () => void;
  readonly setAngle: (id: string, angle: number) => void;
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

/**
 * The rotate grip. React Flow ships `NodeResizer` but has no rotation tool, so
 * this is hand-rolled: pointer capture on a small round handle, and the angle
 * read straight off the pointer's position relative to the node's center in flow
 * coordinates (so it's zoom- and pan-independent).
 */
function RotateHandle({ nodeId }: Readonly<{ nodeId: string }>): ReactNode {
  const { getInternalNode, screenToFlowPosition } = useReactFlow();
  const { record, setAngle } = useEditor();
  const isRotating = useRef(false);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      // Keep the gesture off the pane: React Flow would otherwise start a node drag.
      event.stopPropagation();
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      isRotating.current = true;
      record();
    },
    [record]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isRotating.current) {
        return;
      }
      const node = getInternalNode(nodeId);
      if (node === undefined) {
        return;
      }
      const { positionAbsolute } = node.internals;
      const center = {
        x: positionAbsolute.x + (node.measured.width ?? 0) / 2,
        y: positionAbsolute.y + (node.measured.height ?? 0) / 2,
      };
      const pointer = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      setAngle(nodeId, angleFromCenter(center, pointer, event.shiftKey));
    },
    [getInternalNode, nodeId, screenToFlowPosition, setAngle]
  );

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    isRotating.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

  return (
    <div
      className="rf-rotate-handle nodrag nopan"
      style={{ top: -ROTATE_HANDLE_OFFSET }}
      title="Drag to rotate (hold Shift for a free angle)"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    />
  );
}

/**
 * Resizing is React Flow's own `NodeResizer`; rotation is not — the library has
 * no rotation tool, so `data.angle` is applied as a CSS transform on the card.
 *
 * That transform is invisible to React Flow itself: the node's hit area,
 * selection outline, resizer frame and floating-edge endpoints all keep using
 * the un-rotated box. Rotation here is presentational, where the GoJS tab
 * rotates the real geometry.
 */
function EditorNodeView({ id, data, selected }: NodeProps<Node<EditorData>>): ReactNode {
  const { editingId, commit, cancel, record } = useEditor();
  const isEditing = editingId === id;
  const isSelected = selected === true;

  return (
    <>
      <NodeResizer
        isVisible={isSelected}
        minWidth={MIN_W}
        minHeight={MIN_H}
        onResizeStart={record}
        handleClassName="rf-resize-handle"
        lineClassName="rf-resize-line"
      />
      <div className="rf-ednode" style={{ transform: `rotate(${data.angle}deg)` }}>
        <Handle type="target" position={Position.Left} className="rf-port" />
        {isEditing ? (
          <EditInput initial={data.label} onCommit={(value) => commit(id, value)} onCancel={cancel} />
        ) : (
          <span className="rf-ednode__text">{data.label}</span>
        )}
        <Handle type="source" position={Position.Right} className="rf-port" />
        {isSelected && <RotateHandle nodeId={id} />}
      </div>
    </>
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

  // Memoized so useOnSelectionChange keeps a stable subscription (an inline
  // handler resubscribes every render and breaks selection tracking).
  const onSelectionChange = useCallback<OnSelectionChangeFunc>(
    ({ nodes: selectedNodes }) => setSelectedId(selectedNodes[0]?.id ?? null),
    []
  );
  useOnSelectionChange({ onChange: onSelectionChange });

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
      record,
      setAngle: (id, angle) =>
        setNodes((previous) =>
          previous.map((node) => (node.id === id ? { ...node, data: { ...node.data, angle } } : node))
        ),
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
        data: { label: `Node ${index}`, angle: 0 },
        width: NODE_W,
        height: NODE_H,
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
            Drag a port (○) to another node to connect · double-click a node to rename · drag an edge
            handle to resize (React Flow's <code>NodeResizer</code>), the round grip above a node to
            rotate (Shift = free angle) · rotation is a CSS transform, so the hit box and edges stay
            axis-aligned
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

/**
 * Demo j (React Flow) — connect by dragging ports, rename inline, resize,
 * rotate, undo/redo.
 */
export function FlowEditorDemo(): ReactNode {
  return (
    <ReactFlowProvider>
      <EditorStage />
    </ReactFlowProvider>
  );
}
