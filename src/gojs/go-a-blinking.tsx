import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import * as go from 'gojs';

import { GoCanvas } from './go-canvas.tsx';
import { createGoModel } from './adapt.ts';
import { makeFlowNodeTemplate, makeLinkTemplate } from './go-templates.ts';
import { themeColor } from './go-theme.ts';
import { useTheme } from '../app/theme.tsx';
import { createSampleCells } from '../data/sample-graph.ts';

/** The node that carries the alert in this demo. */
const ALERT_NODE_KEY = 'reject';
/** Half-period of the pulse, in milliseconds. */
const PULSE_MS = 550;
/** Stroke width used while the node is alerting. */
const ALERT_STROKE_WIDTH = 2.5;

function initDiagram(diagram: go.Diagram): void {
  diagram.nodeTemplate = makeFlowNodeTemplate();
  diagram.linkTemplate = makeLinkTemplate();
  diagram.model = createGoModel(createSampleCells(true));
}

/** Whether the OS asks us to avoid animation. */
function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Demo a (GoJS) — one shape pulses red to grab attention.
 *
 * The other two tabs get this from a CSS `@keyframes` rule. GoJS paints to a
 * canvas, where CSS animation has nothing to attach to, so the pulse is a
 * `go.Animation` driving the body Shape's stroke instead — and the
 * reduced-motion fallback has to be checked in code rather than in a media query.
 */
export function GoBlinkingDemo(): ReactNode {
  const [diagram, setDiagram] = useState<go.Diagram | null>(null);
  const [isAlerting, setIsAlerting] = useState(true);
  const animationRef = useRef<go.Animation | null>(null);
  const { theme } = useTheme();

  const init = useCallback(initDiagram, []);

  useEffect(() => {
    if (diagram === null) {
      return;
    }
    const node = diagram.findNodeForKey(ALERT_NODE_KEY);
    const body = node?.findObject('BODY');
    if (!(body instanceof go.Shape)) {
      return;
    }

    // Re-read on every theme flip: the palettes are per-theme (see go-theme.ts).
    const calm = themeColor(diagram, 'nodeStroke', 'rgba(255, 255, 255, 0.10)');
    const alarmed = themeColor(diagram, 'statuses.crit', '#f87171');

    if (!isAlerting) {
      body.stroke = calm;
      body.strokeWidth = 1;
      return;
    }

    // Set the alerting look up front, so the node still reads as critical even
    // when the animation is skipped for reduced motion.
    body.stroke = alarmed;
    body.strokeWidth = ALERT_STROKE_WIDTH;
    if (prefersReducedMotion()) {
      return;
    }

    const animation = new go.Animation({
      duration: PULSE_MS,
      reversible: true,
      runCount: Infinity,
    });
    animation.add(body, 'stroke', calm, alarmed, true);
    animation.start();
    animationRef.current = animation;

    return () => {
      animation.stop();
      animationRef.current = null;
    };
  }, [diagram, isAlerting, theme]);

  return (
    <div className="stage">
      <div className="toolbar">
        <button
          type="button"
          className={`btn ${isAlerting ? '' : 'btn--primary'}`}
          onClick={() => setIsAlerting((current) => !current)}
        >
          {isAlerting ? 'Silence alert' : 'Trigger alert'}
        </button>
        <span className="hint">
          The “Reject &amp; alert” node pulses red via a <code>go.Animation</code> on the shape's stroke.
          It falls back to a static red outline when the OS prefers reduced motion.
        </span>
      </div>
      <div className="stage__canvas">
        <GoCanvas init={init} onReady={setDiagram} />
      </div>
    </div>
  );
}
