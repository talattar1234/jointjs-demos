import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import * as go from 'gojs';

import { GoCanvas } from './go-canvas.tsx';
import { createGoModel } from './adapt.ts';
import { makeFlowNodeTemplate, makeLinkTemplate } from './go-templates.ts';
import { themeColor } from './go-theme.ts';
import { EventLog } from '../components/event-log.tsx';
import { useEventLog, type LogTone } from '../hooks/use-event-log.tsx';
import { createSampleCells } from '../data/sample-graph.ts';

/** Throttle window (ms) for high-frequency events so the log doesn't flood. */
const THROTTLE_MS = 180;
/** How long the on-canvas flash lasts. */
const FLASH_MS = 480;

/** Push a hover event through a callback stored on the diagram's templates. */
type HoverHandler = (kind: 'enter' | 'leave', part: go.Part) => void;

function initDiagram(diagram: go.Diagram, onHover: HoverHandler): void {
  const nodeTemplate = makeFlowNodeTemplate();
  // GoJS hover is a property on the template, not a diagram-level event.
  nodeTemplate.mouseEnter = (_event, object) => onHover('enter', object.part as go.Part);
  nodeTemplate.mouseLeave = (_event, object) => onHover('leave', object.part as go.Part);

  const linkTemplate = makeLinkTemplate();
  linkTemplate.mouseEnter = (_event, object) => onHover('enter', object.part as go.Part);
  linkTemplate.mouseLeave = (_event, object) => onHover('leave', object.part as go.Part);

  diagram.nodeTemplate = nodeTemplate;
  diagram.linkTemplate = linkTemplate;
  diagram.model = createGoModel(createSampleCells(false));
}

/** The datum key of a part, as a string. */
function keyOf(part: go.Part): string {
  const key: unknown = part.data?.key;
  return typeof key === 'string' || typeof key === 'number' ? String(key) : '?';
}

/**
 * Briefly tint the part that fired an event. The DOM tabs add a `flash` CSS
 * class; on a canvas we recolor the shape and let GoJS re-apply the binding
 * afterwards to restore whatever the theme says it should be.
 */
function flashPart(diagram: go.Diagram, part: go.Part): void {
  const target = part.findObject(part instanceof go.Link ? 'PATH' : 'BODY');
  if (!(target instanceof go.Shape)) {
    return;
  }
  target.stroke = themeColor(diagram, 'accent', '#6d7cff');
  target.strokeWidth = 3;
  window.setTimeout(() => {
    // Re-running the bindings restores the themed stroke and width exactly.
    part.updateTargetBindings();
  }, FLASH_MS);
}

/**
 * Demo g (GoJS) — a live inspector of the diagram event surface.
 *
 * GoJS splits its events two ways: diagram-wide `DiagramEvent`s subscribed with
 * `addDiagramListener`, and per-object handlers (`mouseEnter`, `mouseLeave`)
 * that live on the templates. That's a real difference from the other two tabs,
 * where every event is just a prop on the canvas component.
 */
