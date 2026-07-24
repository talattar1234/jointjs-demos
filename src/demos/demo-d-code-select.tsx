import { useCallback, useState, type ReactNode } from 'react';
import { GraphProvider, useGraph, type ElementRecord, type RenderElement } from '@joint/react';

import { DiagramCanvas } from '../components/diagram-canvas.tsx';
import { FlowNode } from '../components/flow-node.tsx';
import { SelectionLayer, SelectionProvider, useSelection } from '../hooks/use-selection.tsx';
import { createSampleCells, type FlowNodeData } from '../data/sample-graph.ts';

const initialCells = createSampleCells(false);
const renderElement: RenderElement<FlowNodeData> = (data) => <FlowNode data={data} />;

function CodeSelectStage(): ReactNode {
  const { selectedId, select } = useSelection();
  const { graph } = useGraph<ElementRecord<FlowNodeData>>();
  const [query, setQuery] = useState('process');
  const [error, setError] = useState<string | null>(null);
  const renderElementCb = useCallback(renderElement, []);

  const selectByQuery = useCallback(() => {
    const term = query.trim();
    if (term === '') {
      setError('Type a shape id or label first.');
      return;
    }
    const cells = graph.getCells();
    const byId = cells.find((cell) => String(cell.id) === term);
    const byLabel = cells.find((cell) => {
      const data = cell.get('data') as FlowNodeData | undefined;
      return data?.label?.toLowerCase() === term.toLowerCase();
    });
    const match = byId ?? byLabel;
    if (match === undefined) {
      setError(`No shape matches “${term}”.`);
      return;
    }
    setError(null);
    select(match.id);
  }, [graph, query, select]);

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
        <button type="button" className="btn" onClick={() => select(null)} disabled={selectedId === null}>
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
        <SelectionLayer />
        <DiagramCanvas<FlowNodeData>
          renderElement={renderElementCb}
          selectedId={selectedId}
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

/** Demo d — select a shape from code (input + button); shares state with demo b. */
export function CodeSelectDemo(): ReactNode {
  return (
    <SelectionProvider>
      <GraphProvider initialCells={initialCells}>
        <CodeSelectStage />
      </GraphProvider>
    </SelectionProvider>
  );
}
