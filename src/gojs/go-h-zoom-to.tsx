import { useCallback, useEffect, useState, type ReactNode } from 'react';
import * as go from 'gojs';

import { GoCanvas } from './go-canvas.tsx';
import { createGoModel } from './adapt.ts';
import { makeFlowNodeTemplate, makeLinkTemplate } from './go-templates.ts';
import { createSampleCells } from '../data/sample-graph.ts';

/** Slack around the framed node, in document units. */
const FOCUS_PADDING = 140;

function initDiagram(diagram: go.Diagram): void {
  diagram.nodeTemplate = makeFlowNodeTemplate();
  diagram.linkTemplate = makeLinkTemplate();
  diagram.model = createGoModel(createSampleCells(false));
}

/**
 * Overlay panel of code-driven zoom buttons. Everything here is a
 * `CommandHandler` command that GoJS already implements — the JointJS tab has to
 * hand-roll the same behavior on top of a React-held transform.
 */
function ZoomPanel({ diagram }: Readonly<{ diagram: go.Diagram }>): ReactNode {
  const [scale, setScale] = useState(diagram.scale);
  const [hasSelection, setHasSelection] = useState(false);

  useEffect(() => {
    const onViewport = (): void => setScale(diagram.scale);
    const onSelection = (): void => setHasSelection(diagram.selection.count > 0);
    diagram.addDiagramListener('ViewportBoundsChanged', onViewport);
    diagram.addDiagramListener('ChangedSelection', onSelection);
    return () => {
      diagram.removeDiagramListener('ViewportBoundsChanged', onViewport);
      diagram.removeDiagramListener('ChangedSelection', onSelection);
    };
  }, [diagram]);

  const zoomToSelected = (): void => {
    const part = diagram.selection.first();
    if (part === null) {
      return;
    }
    // zoomToRect with Uniform picks the scale itself; the inflate sets how tight.
    diagram.zoomToRect(part.actualBounds.copy().inflate(FOCUS_PADDING, FOCUS_PADDING), go.AutoScale.Uniform);
  };

  return (
    <div className="zoom-panel">
      <div className="zoom-panel__title">Programmatic zoom</div>
      <div className="zoom-panel__grid">
        <button type="button" className="btn" onClick={() => diagram.commandHandler.increaseZoom()}>
          Zoom in
        </button>
        <button type="button" className="btn" onClick={() => diagram.commandHandler.decreaseZoom()}>
          Zoom out
        </button>
        <button type="button" className="btn" onClick={() => diagram.commandHandler.resetZoom()}>
          Reset 100%
        </button>
        <button type="button" className="btn" onClick={() => diagram.zoomToFit()}>
          Fit all
        </button>
      </div>
      <button
        type="button"
        className="btn btn--primary"
        disabled={!hasSelection}
        onClick={zoomToSelected}
      >
        Zoom to selected
      </button>
      <div className="zoom-panel__hint">
        {Math.round(scale * 100)}% · click a node to select, then zoom to it
      </div>
    </div>
  );
}

/** Demo h (GoJS) — drive zoom entirely from code, including zoom-to-selected. */
export function GoZoomToDemo(): ReactNode {
  const [diagram, setDiagram] = useState<go.Diagram | null>(null);
  const init = useCallback(initDiagram, []);

  return (
    <div className="stage">
      <div className="stage__canvas">
        <GoCanvas init={init} onReady={setDiagram}>
          {diagram !== null && <ZoomPanel diagram={diagram} />}
        </GoCanvas>
      </div>
    </div>
  );
}
