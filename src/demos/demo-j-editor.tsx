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
  type RefObject,
} from 'react';
import {
  GraphProvider,
  selectElementAngle,
  selectElementPosition,
  selectElementSize,
  useCell,
  useCellId,
  useGraph,
  useMarkup,
  useOnGraphEvents,
  usePaper,
  type CellRecord,
  type ElementRecord,
  type GraphJSON,
  type RenderElement,
} from '@joint/react';
import type { dia, g } from '@joint/core';

import { DiagramCanvas } from '../components/diagram-canvas.tsx';
import { SelectionLayer, SelectionProvider, useSelection } from '../hooks/use-selection.tsx';

interface EditorData {
  readonly [key: string]: unknown;
  readonly label: string;
}

const NODE_W = 150;
const NODE_H = 56;
/** Floor for interactive resizing, matching the other two tabs. */
const MIN_W = 96;
const MIN_H = 40;
/** Side of a square resize handle. */
const HANDLE_SIZE = 8;
/** How far above the node's top edge the rotate handle floats. */
const ROTATE_OFFSET = 26;
/** Rotation snaps to this many degrees unless Shift is held. */
const SNAP_DEGREES = 15;

const initialCells: CellRecord<EditorData>[] = [
  { id: 'a', type: 'element', position: { x: 80, y: 80 }, size: { width: NODE_W, height: NODE_H }, data: { label: 'Ingest' } },
  { id: 'b', type: 'element', position: { x: 360, y: 80 }, size: { width: NODE_W, height: NODE_H }, data: { label: 'Transform' } },
  { id: 'c', type: 'element', position: { x: 360, y: 240 }, size: { width: NODE_W, height: NODE_H }, data: { label: 'Store' } },
  { id: 'a->b', type: 'link', source: { id: 'a' }, target: { id: 'b' }, style: { color: '#7c8bff', width: 2, targetMarker: 'arrow' } },
];

/* -------------------------------------------------------------------------- */
/* Inline-edit context                                                         */
/* -------------------------------------------------------------------------- */

interface EditorContextValue {
  readonly editingId: dia.Cell.ID | null;
  readonly beginEdit: (id: dia.Cell.ID) => void;
  readonly commit: (id: dia.Cell.ID, label: string) => void;
  readonly cancel: () => void;
}

const EditorContext = createContext<EditorContextValue | null>(null);

function useEditor(): EditorContextValue {
  const value = useContext(EditorContext);
  if (value === null) {
    throw new Error('useEditor must be used within an EditorProvider');
  }
  return value;
}

function EditorProvider({ children }: Readonly<{ children: ReactNode }>): ReactNode {
  const { setCellData } = useGraph<ElementRecord<EditorData>>();
  const [editingId, setEditingId] = useState<dia.Cell.ID | null>(null);

  const value = useMemo<EditorContextValue>(
    () => ({
      editingId,
      beginEdit: (id) => setEditingId(id),
      commit: (id, label) => {
        const trimmed = label.trim();
        if (trimmed !== '') {
          setCellData(id, (previous) => ({ ...previous, label: trimmed }));
        }
        setEditingId(null);
      },
      cancel: () => setEditingId(null),
    }),
    [editingId, setCellData]
  );

  return <EditorContext value={value}>{children}</EditorContext>;
}

/* -------------------------------------------------------------------------- */
/* Undo / redo history (change-driven snapshots)                               */
/* -------------------------------------------------------------------------- */

