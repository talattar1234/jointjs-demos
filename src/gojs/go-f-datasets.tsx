import { useCallback, useState, type ReactNode } from 'react';
import type * as go from 'gojs';

import { GoCanvas } from './go-canvas.tsx';
import { createGoModel } from './adapt.ts';
import { makeFlowNodeTemplate, makeLinkTemplate } from './go-templates.ts';
import { DATASETS, type Dataset } from '../data/datasets.ts';

function initDiagram(diagram: go.Diagram): void {
  diagram.nodeTemplate = makeFlowNodeTemplate();
  diagram.linkTemplate = makeLinkTemplate();
  diagram.model = createGoModel(DATASETS[0].build());
}

/**
 * Demo f (GoJS) — switch between datasets; the view refits each time.
 *
 * Swapping `Diagram.model` rebuilds the whole graph against the templates that
 * are already installed. Unlike the React-state tabs there is no measure pass to
 * wait for, so the refit can happen immediately rather than on a timeout.
 */
export function GoDatasetsDemo(): ReactNode {
  const [diagram, setDiagram] = useState<go.Diagram | null>(null);
  const [activeId, setActiveId] = useState(DATASETS[0].id);

  const init = useCallback(initDiagram, []);

  const load = useCallback(
    (dataset: Dataset) => {
      if (diagram === null) {
        return;
      }
      diagram.model = createGoModel(dataset.build());
      diagram.zoomToFit();
      setActiveId(dataset.id);
    },
    [diagram]
  );

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
        <span className="hint">Each button assigns a new model and refits the view.</span>
      </div>
      <div className="stage__canvas">
        <GoCanvas init={init} onReady={setDiagram} />
      </div>
    </div>
  );
}
