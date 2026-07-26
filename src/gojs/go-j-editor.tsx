import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import * as go from 'gojs';

import { GoCanvas } from './go-canvas.tsx';
import { makeLinkTemplate } from './go-templates.ts';
import type { GoLinkData } from './adapt.ts';

const NODE_W = 150;
const NODE_H = 56;
/** Radius of the draggable connection ports. */
const PORT_SIZE = 10;
/** Side of a square resize handle, and of the round rotate handle. */
const HANDLE_SIZE = 7;
/** Floor for interactive resizing, so a node can never be dragged to nothing. */
const MIN_SIZE = new go.Size(96, 40);
/** Horizontal room the label gives up to the two ports. */
const LABEL_INSET = 34;
/** Rotation snaps to this many degrees unless Shift is held. */
const SNAP_DEGREES = 15;

/**
 * The editor's node datum. Unlike the other GoJS demos this one doesn't reuse
 * `GoNodeData`: size and angle are user-editable here, so they're stored in the
 * stringified form GoJS's two-way bindings round-trip (`"150 56"`) rather than
 * as the fixed `width`/`height` numbers the shared templates read.
 */
interface EditorNodeData extends go.ObjectData {
  key: string;
  /** Top-left position in `go.Point.stringify` form, e.g. `"60 40"`. */
  loc: string;
  /** Body size in `go.Size.stringify` form, e.g. `"150 56"`. */
  size: string;
  /** Rotation in degrees, clockwise. */
  angle: number;
  label: string;
}

const DEFAULT_SIZE = go.Size.stringify(new go.Size(NODE_W, NODE_H));

function initialNodes(): EditorNodeData[] {
  return [
    { key: 'a', loc: '80 80', size: DEFAULT_SIZE, angle: 0, label: 'Ingest' },
    { key: 'b', loc: '360 80', size: DEFAULT_SIZE, angle: 0, label: 'Transform' },
    { key: 'c', loc: '360 240', size: DEFAULT_SIZE, angle: 0, label: 'Store' },
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

/** One handle of the resize adornment. Its `alignment` tells GoJS which edge it drags. */
function makeResizeHandle(alignment: go.Spot, cursor: string): go.Shape {
  return new go.Shape({
    alignment,
    cursor,
    desiredSize: new go.Size(HANDLE_SIZE, HANDLE_SIZE),
    strokeWidth: 1.5,
  })
    .theme('fill', 'adornmentFill')
    .theme('stroke', 'selection');
}

/**
 * The eight resize handles. GoJS's stock adornment hard-codes a blue that
 * ignores the app's light/dark toggle, so it's restated here with theme bindings
 * (see the CSS-can't-reach-the-canvas note in CLAUDE.md).
 */
function makeResizeAdornment(): go.Adornment {
  return new go.Adornment('Spot').add(
    new go.Placeholder(),
    makeResizeHandle(go.Spot.TopLeft, 'nw-resize'),
    makeResizeHandle(go.Spot.Top, 'n-resize'),
    makeResizeHandle(go.Spot.TopRight, 'ne-resize'),
    makeResizeHandle(go.Spot.Left, 'w-resize'),
    makeResizeHandle(go.Spot.Right, 'e-resize'),
    makeResizeHandle(go.Spot.BottomLeft, 'sw-resize'),
    makeResizeHandle(go.Spot.Bottom, 's-resize'),
    makeResizeHandle(go.Spot.BottomRight, 'se-resize')
  );
}

/** The single round handle the `RotatingTool` swings the node around by. */
function makeRotateAdornment(): go.Adornment {
  return new go.Adornment().add(
    new go.Shape('Circle', {
      cursor: 'grab',
      desiredSize: new go.Size(HANDLE_SIZE + 3, HANDLE_SIZE + 3),
      strokeWidth: 1.5,
    })
      .theme('fill', 'adornmentFill')
      .theme('stroke', 'selection')
  );
}

/**
 * The editor node: a card with an inline-editable label, a port on each side,
 * and handles for resizing and rotating. `editable: true` on the TextBlock is
 * all GoJS needs for rename — its `TextEditingTool` supplies the input, commits
 * into the model, and records the edit for undo; `resizable` / `rotatable` hand
 * the other two gestures to `ResizingTool` and `RotatingTool` the same way.
 *
 * Every gesture writes through a two-way binding (`loc`, `size`, `angle`,
 * `label`), which is what makes it land in the model — and therefore in undo.
 */
function makeEditorNodeTemplate(): go.Node {
  const node = new go.Node('Spot', {
    locationSpot: go.Spot.TopLeft,
    resizable: true,
    resizeObjectName: 'BODY',
    rotatable: true,
    selectionAdornmentTemplate: new go.Adornment('Auto').add(
      new go.Shape('RoundedRectangle', { fill: null, strokeWidth: 2, parameter1: 11 }).theme(
        'stroke',
        'selection'
      ),
      new go.Placeholder({ padding: new go.Margin(1) })
    ),
    resizeAdornmentTemplate: makeResizeAdornment(),
    rotateAdornmentTemplate: makeRotateAdornment(),
  })
    .bindTwoWay('location', 'loc', go.Point.parse, go.Point.stringify)
    .bindTwoWay('angle');

  return node.add(
    new go.Shape('RoundedRectangle', {
      name: 'BODY',
      parameter1: 10,
      strokeWidth: 1.5,
      minSize: MIN_SIZE,
    })
      .bindTwoWay('desiredSize', 'size', go.Size.parse, go.Size.stringify)
      .theme('fill', 'nodeFill')
      .theme('stroke', 'nodeStroke'),
    new go.TextBlock({
      editable: true,
      overflow: go.TextOverflow.Ellipsis,
      maxLines: 1,
      textAlign: 'center',
    })
      .bindTwoWay('text', 'label')
      // Follows the body as it's resized, so a narrowed node ellipsizes.
      .bind('width', 'size', (size: string) => Math.max(1, go.Size.parse(size).width - LABEL_INSET))
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
  diagram.toolManager.resizingTool.minSize = MIN_SIZE;
  // Snap to 15° steps; GoJS's own convention is that Shift *suspends* snapping,
  // so the hand-rolled tabs mirror that rather than the reverse.
  diagram.toolManager.rotatingTool.snapAngleMultiple = SNAP_DEGREES;
  diagram.toolManager.rotatingTool.snapAngleEpsilon = SNAP_DEGREES;
}

/**
 * Demo j (GoJS) — connect by dragging ports, rename inline, resize, rotate,
 * undo/redo.
 *
 * This is the demo GoJS gives away for free. The JointJS tab hand-rolls a
 * snapshot-based history, an HTML rename overlay and its own resize/rotate
 * handles; React Flow ships a resizer but no rotation, so that tab hand-rolls
 * the rotation and the history. Here `LinkingTool`, `TextEditingTool`,
 * `ResizingTool`, `RotatingTool` and `UndoManager` are all built in, so the
 * component is mostly wiring buttons to `CommandHandler`.
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
        size: DEFAULT_SIZE,
        angle: 0,
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
          Drag a port (○) to another node to connect · double-click a node to rename · drag a square
          handle to resize, the round one to rotate (Shift = free angle) · Del removes the selection ·
          resize, rotate and undo/redo are GoJS's own <code>ResizingTool</code>,{' '}
          <code>RotatingTool</code> and <code>UndoManager</code>
        </span>
      </div>
      <div className="stage__canvas">
        <GoCanvas init={init} onReady={setDiagram} />
      </div>
    </div>
  );
}