interface History {
  readonly undo: () => void;
  readonly redo: () => void;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

const HISTORY_DEBOUNCE_MS = 250;

/**
 * Undo/redo built on the declarative model: snapshots are `exportToJSON()`
 * results captured (debounced) after each graph change, and undo/redo replay
 * them with `importFromJSON()`. A guard flag keeps restore-triggered events
 * from polluting the history.
 */
function useGraphHistory(): History {
  const { exportToJSON, importFromJSON } = useGraph();
  const past = useRef<GraphJSON[]>([]);
  const future = useRef<GraphJSON[]>([]);
  const present = useRef<GraphJSON | null>(null);
  const restoring = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const [, force] = useReducer((count: number) => count + 1, 0);

  useEffect(() => {
    if (present.current === null) {
      present.current = exportToJSON();
    }
  }, [exportToJSON]);

  const commit = useCallback(() => {
    if (restoring.current) {
      return;
    }
    const snapshot = exportToJSON();
    if (present.current !== null) {
      past.current.push(present.current);
    }
    present.current = snapshot;
    future.current = [];
    force();
  }, [exportToJSON]);

  const schedule = useCallback(() => {
    if (restoring.current) {
      return;
    }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(commit, HISTORY_DEBOUNCE_MS);
  }, [commit]);

  useOnGraphEvents({
    add: schedule,
    remove: schedule,
    'change:source': schedule,
    'change:target': schedule,
    'change:position': schedule,
    'change:size': schedule,
    'change:angle': schedule,
    'change:data': schedule,
  });

  const restore = useCallback(
    (from: 'past' | 'future') => {
      const stackA = from === 'past' ? past.current : future.current;
      const stackB = from === 'past' ? future.current : past.current;
      if (stackA.length === 0 || present.current === null) {
        return;
      }
      const target = stackA.pop();
      if (target === undefined) {
        return;
      }
      stackB.push(present.current);
      present.current = target;
      restoring.current = true;
      importFromJSON(target);
      window.setTimeout(() => {
        restoring.current = false;
      }, 0);
      force();
    },
    [importFromJSON]
  );

  return {
    undo: () => restore('past'),
    redo: () => restore('future'),
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  };
}

/* -------------------------------------------------------------------------- */
/* Resize + rotate handles                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Rotate a vector clockwise by `degrees` — SVG's positive direction, since the
 * y axis points down. Passing `-angle` converts a paper-space delta into the
 * element's own unrotated frame.
 */
function rotateVector(x: number, y: number, degrees: number): { readonly x: number; readonly y: number } {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
}

/**
 * The clockwise angle, in degrees, from `center` to `point`, offset so that
 * "pointer directly above the center" reads as 0° — where the rotate handle sits
 * at rest. Snaps to {@link SNAP_DEGREES} unless Shift is held, which is GoJS's
 * convention (that tab can't invert it, so this one matches it).
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

/** Which corner a resize handle drags: `-1` is the left/top edge, `1` right/bottom. */
interface Corner {
  readonly sx: -1 | 1;
  readonly sy: -1 | 1;
  readonly cursor: string;
}

const CORNERS: readonly Corner[] = [
  { sx: -1, sy: -1, cursor: 'nwse-resize' },
  { sx: 1, sy: -1, cursor: 'nesw-resize' },
  { sx: -1, sy: 1, cursor: 'nesw-resize' },
  { sx: 1, sy: 1, cursor: 'nwse-resize' },
];

/** The element's live placement, mirrored into a ref for the handles to read. */
interface NodeGeometry {
  readonly position: dia.Point;
  readonly size: dia.Size;
  readonly angle: number;
}

/** …plus the pointer that opened the gesture, so each frame is absolute, not incremental. */
interface DragStart extends NodeGeometry {
  readonly pointer: g.Point;
}

/**
 * Wire a drag gesture onto one SVG handle, and hand each frame the pointer in
 * paper coordinates.
 *
 * The listeners are native and bound to the handle itself, which matters:
 * JointJS binds its own `mousedown` on the paper element, and that sits *between*
 * the handle and React's delegated root listener — so a React `onPointerDown`
 * would fire too late to stop the paper from starting an element drag. Blocking
 * `mousedown`/`touchstart` at the target is what keeps the two apart. (`@joint/plus`
 * ships a FreeTransform widget for this; it's off-limits here.)
 */
function useHandleDrag(
  onDragStart: (pointer: g.Point) => void,
  onDrag: (pointer: g.Point, event: PointerEvent) => void
): (node: SVGElement | null) => void {
  const { paper } = usePaper();

  return useCallback(
    (node: SVGElement | null) => {
      if (node === null || paper === null) {
        return;
      }
      const toPaper = (event: PointerEvent): g.Point =>
        paper.clientToLocalPoint({ x: event.clientX, y: event.clientY });

      const swallow = (event: Event): void => event.stopPropagation();

      const onPointerMove = (event: PointerEvent): void => onDrag(toPaper(event), event);

      const onPointerUp = (event: PointerEvent): void => {
        node.releasePointerCapture(event.pointerId);
        node.removeEventListener('pointermove', onPointerMove);
        node.removeEventListener('pointerup', onPointerUp);
        node.removeEventListener('pointercancel', onPointerUp);
      };

      const onPointerDown = (event: PointerEvent): void => {
        event.stopPropagation();
        event.preventDefault();
        node.setPointerCapture(event.pointerId);
        onDragStart(toPaper(event));
        node.addEventListener('pointermove', onPointerMove);
        node.addEventListener('pointerup', onPointerUp);
        node.addEventListener('pointercancel', onPointerUp);
      };

      node.addEventListener('pointerdown', onPointerDown);
      node.addEventListener('mousedown', swallow);
      node.addEventListener('touchstart', swallow);

      return () => {
        node.removeEventListener('pointerdown', onPointerDown);
        node.removeEventListener('mousedown', swallow);
        node.removeEventListener('touchstart', swallow);
      };
    },
    [paper, onDrag, onDragStart]
  );
}

/**
 * One corner grip. Resizing keeps the opposite corner planted, which for a
 * rotated element means the pointer delta has to be taken into the element's own
 * frame, and the resulting center shift taken back out of it.
 */
function ResizeHandle({
  corner,
  data,
  width,
  height,
  geometry,
}: Readonly<{
  corner: Corner;
  data: EditorData;
  width: number;
  height: number;
  geometry: RefObject<NodeGeometry>;
}>): ReactNode {
  const id = useCellId();
  const { setCell } = useGraph<ElementRecord<EditorData>>();
  const start = useRef<DragStart | null>(null);

  const onDragStart = useCallback(
    (pointer: g.Point) => {
      start.current = { ...geometry.current, pointer };
    },
    [geometry]
  );

  const onDrag = useCallback(
    (pointer: g.Point) => {
      const from = start.current;
      if (from === null) {
        return;
      }
      const local = rotateVector(pointer.x - from.pointer.x, pointer.y - from.pointer.y, -from.angle);
      const nextWidth = Math.max(MIN_W, from.size.width + corner.sx * local.x);
      const nextHeight = Math.max(MIN_H, from.size.height + corner.sy * local.y);
      // Half the growth, in the element's frame, then rotated back into paper space.
      const shift = rotateVector(
        (corner.sx * (nextWidth - from.size.width)) / 2,
        (corner.sy * (nextHeight - from.size.height)) / 2,
        from.angle
      );
      const centerX = from.position.x + from.size.width / 2 + shift.x;
      const centerY = from.position.y + from.size.height / 2 + shift.y;
      setCell({
        id,
        type: 'element',
        data,
        size: { width: nextWidth, height: nextHeight },
        position: { x: centerX - nextWidth / 2, y: centerY - nextHeight / 2 },
      });
    },
    [corner, data, id, setCell]
  );

  const handleRef = useHandleDrag(onDragStart, onDrag);

  return (
    <rect
      ref={handleRef}
      className="edhandle"
      x={(corner.sx < 0 ? 0 : width) - HANDLE_SIZE / 2}
      y={(corner.sy < 0 ? 0 : height) - HANDLE_SIZE / 2}
      width={HANDLE_SIZE}
      height={HANDLE_SIZE}
      rx={2}
      style={{ cursor: corner.cursor }}
    />
  );
}

/** The rotate grip, floating above the node on a short tether. */
function RotateHandle({
  data,
  width,
  geometry,
}: Readonly<{
  data: EditorData;
  width: number;
  geometry: RefObject<NodeGeometry>;
}>): ReactNode {
  const id = useCellId();
  const { setCell } = useGraph<ElementRecord<EditorData>>();
  const start = useRef<DragStart | null>(null);

  const onDragStart = useCallback(
    (pointer: g.Point) => {
      start.current = { ...geometry.current, pointer };
    },
    [geometry]
  );

  const onDrag = useCallback(
    (pointer: g.Point, event: PointerEvent) => {
      const from = start.current;
      if (from === null) {
        return;
      }
      // Rotation is about the element's center, which the gesture never moves.
      const center = {
        x: from.position.x + from.size.width / 2,
        y: from.position.y + from.size.height / 2,
      };
      setCell({ id, type: 'element', data, angle: angleFromCenter(center, pointer, event.shiftKey) });
    },
    [data, id, setCell]
  );

  const handleRef = useHandleDrag(onDragStart, onDrag);

  return (
    <g>
      <line className="edrotate__tether" x1={width / 2} y1={0} x2={width / 2} y2={-ROTATE_OFFSET} />
      <circle
        ref={handleRef}
        className="edrotate"
        cx={width / 2}
        cy={-ROTATE_OFFSET}
        r={HANDLE_SIZE / 2 + 1.5}
      />
    </g>
  );
}

/**
 * The transform overlay drawn on the selected node: four corner grips plus the
 * rotate handle. Live geometry is mirrored into a ref so a drag reads the state
 * it started from rather than a stale closure.
 */
function TransformHandles({
  data,
  width,
  height,
}: Readonly<{ data: EditorData; width: number; height: number }>): ReactNode {
  const position = useCell(selectElementPosition);
  const angle = useCell(selectElementAngle);
  const geometry = useRef<NodeGeometry>({ position, size: { width, height }, angle });

  // Refreshed every render, snapshotted by a handle when its drag begins.
  geometry.current = { position, size: { width, height }, angle };

  return (
    <g className="edhandles">
      {CORNERS.map((corner) => (
        <ResizeHandle
          key={`${corner.sx},${corner.sy}`}
          corner={corner}
          data={data}
          width={width}
          height={height}
          geometry={geometry}
        />
      ))}
      <RotateHandle data={data} width={width} geometry={geometry} />
    </g>
  );
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
    <div className="ednode__edit">
      <input
        ref={ref}
        className="ednode__input"
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
    </div>
  );
}

