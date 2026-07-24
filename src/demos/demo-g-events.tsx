import { useCallback, useRef, type ReactNode } from 'react';
import { GraphProvider, useOnGraphEvents, type PaperProps, type RenderElement } from '@joint/react';
import type { dia } from '@joint/core';

import { DiagramCanvas } from '../components/diagram-canvas.tsx';
import { EventLog } from '../components/event-log.tsx';
import { FlowNode } from '../components/flow-node.tsx';
import { useEventLog, type LogTone } from '../hooks/use-event-log.tsx';
import { createSampleCells, type FlowNodeData } from '../data/sample-graph.ts';

const initialCells = createSampleCells(false);
const renderElement: RenderElement<FlowNodeData> = (data) => <FlowNode data={data} />;

/** Throttle window (ms) for high-frequency events so the log doesn't flood. */
const THROTTLE_MS = 180;

/** Common subset of the event params we read (id/paper are optional per event). */
interface EvtParams {
  readonly id?: dia.Cell.ID;
  readonly paper?: dia.Paper;
}

/** Briefly highlight the cell that triggered an event. */
function flash(paper: dia.Paper, id: dia.Cell.ID): void {
  const view = paper.findViewByModel(id);
  if (view === undefined) {
    return;
  }
  view.el.classList.add('flash');
  window.setTimeout(() => view.el.classList.remove('flash'), 480);
}

function idOf(params: EvtParams): string | undefined {
  return params.id === undefined ? undefined : String(params.id);
}

function EventsStage(): ReactNode {
  const log = useEventLog(200);
  const renderElementCb = useCallback(renderElement, []);
  const throttleRef = useRef<Record<string, number>>({});

  const throttle = useCallback((key: string, ms: number, run: () => void) => {
    const now = performance.now();
    if (now - (throttleRef.current[key] ?? 0) > ms) {
      throttleRef.current[key] = now;
      run();
    }
  }, []);

  // Discrete event → log a row.
  const on = useCallback(
    (label: string, tone: LogTone = 'info') =>
      (params: EvtParams) =>
        log.push(label, idOf(params), tone),
    [log]
  );

  // Discrete event → log + flash the originating cell.
  const onFlash = useCallback(
    (label: string) => (params: EvtParams) => {
      log.push(label, idOf(params), 'accent');
      if (params.id !== undefined && params.paper !== undefined) {
        flash(params.paper, params.id);
      }
    },
    [log]
  );

  // High-frequency event → throttled log.
  const onThrottled = useCallback(
    (key: string, label: string) => (params: EvtParams) =>
      throttle(key, THROTTLE_MS, () => log.push(label, idOf(params))),
    [log, throttle]
  );

  // Graph-model events (fired by dragging, adding, removing cells).
  useOnGraphEvents({
    add: (cell) => log.push('graph:add', String(cell.id), 'accent'),
    remove: (cell) => log.push('graph:remove', String(cell.id), 'warn'),
    'change:position': (cell) =>
      throttle(`move:${cell.id}`, THROTTLE_MS, () => log.push('graph:change:position', String(cell.id))),
  });

  const paperProps: Partial<PaperProps> = {
    drawGrid: { name: 'dot', args: { color: 'rgba(140,150,190,0.14)' } },
    gridSize: 16,
    options: {
      defaultRouter: { name: 'orthogonal' },
      defaultConnector: { name: 'rounded', args: { radius: 10 } },
    },

    // Elements
    onElementPointerClick: onFlash('element:pointerclick'),
    onElementPointerDblClick: onFlash('element:pointerdblclick'),
    onElementContextMenu: onFlash('element:contextmenu'),
    onElementPointerDown: on('element:pointerdown'),
    onElementPointerUp: on('element:pointerup'),
    onElementPointerMove: onThrottled('el-move', 'element:pointermove'),
    onElementMouseEnter: onThrottled('el-enter', 'element:mouseenter'),
    onElementMouseLeave: onThrottled('el-leave', 'element:mouseleave'),
    onElementMouseWheel: onThrottled('el-wheel', 'element:mousewheel'),

    // Links
    onLinkPointerClick: onFlash('link:pointerclick'),
    onLinkPointerDblClick: onFlash('link:pointerdblclick'),
    onLinkContextMenu: on('link:contextmenu', 'accent'),
    onLinkPointerDown: on('link:pointerdown'),
    onLinkPointerUp: on('link:pointerup'),
    onLinkMouseEnter: onThrottled('lk-enter', 'link:mouseenter'),
    onLinkMouseLeave: onThrottled('lk-leave', 'link:mouseleave'),
    onLinkConnect: on('link:connect', 'accent'),
    onLinkDisconnect: on('link:disconnect', 'warn'),

    // Magnets (ports)
    onElementMagnetPointerClick: on('magnet:pointerclick', 'accent'),
    onElementMagnetContextMenu: on('magnet:contextmenu', 'accent'),

    // Blank canvas
    onBlankPointerClick: on('blank:pointerclick'),
    onBlankPointerDblClick: on('blank:pointerdblclick'),
    onBlankContextMenu: on('blank:contextmenu', 'accent'),
    onBlankMouseEnter: onThrottled('bl-enter', 'blank:mouseenter'),
    onBlankMouseLeave: onThrottled('bl-leave', 'blank:mouseleave'),
    onBlankMouseWheel: onThrottled('bl-wheel', 'blank:mousewheel'),

    // Paper-level (viewport)
    onPaperPan: onThrottled('pan', 'paper:pan'),
    onPaperPinch: onThrottled('pinch', 'paper:pinch'),
    onScale: onThrottled('scale', 'paper:scale'),
    onTranslate: onThrottled('translate', 'paper:translate'),
    onResize: onThrottled('resize', 'paper:resize'),
    onTransform: onThrottled('transform', 'paper:transform'),
  };

  return (
    <div className="stage">
      <div className="toolbar">
        <div className="chips">
          <span className="chip">
            logged <b>{log.entries.length}</b>
          </span>
        </div>
        <span className="hint">
          Click, double-click, right-click, hover, drag, and zoom — every supported event streams on
          the right (high-frequency ones are throttled).
        </span>
      </div>
      <div className="split">
        <div className="split__main">
          <DiagramCanvas<FlowNodeData> renderElement={renderElementCb} paperProps={paperProps} />
        </div>
        <EventLog log={log} />
      </div>
    </div>
  );
}

/** Demo g — a live inspector of every supported diagram event. */
export function EventsDemo(): ReactNode {
  return (
    <GraphProvider initialCells={initialCells}>
      <EventsStage />
    </GraphProvider>
  );
}
