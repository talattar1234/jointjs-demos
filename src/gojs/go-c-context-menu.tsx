import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import * as go from 'gojs';

import { GoCanvas } from './go-canvas.tsx';
import { createGoModel, type GoNodeData } from './adapt.ts';
import { makeFlowNodeTemplate, makeLinkTemplate } from './go-templates.ts';
import { ContextMenu, type MenuState } from '../components/context-menu.tsx';
import {
  createSampleCells,
  FLOW_NODE_HEIGHT,
  FLOW_NODE_WIDTH,
  type FlowNodeData,
} from '../data/sample-graph.ts';

function initDiagram(diagram: go.Diagram): void {
  diagram.nodeTemplate = makeFlowNodeTemplate();
  diagram.linkTemplate = makeLinkTemplate();
  diagram.model = createGoModel(createSampleCells(false));
}

/** Screen coordinates of the event that triggered the current GoJS input. */
function screenPointOf(diagram: go.Diagram): { x: number; y: number } {
  const event = diagram.lastInput.event;
  return event instanceof MouseEvent ? { x: event.clientX, y: event.clientY } : { x: 0, y: 0 };
}

/** The `key` of a part's datum, as a string. */
function keyOf(part: go.Part): string {
  const key: unknown = part.data?.key;
  return typeof key === 'string' || typeof key === 'number' ? String(key) : '';
}

/**
 * Demo c (GoJS) — a custom React context menu, per target type, viewport-aware.
 *
 * GoJS ships its own `ContextMenuTool` that would draw the menu *inside* the
 * canvas as GoJS parts. We want the shared React `<ContextMenu>` instead, so we
 * leave every template's `contextMenu` unset and listen for the
 * `ObjectContextClicked` / `BackgroundContextClicked` diagram events GoJS raises
 * when it finds no menu to show, then position the React menu at the mouse.
 */
export function GoContextMenuDemo(): ReactNode {
  const [diagram, setDiagram] = useState<go.Diagram | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const counter = useRef(0);

  const init = useCallback(initDiagram, []);
  const closeMenu = useCallback(() => setMenu(null), []);

  useEffect(() => {
    if (diagram === null) {
      return;
    }

    const removePart = (part: go.Part): void => {
      // `Diagram.remove` takes connected links with it; `Model.removeNodeData`
      // would leave them dangling.
      diagram.commit((d) => d.remove(part), 'remove');
    };

    const toggleAlert = (node: go.Node): void => {
      const data: GoNodeData & FlowNodeData = node.data;
      diagram.model.commit((model) => model.set(data, 'alert', data.alert !== true), 'toggle alert');
    };

    const addNodeAtLastPoint = (): void => {
      counter.current += 1;
      const index = counter.current;
      const point = diagram.lastInput.documentPoint;
      diagram.model.commit((model) => {
        model.addNodeData({
          key: `ctx-${index}`,
          loc: go.Point.stringify(
            new go.Point(point.x - FLOW_NODE_WIDTH / 2, point.y - FLOW_NODE_HEIGHT / 2)
          ),
          width: FLOW_NODE_WIDTH,
          height: FLOW_NODE_HEIGHT,
          label: `Node ${index}`,
          kind: 'process',
        });
      }, 'add node');
    };

    const onObject = (event: go.DiagramEvent): void => {
      const part: unknown = event.subject.part;
      if (!(part instanceof go.Part)) {
        return;
      }
      const { x, y } = screenPointOf(diagram);
      if (part instanceof go.Link) {
        setMenu({
          x,
          y,
          title: 'Link',
          items: [{ label: 'Delete link', danger: true, onSelect: () => removePart(part) }],
        });
        return;
      }
      if (part instanceof go.Node) {
        setMenu({
          x,
          y,
          title: keyOf(part),
          items: [
            { label: 'Toggle alert', onSelect: () => toggleAlert(part) },
            { label: 'Delete node', danger: true, onSelect: () => removePart(part) },
          ],
        });
      }
    };

    const onBackground = (): void => {
      const { x, y } = screenPointOf(diagram);
      setMenu({
        x,
        y,
        title: 'Canvas',
        items: [
          { label: 'Add node here', onSelect: addNodeAtLastPoint },
          { label: 'Fit to view', onSelect: () => diagram.zoomToFit() },
        ],
      });
    };

    diagram.addDiagramListener('ObjectContextClicked', onObject);
    diagram.addDiagramListener('BackgroundContextClicked', onBackground);
    return () => {
      diagram.removeDiagramListener('ObjectContextClicked', onObject);
      diagram.removeDiagramListener('BackgroundContextClicked', onBackground);
    };
  }, [diagram]);

  return (
    <div className="stage">
      <div className="toolbar">
        <span className="hint">
          Right-click a node, a link, or empty canvas for a context-specific React menu.
        </span>
      </div>
      {/* GoJS suppresses the native menu itself; this guards the surrounding chrome. */}
      <div className="stage__canvas" onContextMenu={(event) => event.preventDefault()}>
        <GoCanvas init={init} onReady={setDiagram} />
      </div>
      <ContextMenu state={menu} onClose={closeMenu} />
    </div>
  );
}
