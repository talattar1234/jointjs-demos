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
  GraphProvider,
  useCellId,
  useGraph,
  useMarkup,
  useOnGraphEvents,
  type CellRecord,
  type ElementRecord,
  type GraphJSON,
  type RenderElement,
} from '@joint/react';
import type { dia } from '@joint/core';

import { DiagramCanvas } from '../components/diagram-canvas.tsx';
import { SelectionLayer, SelectionProvider, useSelection } from '../hooks/use-selection.tsx';

interface EditorData {
  readonly [key: string]: unknown;
  readonly label: string;
}

const NODE_W = 150;
const NODE_H = 56;

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

function EditorNode({ data }: Readonly<{ data: EditorData }>): ReactNode {
  const id = useCellId();
  const { magnetRef } = useMarkup();
  const { editingId, commit, cancel } = useEditor();
  const isEditing = editingId === id;

  return (
    <g>
      <rect className="ednode" width={NODE_W} height={NODE_H} rx={12} />
      {isEditing ? (
        <foreignObject width={NODE_W} height={NODE_H}>
          <EditInput initial={data.label} onCommit={(value) => commit(id, value)} onCancel={cancel} />
        </foreignObject>
      ) : (
        <text className="ednode__text" x={NODE_W / 2} y={NODE_H / 2} textAnchor="middle" dominantBaseline="central">
          {data.label}
        </text>
      )}
      <circle ref={magnetRef('in')} className="edport" cx={0} cy={NODE_H / 2} r={7} />
      <circle ref={magnetRef('out')} className="edport" cx={NODE_W} cy={NODE_H / 2} r={7} />
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
          Drag a port (◦) to another node to connect · double-click a node to rename · click to select
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

/** Demo j — an interactive editor: connect by dragging ports, rename inline, undo/redo. */
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