export function GoEventsDemo(): ReactNode {
  const log = useEventLog(200);
  const [diagram, setDiagram] = useState<go.Diagram | null>(null);
  const throttleRef = useRef<Record<string, number>>({});
  const pushRef = useRef(log.push);
  pushRef.current = log.push;

  const throttle = useCallback((key: string, ms: number, run: () => void) => {
    const now = performance.now();
    if (now - (throttleRef.current[key] ?? 0) > ms) {
      throttleRef.current[key] = now;
      run();
    }
  }, []);

  const init = useCallback(
    (created: go.Diagram) => {
      initDiagram(created, (kind, part) => {
        const label = part instanceof go.Link ? 'link' : 'node';
        throttle(`${label}-${kind}`, THROTTLE_MS, () =>
          pushRef.current(`${label}:mouse${kind}`, keyOf(part))
        );
      });
    },
    [throttle]
  );

  useEffect(() => {
    if (diagram === null) {
      return;
    }
    const push = (label: string, detail?: string, tone: LogTone = 'info'): void =>
      pushRef.current(label, detail, tone);

    /** Resolve the `Part` behind an object-flavored DiagramEvent. */
    const partOf = (event: go.DiagramEvent): go.Part | null => {
      const part: unknown = event.subject?.part ?? event.subject;
      return part instanceof go.Part ? part : null;
    };
    const nameOf = (part: go.Part): string => (part instanceof go.Link ? 'link' : 'node');

    const onSingleClick = (event: go.DiagramEvent): void => {
      const part = partOf(event);
      if (part === null) {
        return;
      }
      push(`${nameOf(part)}:click`, keyOf(part), 'accent');
      flashPart(diagram, part);
    };
    const onDoubleClick = (event: go.DiagramEvent): void => {
      const part = partOf(event);
      if (part !== null) {
        push(`${nameOf(part)}:dblclick`, keyOf(part), 'accent');
      }
    };
    const onContextClick = (event: go.DiagramEvent): void => {
      const part = partOf(event);
      if (part !== null) {
        push(`${nameOf(part)}:contextmenu`, keyOf(part), 'accent');
      }
    };
    const onBackgroundClick = (): void => push('background:click');
    const onBackgroundContext = (): void => push('background:contextmenu', undefined, 'accent');
    const onSelection = (): void =>
      throttle('sel', THROTTLE_MS, () => push('selection:change', `${diagram.selection.count} selected`));
    const onMoved = (): void => push('selection:moved', `${diagram.selection.count} part(s)`);
    const onViewport = (): void => throttle('viewport', THROTTLE_MS, () => push('viewport:change'));
    // Registered for parity with the sibling tabs; nodes are not linkable here,
    // so this only fires if linking is turned on.
    const onLinkDrawn = (event: go.DiagramEvent): void => {
      const part = partOf(event);
      if (part instanceof go.Link) {
        push('link:drawn', `${String(part.fromNode?.key)}→${String(part.toNode?.key)}`, 'accent');
      }
    };

    diagram.addDiagramListener('ObjectSingleClicked', onSingleClick);
    diagram.addDiagramListener('ObjectDoubleClicked', onDoubleClick);
    diagram.addDiagramListener('ObjectContextClicked', onContextClick);
    diagram.addDiagramListener('BackgroundSingleClicked', onBackgroundClick);
    diagram.addDiagramListener('BackgroundContextClicked', onBackgroundContext);
    diagram.addDiagramListener('ChangedSelection', onSelection);
    diagram.addDiagramListener('SelectionMoved', onMoved);
    diagram.addDiagramListener('ViewportBoundsChanged', onViewport);
    diagram.addDiagramListener('LinkDrawn', onLinkDrawn);

    return () => {
      diagram.removeDiagramListener('ObjectSingleClicked', onSingleClick);
      diagram.removeDiagramListener('ObjectDoubleClicked', onDoubleClick);
      diagram.removeDiagramListener('ObjectContextClicked', onContextClick);
      diagram.removeDiagramListener('BackgroundSingleClicked', onBackgroundClick);
      diagram.removeDiagramListener('BackgroundContextClicked', onBackgroundContext);
      diagram.removeDiagramListener('ChangedSelection', onSelection);
      diagram.removeDiagramListener('SelectionMoved', onMoved);
      diagram.removeDiagramListener('ViewportBoundsChanged', onViewport);
      diagram.removeDiagramListener('LinkDrawn', onLinkDrawn);
    };
  }, [diagram, throttle]);

  return (
    <div className="stage">
      <div className="toolbar">
        <div className="chips">
          <span className="chip">
            logged <b>{log.entries.length}</b>
          </span>
        </div>
        <span className="hint">
          Click, double-click, right-click, hover, drag, and zoom — every event streams on the right
          (high-frequency ones are throttled).
        </span>
      </div>
      <div className="split">
        <div className="split__main">
          <GoCanvas init={init} onReady={setDiagram} />
        </div>
        <EventLog log={log} />
      </div>
    </div>
  );
}
