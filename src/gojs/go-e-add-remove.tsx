import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import * as go from 'gojs';

import { GoCanvas } from './go-canvas.tsx';
import { createGoModel } from './adapt.ts';
import { makeFlowNodeTemplate, makeLinkTemplate } from './go-templates.ts';
import {
  createSampleCells,
  FLOW_NODE_HEIGHT,
  FLOW_NODE_WIDTH,
  type FlowKind,
} from '../data/sample-graph.ts';

const KINDS: readonly FlowKind[] = ['process', 'io', 'decision', 'start', 'end'];
const COLUMNS = 5;

function buildModel(): go.GraphLinksModel {
  return createGoModel(createSampleCells(false));
}

function initDiagram(diagram: go.Diagram): void {
  diagram.nodeTemplate = makeFlowNodeTemplate();
  diagram.linkTemplate = makeLinkTemplate();
  diagram.model = buildModel();
}

/**
 * Demo e (GoJS) — add and remove shapes incrementally.
 *
 * Every mutation is a `Model.commit`, GoJS's transaction wrapper. Inside it the
 * model raises fine-grained changed events, so GoJS updates just the affected
 * parts — the canvas equivalent of the surgical re-renders the other two tabs
 * get from React reconciliation.
 */
export function GoAddRemoveDemo(): ReactNode {
  const [diagram, setDiagram] = useState<go.Diagram | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nodeCount, setNodeCount] = useState(0);
  const counter = useRef(0);

  const init = useCallback(initDiagram, []);

  useEffect(() => {
    if (diagram === null) {
      return;
    }
    const syncCount = (): void => setNodeCount(diagram.model.nodeDataArray.length);
    const onSelection = (): void => {
      const first = diagram.selection.first();
      setSelectedId(first === null ? null : String(first.key));
    };
    syncCount();
    onSelection();
    diagram.addModelChangedListener(syncCount);
    diagram.addDiagramListener('ChangedSelection', onSelection);
    return () => {
      diagram.removeModelChangedListener(syncCount);
      diagram.removeDiagramListener('ChangedSelection', onSelection);
    };
  }, [diagram]);

  const addNode = useCallback(() => {
    if (diagram === null) {
      return;
    }
    counter.current += 1;
    const index = counter.current;
    const column = (index - 1) % COLUMNS;
    const row = Math.floor((index - 1) / COLUMNS);
    const key = `added-${index}`;
    diagram.model.commit((model) => {
      model.addNodeData({
        key,
        loc: `${60 + column * (FLOW_NODE_WIDTH + 24)} ${520 + row * (FLOW_NODE_HEIGHT + 26)}`,
        width: FLOW_NODE_WIDTH,
        height: FLOW_NODE_HEIGHT,
        label: `Node ${index}`,
        kind: KINDS[index % KINDS.length],
      });
    }, 'add node');
    const added = diagram.findNodeForKey(key);
    if (added !== null) {
      diagram.select(added);
    }
  }, [diagram]);

  const removeSelected = useCallback(() => {
    if (diagram === null) {
      return;
    }
    const part = diagram.selection.first();
    if (part === null) {
      return;
    }
    // Removes the node and everything linked to it in one transaction.
    diagram.commit((d) => d.remove(part), 'remove node');
  }, [diagram]);

  const reset = useCallback(() => {
    if (diagram === null) {
      return;
    }
    counter.current = 0;
    diagram.model = buildModel();
    diagram.zoomToFit();
  }, [diagram]);

  const clearAll = useCallback(() => {
    if (diagram === null) {
      return;
    }
    counter.current = 0;
    diagram.model = new go.GraphLinksModel([], [], { linkKeyProperty: 'key' });
  }, [diagram]);

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
            nodes <b>{nodeCount}</b>
          </span>
          <span className="chip">
            selected <b>{selectedId ?? '—'}</b>
          </span>
        </div>
        <span className="hint">
          Each change is one <code>Model.commit</code> — GoJS updates only the parts it touched.
        </span>
      </div>
      <div className="stage__canvas">
        <GoCanvas init={init} onReady={setDiagram} />
      </div>
    </div>
  );
}
