import { useCallback, useRef, useState, type ReactNode } from 'react';
import { GraphProvider, useGraph, type ElementRecord, type RenderElement } from '@joint/react';

import { DiagramCanvas } from '../components/diagram-canvas.tsx';
import { ContextMenu, type MenuState } from '../components/context-menu.tsx';
import { FlowNode } from '../components/flow-node.tsx';
import {
  createSampleCells,
  FLOW_NODE_HEIGHT,
  FLOW_NODE_WIDTH,
  type FlowNodeData,
} from '../data/sample-graph.ts';

const initialCells = createSampleCells(false);
const renderElement: RenderElement<FlowNodeData> = (data) => <FlowNode data={data} />;

function ContextMenuStage(): ReactNode {
  const { setCell, setCellData, removeCell, removeCells, graph } = useGraph<ElementRecord<FlowNodeData>>();
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [fitSignal, setFitSignal] = useState(0);
  const counter = useRef(0);
  const renderElementCb = useCallback(renderElement, []);

  const deleteElement = useCallback(
    (id: string | number) => {
      const cell = graph.getCell(id);
      const connected = cell === undefined ? [] : graph.getConnectedLinks(cell).map((link) => link.id);
      removeCells([id, ...connected]);
    },
    [graph, removeCells]
  );

  const addNodeAt = useCallback(
    (x: number, y: number) => {
      counter.current += 1;
      const index = counter.current;
      setCell({
        id: `ctx-${index}`,
        type: 'element',
        position: { x: x - FLOW_NODE_WIDTH / 2, y: y - FLOW_NODE_HEIGHT / 2 },
        size: { width: FLOW_NODE_WIDTH, height: FLOW_NODE_HEIGHT },
        data: { label: `Node ${index}`, kind: 'process' },
      });
    },
    [setCell]
  );

  const closeMenu = useCallback(() => setMenu(null), []);

  return (
    <div className="stage">
      <div className="toolbar">
        <span className="hint">
          Right-click a node, a link, or empty canvas for a context-specific React menu.
        </span>
      </div>
      <div className="stage__canvas">
        <DiagramCanvas<FlowNodeData>
          renderElement={renderElementCb}
          fitSignal={fitSignal}
          paperProps={{
            drawGrid: { name: 'dot', args: { color: 'rgba(140,150,190,0.14)' } },
            gridSize: 16,
            options: {
              defaultRouter: { name: 'orthogonal' },
              defaultConnector: { name: 'rounded', args: { radius: 10 } },
            },
            onElementContextMenu: ({ id, event }) => {
              setMenu({
                x: event.clientX ?? 0,
                y: event.clientY ?? 0,
                title: String(id),
                items: [
                  {
                    label: 'Toggle alert',
                    onSelect: () => setCellData(id, (previous) => ({ ...previous, alert: previous.alert !== true })),
                  },
                  { label: 'Delete node', danger: true, onSelect: () => deleteElement(id) },
                ],
              });
            },
            onLinkContextMenu: ({ id, event }) => {
              setMenu({
                x: event.clientX ?? 0,
                y: event.clientY ?? 0,
                title: 'Link',
                items: [{ label: 'Delete link', danger: true, onSelect: () => removeCell(id) }],
              });
            },
            onBlankContextMenu: ({ event, x, y }) => {
              setMenu({
                x: event.clientX ?? 0,
                y: event.clientY ?? 0,
                title: 'Canvas',
                items: [
                  { label: 'Add node here', onSelect: () => addNodeAt(x, y) },
                  { label: 'Fit to content', onSelect: () => setFitSignal((value) => value + 1) },
                ],
              });
            },
          }}
        />
      </div>
      <ContextMenu state={menu} onClose={closeMenu} />
    </div>
  );
}

/** Demo c — a custom React context menu, per target type, viewport-aware. */
export function ContextMenuDemo(): ReactNode {
  return (
    <GraphProvider initialCells={initialCells}>
      <ContextMenuStage />
    </GraphProvider>
  );
}
