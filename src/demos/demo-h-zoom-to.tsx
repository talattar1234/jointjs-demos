import { useCallback, type ReactNode } from 'react';
import { GraphProvider, type RenderElement } from '@joint/react';

import { DiagramCanvas } from '../components/diagram-canvas.tsx';
import { FlowNode } from '../components/flow-node.tsx';
import { SelectionLayer, SelectionProvider, useSelection } from '../hooks/use-selection.tsx';
import { useZoomPanControls } from '../hooks/use-zoom-pan.ts';
import { createSampleCells, type FlowNodeData } from '../data/sample-graph.ts';

const initialCells = createSampleCells(false);
const renderElement: RenderElement<FlowNodeData> = (data) => <FlowNode data={data} />;

/** Overlay panel of code-driven zoom buttons; reads the canvas zoom via context. */
function ZoomToolbar(): ReactNode {
  const zoom = useZoomPanControls();
  const { selectedId } = useSelection();
  const canZoomToSelected = selectedId !== null;

  return (
    <div className="zoom-panel">
      <div className="zoom-panel__title">Programmatic zoom</div>
      <div className="zoom-panel__grid">
        <button type="button" className="btn" onClick={zoom.zoomIn}>
          Zoom in
        </button>
        <button type="button" className="btn" onClick={zoom.zoomOut}>
          Zoom out
        </button>
        <button type="button" className="btn" onClick={zoom.reset}>
          Reset 100%
        </button>
        <button type="button" className="btn" onClick={zoom.fitContent}>
          Fit all
        </button>
      </div>
      <button
        type="button"
        className="btn btn--primary"
        disabled={!canZoomToSelected}
        onClick={() => {
          if (selectedId !== null) {
            zoom.zoomToElement(selectedId);
          }
        }}
      >
        Zoom to selected
      </button>
      <div className="zoom-panel__hint">
        {Math.round(zoom.scale * 100)}% · click a node to select, then zoom to it
      </div>
    </div>
  );
}

function ZoomStage(): ReactNode {
  const { selectedId, select } = useSelection();
  const renderElementCb = useCallback(renderElement, []);

  return (
    <div className="stage">
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
        >
          <ZoomToolbar />
        </DiagramCanvas>
      </div>
    </div>
  );
}

/** Demo h — drive zoom entirely from code (buttons), including zoom-to-selected. */
export function ZoomToDemo(): ReactNode {
  return (
    <SelectionProvider>
      <GraphProvider initialCells={initialCells}>
        <ZoomStage />
      </GraphProvider>
    </SelectionProvider>
  );
}
