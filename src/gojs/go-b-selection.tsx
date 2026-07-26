import { useCallback, useEffect, useState, type ReactNode } from 'react';
import * as go from 'gojs';

import { GoCanvas } from './go-canvas.tsx';
import { createGoModel } from './adapt.ts';
import { makeFlowNodeTemplate, makeLinkTemplate } from './go-templates.ts';
import { createSampleCells } from '../data/sample-graph.ts';

function initDiagram(diagram: go.Diagram): void {
  diagram.nodeTemplate = makeFlowNodeTemplate();
  diagram.linkTemplate = makeLinkTemplate();
  diagram.model = createGoModel(createSampleCells(false));
}

/** The key of a selected part, whether it is a node or a link. */
function keyOf(part: go.Part | null): string | null {
  if (part === null) {
    return null;
  }
  const key: unknown = part instanceof go.Link ? part.data?.key : part.key;
  return typeof key === 'string' || typeof key === 'number' ? String(key) : null;
}

/**
 * Demo b (GoJS) — single selection across nodes and links.
 *
 * Selection is entirely GoJS's: clicking, clearing on background click, and the
 * accent outline (a `selectionAdornmentTemplate` on the shared templates). All
 * this component does is mirror the current selection into React for the chip.
 */
export function GoSelectionDemo(): ReactNode {
  const [diagram, setDiagram] = useState<go.Diagram | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const init = useCallback(initDiagram, []);

  useEffect(() => {
    if (diagram === null) {
      return;
    }
    const onChanged = (): void => setSelectedId(keyOf(diagram.selection.first()));
    diagram.addDiagramListener('ChangedSelection', onChanged);
    return () => {
      diagram.removeDiagramListener('ChangedSelection', onChanged);
    };
  }, [diagram]);

  const clear = useCallback(() => diagram?.clearSelection(), [diagram]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        clear();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [clear]);

  return (
    <div className="stage">
      <div className="toolbar">
        <div className="chips">
          <span className="chip">
            selected <b>{selectedId ?? '—'}</b>
          </span>
        </div>
        <span className="hint">
          Click any node or link to select it · click empty space or press Esc to clear
        </span>
        <button type="button" className="btn" onClick={clear} disabled={selectedId === null}>
          Clear selection
        </button>
      </div>
      <div className="stage__canvas">
        <GoCanvas init={init} onReady={setDiagram} canZoomToSelection />
      </div>
    </div>
  );
}