/**
 * The node body. It draws itself from the element's live `size` (rather than the
 * constants it started at) so the hand-rolled resize handles have something to
 * resize; JointJS applies the element's `angle` to the whole group for free.
 */
function EditorNode({ data }: Readonly<{ data: EditorData }>): ReactNode {
  const id = useCellId();
  const { magnetRef } = useMarkup();
  const { editingId, commit, cancel } = useEditor();
  const { selectedId } = useSelection();
  const { width, height } = useCell(selectElementSize);
  const isEditing = editingId === id;

  return (
    <g>
      <rect className="ednode" width={width} height={height} rx={12} />
      {isEditing ? (
        <foreignObject width={width} height={height}>
          <EditInput initial={data.label} onCommit={(value) => commit(id, value)} onCancel={cancel} />
        </foreignObject>
      ) : (
        <text className="ednode__text" x={width / 2} y={height / 2} textAnchor="middle" dominantBaseline="central">
          {data.label}
        </text>
      )}
      <circle ref={magnetRef('in')} className="edport" cx={0} cy={height / 2} r={7} />
      <circle ref={magnetRef('out')} className="edport" cx={width} cy={height / 2} r={7} />
      {selectedId === id && <TransformHandles data={data} width={width} height={height} />}
    </g>
  );
}

