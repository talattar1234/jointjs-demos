import { useCallback, type ReactNode } from 'react';
import { GraphProvider, type RenderElement } from '@joint/react';

import { DiagramCanvas } from '../components/diagram-canvas.tsx';
import { FlowNode } from '../components/flow-node.tsx';
import { SelectionLayer, SelectionProvider, useSelection } from '../hooks/use-selection.tsx';
import { createSampleCells, type FlowNodeData } from '../data/sample-graph.ts';

const initialCells = createSampleCells(false);
const renderElement: RenderElement<FlowNodeData> = (data) => <FlowNode data={data} />;

function SelectionStage(): ReactNode {
  const { selectedId, select } = useSelection();
  const renderElementCb = useCallback(renderElement, []);

  return (
    <div className="stage">
      <div className="toolbar">
        <div className="chips">
          <span className="chip">
            selected <b>{selectedId ?? '—'}</b>
          </span>
        </div>
        <span className="hint">Click any node or link to select it · click empty space or press Esc to clear</span>
        <button type="button" className="btn" onClick={() => select(null)} disabled={selectedId === null}>
          Clear selection
        </button>
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

/** Demo b — single selection across elements and links. */
export function SelectionDemo(): ReactNode {
  return (
    <SelectionProvider>
      <GraphProvider initialCells={initialCells}>
        <SelectionStage />
      </GraphProvider>
    </SelectionProvider>
  );
}
