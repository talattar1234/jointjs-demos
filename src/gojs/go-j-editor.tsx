import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import * as go from 'gojs';

import { GoCanvas } from './go-canvas.tsx';
import { makeLinkTemplate } from './go-templates.ts';
import type { GoLinkData, GoNodeData } from './adapt.ts';

const NODE_W = 150;
const NODE_H = 56;
/** Radius of the draggable connection ports. */
const PORT_SIZE = 10;

interface EditorNodeData extends GoNodeData {
  label: string;
}

function initialNodes(): EditorNodeData[] {
  return [
    { key: 'a', loc: '80 80', width: NODE_W, height: NODE_H, label: 'Ingest' },
    { key: 'b', loc: '360 80', width: NODE_W, height: NODE_H, label: 'Transform' },
    { key: 'c', loc: '360 240', width: NODE_W, height: NODE_H, label: 'Store' },
  ];
}

function initialLinks(): GoLinkData[] {
  return [{ key: 'a->b', from: 'a', to: 'b' }];
}

/** One draggable connection port pinned to a side of the node. */
function makePort(id: string, side: go.Spot): go.Shape {
  return new go.Shape('Circle', {
    portId: id,
    width: PORT_SIZE,
    height: PORT_SIZE,
    strokeWidth: 2,
    cursor: 'crosshair',
    fromLinkable: true,
    toLinkable: true,
    fromSpot: side,
    toSpot: side,
    alignment: side,
    alignmentFocus: go.Spot.Center,
  })
    .theme('fill', 'accent')
    .theme('stroke', 'panel');
}

/**
 * The editor node: a card with an inline-editable label and a port on each side.
 * `editable: true` on the TextBlock is all GoJS needs for rename — its
 * `TextEditingTool` supplies the input, commits into the model, and records the
 * edit for undo.
 */
function makeEditorNodeTemplate(): go.Node {
  const node = new go.Node('Spot', {
    locationSpot: go.Spot.TopLeft,
    selectionAdornmentTemplate: new go.Adornment('Auto').add(
      new go.Shape('RoundedRectangle', { fill: null, strokeWidth: 2, parameter1: 11 }).theme(
        'stroke',
        'selection'
      ),
      new go.Placeholder({ padding: new go.Margin(1) })
    ),
  }).bindTwoWay('location', 'loc', go.Point.parse, go.Point.stringify);

  return node.add(
    new go.Shape('RoundedRectangle', { name: 'BODY', parameter1: 10, strokeWidth: 1.5 })
      .bind('desiredSize', '', (data: EditorNodeData) => new go.Size(data.width, data.height))
      .theme('fill', 'nodeFill')
      .theme('stroke', 'nodeStroke'),
    new go.TextBlock({
      editable: true,
      overflow: go.TextOverflow.Ellipsis,
      maxLines: 1,
      width: NODE_W - 34,
      textAlign: 'center',
    })
      .bindTwoWay('text', 'label')
      .theme('stroke', 'text')
      .theme('font', 'label'),
    makePort('L', go.Spot.Left),
    makePort('R', go.Spot.Right)
  );
}

function initDiagram(diagram: go.Diagram): void {
  diagram.nodeTemplate = makeEditorNodeTemplate();
  diagram.linkTemplate = makeLinkTemplate({ labelled: false });
  diagram.model = new go.GraphLinksModel<EditorNodeData, GoLinkData>(initialNodes(), initialLinks(), {
    linkKeyProperty: 'key',
  });
  // GoJS ships undo/redo; it just has to be switched on.
  diagram.undoManager.isEnabled = true;
  diagram.toolManager.textEditingTool.starting = go.TextEditingStarting.DoubleClick;
}

/**
 * Demo j (GoJS) — connect by dragging ports, rename inline, undo/redo.
 *
 * This is the demo GoJS gives away for free. The JointJS tab hand-rolls a
 * snapshot-based history and an HTML rename overlay, and the React Flow tab
 * hand-rolls the history too; here `LinkingTool`, `TextEditingTool` and
 * `UndoManager` are all built in, so the component is mostly wiring buttons to
 * `CommandHandler`.
 */
export function GoEditorDemo(): ReactNode {
  const [diagram, setDiagram] = useState<go.Diagram | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState({ canUndo: false, canRedo: false });
  const counter = useRef(0);

  const init = useCallback(initDiagram, []);

  useEffect(() => {
    if (diagram === null) {
      return;
    }
    const syncHistory = (): void =>
      setHistory({
        canUndo: diagram.commandHandler.canUndo(),
        canRedo: diagram.commandHandler.canRedo(),
      });
    const onSelection = (): void => {
      const first = diagram.selection.first();
      setSelectedId(first === null ? null : String(first.data?.key ?? ''));
    };
    syncHistory();
    diagram.addModelChangedListener(syncHistory);
    diagram.addDiagramListener('ChangedSelection', onSelection);
    return () => {
      diagram.removeModelChangedListener(syncHistory);
      diagram.removeDiagramListener('ChangedSelection', onSelection);
    };
  }, [diagram]);

  const addNode = useCallback(() => {
    if (diagram === null) {
      return;
    }
    counter.current += 1;
    const index = counter.current;
    const key = `new-${index}`;
    diagram.model.commit((model) => {
      model.addNodeData({
        key,
        loc: `${100 + (index % 4) * 60} ${380 + Math.floor(index / 4) * 40}`,
        width: NODE_W,
        height: NODE_H,
        label: `Node ${index}`,
      });
    }, 'add node');
    const added = diagram.findNodeForKey(key);
    if (added !== null) {
      diagram.select(added);
    }
  }, [diagram]);

  return (
    <div className="stage">
      <div className="toolbar">
        <button type="button" className="btn btn--primary" onClick={addNode}>
          + Add node
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => diagram?.commandHandler.deleteSelection()}
          disabled={selectedId === null}
        >
          Delete selected
        </button>
        <div className="chips">
          <button
            type="button"
            className="btn"
            onClick={() => diagram?.commandHandler.undo()}
            disabled={!history.canUndo}
          >
            ↶ Undo
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => diagram?.commandHandler.redo()}
            disabled={!history.canRedo}
          >
            ↷ Redo
          </button>
        </div>
        <span className="hint">
          Drag a port (○) to another node to connect · double-click a node to rename · Del removes the
          selection · undo/redo is GoJS's own <code>UndoManager</code>
        </span>
      </div>
      <div className="stage__canvas">
        <GoCanvas init={init} onReady={setDiagram} />
      </div>
    </div>
  );
}
