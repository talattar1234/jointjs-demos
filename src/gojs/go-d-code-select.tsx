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

/** Find a node by exact key, else by case-insensitive label. */
function findNode(diagram: go.Diagram, term: string): go.Node | null {
  const byKey = diagram.findNodeForKey(term);
  if (byKey !== null) {
    return byKey;
  }
  const lowered = term.toLowerCase();
  const iterator = diagram.nodes;
  while (iterator.next()) {
    const label: unknown = iterator.value.data?.label;
    if (typeof label === 'string' && label.toLowerCase() === lowered) {
      return iterator.value;
    }
  }
  return null;
}

/**
 * Demo d (GoJS) — select a shape from code (input + button), then frame it.
 *
 * `Diagram.select` drives the same selection the mouse would, and
 * `zoomToRect` frames the match — no separate "selected id" state has to be
 * pushed into the model the way the React-state tabs do.
 */
export function GoCodeSelectDemo(): ReactNode {
  const [diagram, setDiagram] = useState<go.Diagram | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('process');
  const [error, setError] = useState<string | null>(null);

  const init = useCallback(initDiagram, []);

  useEffect(() => {
    if (diagram === null) {
      return;
    }
    const onChanged = (): void => {
      const first = diagram.selection.first();
      setSelectedId(first === null ? null : String(first.key));
    };
    diagram.addDiagramListener('ChangedSelection', onChanged);
    return () => {
      diagram.removeDiagramListener('ChangedSelection', onChanged);
    };
  }, [diagram]);

  const clear = useCallback(() => diagram?.clearSelection(), [diagram]);

  const selectByQuery = useCallback(() => {
    if (diagram === null) {
      return;
    }
    const term = query.trim();
    if (term === '') {
      setError('Type a shape id or label first.');
      return;
    }
    const match = findNode(diagram, term);
    if (match === null) {
      setError(`No shape matches “${term}”.`);
      return;
    }
    setError(null);
    diagram.select(match);
    // zoomToRect with Uniform picks the scale itself; the inflate sets how tight.
    diagram.zoomToRect(
      match.actualBounds.copy().inflate(FOCUS_PADDING, FOCUS_PADDING),
      go.AutoScale.Uniform
    );
  }, [diagram, query]);

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
        <button type="button" className="btn" onClick={clear} disabled={selectedId === null}>
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
        <GoCanvas init={init} onReady={setDiagram} />
      </div>
    </div>
  );
}
