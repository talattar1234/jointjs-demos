import { useCallback, useRef, type ReactNode } from 'react';
import {
  GraphProvider,
  useCells,
  useGraph,
  type CellRecord,
  type ElementRecord,
  type RenderElement,
} from '@joint/react';

import { DiagramCanvas } from '../components/diagram-canvas.tsx';
import { FlowNode } from '../components/flow-node.tsx';
import { SelectionLayer, SelectionProvider, useSelection } from '../hooks/use-selection.tsx';
import {
  createSampleCells,
  FLOW_NODE_HEIGHT,
  FLOW_NODE_WIDTH,
  type FlowKind,
  type FlowNodeData,
} from '../data/sample-graph.ts';

const renderElement: RenderElement<FlowNodeData> = (data) => <FlowNode data={data} />;
const KINDS: readonly FlowKind[] = ['process', 'io', 'decision', 'start', 'end'];
const COLUMNS = 5;

function AddRemoveStage(): ReactNode {
  const { selectedId, select } = useSelection();
  const { setCell, removeCells, resetCells, graph } = useGraph<ElementRecord<FlowNodeData>>();
  const counter = useRef(0);
  const renderElementCb = useCallback(renderElement, []);
  const elementCount = useCells((cells) => cells.filter((cell) => cell.type === 'element').length);

  const addNode = useCallback(() => {
    counter.current += 1;
    const index = counter.current;
    const id = `added-${index}`;
    const column = (index - 1) % COLUMNS;
    const row = Math.floor((index - 1) / COLUMNS);
    setCell({
      id,
      type: 'element',
      position: { x: 60 + column * (FLOW_NODE_WIDTH + 24), y: 520 + row * (FLOW_NODE_HEIGHT + 26) },
      size: { width: FLOW_NODE_WIDTH, height: FLOW_NODE_HEIGHT },
      data: { label: `Node ${index}`, kind: KINDS[index % KINDS.length] },
    });
    select(id);
  }, [setCell, select]);

  const removeSelected = useCallback(() => {
    if (selectedId === null) {
      return;
    }
    const cell = graph.getCell(selectedId);
    // Remove the shape together with any links attached to it (no dangling links).
    const connected = cell === undefined ? [] : graph.getConnectedLinks(cell).map((link) => link.id);
    removeCells([selectedId, ...connected]);
    select(null);
  }, [graph, removeCells, selectedId, select]);

  const reset = useCallback(() => {
    counter.current = 0;
    resetCells(createSampleCells(false) as CellRecord<FlowNodeData>[]);
    select(null);
  }, [resetCells, select]);

  const clearAll = useCallback(() => {
    resetCells([]);
    select(null);
  }, [resetCells, select]);

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
            elements <b>{elementCount}</b>
          </span>
          <span className="chip">
            selected <b>{selectedId ?? '—'}</b>
          </span>
        </div>
        <span className="hint">Adds/removes update incrementally — the rest of the graph is never redrawn.</span>
      </div>
      <div className="stage__canvas">
        <SelectionLayer />
        <DiagramCanvas<FlowNodeData>
          renderElement={renderElementCb}
          paperProps={{
            drawGrid: { name: 'dot', args: { color: 'rgba(140,150,190,0.14)' } },
            gridSize: 16,
            options: {
              defaultRouter: { name: 'orthogonal' },
              defaultConnector: { name: 'rounded', args: { radius: 10 } },
            },
            onElementPointerClick: ({ id }) => select(id),
            onLinkPointerClick: ({ id }) => select(id),
            onBlankPointerClick: () => select(null),
          }}
        />
      </div>
    </div>
  );
}

/** Demo e — add and remove shapes without redrawing the whole diagram. */
export function AddRemoveDemo(): ReactNode {
  return (
    <SelectionProvider>
      <GraphProvider initialCells={createSampleCells(false)}>
        <AddRemoveStage />
      </GraphProvider>
    </SelectionProvider>
  );
}