const renderElement: RenderElement<EditorData> = (data) => <EditorNode data={data} />;

/* -------------------------------------------------------------------------- */
/* Stage                                                                       */
/* -------------------------------------------------------------------------- */

function EditorStage(): ReactNode {
  const { selectedId, select } = useSelection();
  const { beginEdit } = useEditor();
  const { setCell, removeCells, graph } = useGraph<ElementRecord<EditorData>>();
  const history = useGraphHistory();
  const counter = useRef(0);
  const renderElementCb = useCallback(renderElement, []);

  const addNode = useCallback(() => {
    counter.current += 1;
    const index = counter.current;
    const id = `new-${index}`;
    setCell({
      id,
      type: 'element',
      position: { x: 100 + (index % 4) * 60, y: 380 + Math.floor(index / 4) * 40 },
      size: { width: NODE_W, height: NODE_H },
      data: { label: `Node ${index}` },
    });
    select(id);
  }, [setCell, select]);

  const deleteSelected = useCallback(() => {
    if (selectedId === null) {
      return;
    }
    const cell = graph.getCell(selectedId);
    const connected = cell === undefined ? [] : graph.getConnectedLinks(cell).map((link) => link.id);
    removeCells([selectedId, ...connected]);
    select(null);
  }, [graph, removeCells, selectedId, select]);

  return (
    <div className="stage">
      <div className="toolbar">
        <button type="button" className="btn btn--primary" onClick={addNode}>
          + Add node
        </button>
        <button type="button" className="btn" onClick={deleteSelected} disabled={selectedId === null}>
          Delete selected
        </button>
        <div className="chips">
          <button type="button" className="btn" onClick={history.undo} disabled={!history.canUndo}>
            ↶ Undo
          </button>
          <button type="button" className="btn" onClick={history.redo} disabled={!history.canRedo}>
            ↷ Redo
          </button>
        </div>
        <span className="hint">
          Drag a port (◦) to another node to connect · double-click a node to rename · drag a corner to
          resize, the grip above to rotate (Shift = free angle) · handles are hand-rolled SVG, since
          FreeTransform lives in <code>@joint/plus</code>
        </span>
      </div>
      <div className="stage__canvas">
        <SelectionLayer />
        <DiagramCanvas<EditorData>
          renderElement={renderElementCb}
          paperProps={{
            drawGrid: { name: 'mesh', args: { color: 'rgba(140,150,190,0.12)' } },
            gridSize: 20,
            snapLinks: { radius: 24 },
            defaultLink: { type: 'link', style: { color: '#7c8bff', width: 2, targetMarker: 'arrow' } },
            options: {
              defaultRouter: { name: 'orthogonal' },
              defaultConnector: { name: 'rounded', args: { radius: 10 } },
            },
            onElementPointerClick: ({ id }) => select(id),
            onElementPointerDblClick: ({ id }) => beginEdit(id),
            onLinkPointerClick: ({ id }) => select(id),
            onBlankPointerClick: () => select(null),
          }}
        />
      </div>
    </div>
  );
}

/**
 * Demo j — an interactive editor: connect by dragging ports, rename inline,
 * resize, rotate, undo/redo. Everything here is hand-rolled on the free stack —
 * GoJS ships all four gestures as tools, React Flow ships the resizer only.
 */
export function EditorDemo(): ReactNode {
  return (
    <SelectionProvider>
      <GraphProvider initialCells={initialCells}>
        <EditorProvider>
          <EditorStage />
        </EditorProvider>
      </GraphProvider>
    </SelectionProvider>
  );
}
