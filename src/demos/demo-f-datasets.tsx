import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { GraphProvider, useGraph, type RenderElement } from '@joint/react';

import { DiagramCanvas } from '../components/diagram-canvas.tsx';
import { FlowNode } from '../components/flow-node.tsx';
import { SelectionLayer, SelectionProvider, useSelection } from '../hooks/use-selection.tsx';
import { DATASETS, type Dataset } from '../data/datasets.ts';
import type { FlowNodeData } from '../data/sample-graph.ts';

const renderElement: RenderElement<FlowNodeData> = (data) => <FlowNode data={data} />;

function DatasetStage(): ReactNode {
  const { resetCells } = useGraph();
  const { selectedId, select } = useSelection();
  const [activeId, setActiveId] = useState(DATASETS[0].id);
  const [fitSignal, setFitSignal] = useState(0);
  const renderElementCb = useCallback(renderElement, []);
  const didInit = useRef(false);

  const load = useCallback(
    (dataset: Dataset) => {
      resetCells(dataset.build());
      setActiveId(dataset.id);
      select(null);
      setFitSignal((value) => value + 1);
    },
    [resetCells, select]
  );

  useEffect(() => {
    if (didInit.current) {
      return;
    }
    didInit.current = true;
    load(DATASETS[0]);
  }, [load]);

  return (
    <div className="stage">
      <div className="toolbar">
        <div className="chips">
          {DATASETS.map((dataset) => (
            <button
              key={dataset.id}
              type="button"
              className={`btn ${dataset.id === activeId ? 'btn--primary' : ''}`}
              onClick={() => load(dataset)}
            >
              {dataset.label}
            </button>
          ))}
        </div>
        <span className="hint">Each button loads a different dataset and refits the view.</span>
      </div>
      <div className="stage__canvas">
        <SelectionLayer />
        <DiagramCanvas<FlowNodeData>
          renderElement={renderElementCb}
          fitSignal={fitSignal}
          fitOnMount={false}
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

/** Demo f — switch between datasets; the view refits and selection resets. */
export function DatasetsDemo(): ReactNode {
  return (
    <SelectionProvider>
      <GraphProvider>
        <DatasetStage />
      </GraphProvider>
    </SelectionProvider>
  );
}
