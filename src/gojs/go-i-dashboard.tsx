import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import * as go from 'gojs';

import { GoCanvas } from './go-canvas.tsx';
import { createGoModel, type GoModel, type GoNodeData } from './adapt.ts';
import { makeLinkTemplate } from './go-templates.ts';
import {
  createDashboardCells,
  tickService,
  type ServiceData,
  type ServiceStatus,
} from '../data/dashboard.ts';

/** How often the simulated telemetry advances, in milliseconds. */
const TICK_MS = 1400;
/** Inner padding of the card. */
const CARD_PADDING = 12;
/** Sparkline box, matching `.svc__spark`. */
const SPARK_WIDTH = 192;
const SPARK_HEIGHT = 30;
/** One full dash cycle of the flow links (`strokeDashArray: [6, 8]`). */
const DASH_CYCLE = 14;
/** Period of the flow animation — the CSS tabs use `flow-dash 0.7s linear`. */
const FLOW_MS = 700;

const STATUS_LABEL: Record<ServiceStatus, string> = {
  ok: 'Healthy',
  warn: 'Elevated',
  crit: 'Critical',
};

type CardData = GoNodeData & ServiceData;

/**
 * Build the sparkline path. The DOM tabs hand this to an SVG `<polyline>`; here
 * the same points become a `go.Geometry` the canvas can stroke.
 */
function sparkGeometry(history: readonly number[], ceiling: number, closed: boolean): go.Geometry {
  if (history.length < 2) {
    return go.Geometry.parse(`M0 ${SPARK_HEIGHT}`, false);
  }
  const stepX = SPARK_WIDTH / (history.length - 1);
  const points = history.map((value, index) => {
    const x = index * stepX;
    const clamped = Math.max(0, Math.min(ceiling, value));
    const y = SPARK_HEIGHT - (clamped / ceiling) * SPARK_HEIGHT;
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  const line = points.map((point, index) => (index === 0 ? `M${point}` : `L${point}`)).join(' ');
  if (!closed) {
    return go.Geometry.parse(line, false);
  }
  return go.Geometry.parse(`${line} L${SPARK_WIDTH} ${SPARK_HEIGHT} L0 ${SPARK_HEIGHT} z`, true);
}

/** The rich service card — the GoJS rebuild of the `.rf-svc` / `.jj-box` HTML card. */
function makeCardTemplate(): go.Node {
  const node = new go.Node('Spot', {
    locationSpot: go.Spot.TopLeft,
    portId: '',
    fromSpot: go.Spot.AllSides,
    toSpot: go.Spot.AllSides,
    selectable: false,
  }).bindTwoWay('location', 'loc', go.Point.parse, go.Point.stringify);

  const head = new go.Panel('Horizontal', { alignment: go.Spot.Left }).add(
    new go.TextBlock({ font: '17px sans-serif', width: 22 }).bind('text', 'icon'),
    new go.Panel('Vertical', { defaultAlignment: go.Spot.Left, width: 148 }).add(
      new go.TextBlock({ overflow: go.TextOverflow.Ellipsis, maxLines: 1, width: 148 })
        .bind('text', 'label')
        .theme('stroke', 'text')
        .theme('font', 'title'),
      new go.TextBlock()
        .bind('text', 'role', (role: string) => role.toUpperCase())
        .theme('stroke', 'textFaint')
        .theme('font', 'role')
    ),
    new go.Shape('Circle', { width: 10, height: 10, strokeWidth: 0 })
      .themeData('fill', 'status', 'statuses')
      .bind('toolTip', 'status', (status: ServiceStatus) =>
        new go.Adornment('Auto').add(
          new go.Shape('RoundedRectangle', { parameter1: 6 }).theme('fill', 'panel').theme('stroke', 'nodeStroke'),
          new go.TextBlock({ margin: new go.Margin(3, 7) })
            .set({ text: STATUS_LABEL[status] })
            .theme('stroke', 'text')
            .theme('font', 'edge')
        )
      )
  );

  const metric = new go.Panel('Horizontal', { alignment: go.Spot.Left }).add(
    new go.TextBlock()
      .bind('text', 'value', (value: number) => value.toLocaleString())
      .theme('stroke', 'text')
      .theme('font', 'metric'),
    new go.TextBlock({ margin: new go.Margin(0, 0, 0, 5) })
      .bind('text', 'unit')
      .theme('stroke', 'textDim')
      .theme('font', 'unit')
  );

  const spark = new go.Panel('Spot', { width: SPARK_WIDTH, height: SPARK_HEIGHT }).add(
    new go.Shape({
      geometryStretch: go.GeometryStretch.None,
      strokeWidth: 0,
      opacity: 0.18,
      alignment: go.Spot.TopLeft,
      alignmentFocus: go.Spot.TopLeft,
    })
      .bind('geometry', '', (data: CardData) => sparkGeometry(data.history, data.ceiling, true))
      .themeData('fill', 'status', 'statuses'),
    new go.Shape({
      geometryStretch: go.GeometryStretch.None,
      fill: null,
      strokeWidth: 2,
      strokeJoin: 'round',
      strokeCap: 'round',
      alignment: go.Spot.TopLeft,
      alignmentFocus: go.Spot.TopLeft,
    })
      .bind('geometry', '', (data: CardData) => sparkGeometry(data.history, data.ceiling, false))
      .themeData('stroke', 'status', 'statuses')
  );

  return node.add(
    new go.Shape('RoundedRectangle', { name: 'BODY', parameter1: 14, strokeWidth: 1 })
      .bind('desiredSize', '', (data: CardData) => new go.Size(data.width, data.height))
      .theme('fill', 'nodeFill')
      .themeData('stroke', 'status', 'statuses'),

    // The status-colored rail down the left edge (`.jj-box::before`).
    new go.Shape('RoundedRectangle', {
      parameter1: 2,
      strokeWidth: 0,
      width: 3,
      alignment: new go.Spot(0, 0.5, 4, 0),
      alignmentFocus: go.Spot.Left,
    })
      .bind('height', '', (data: CardData) => data.height - 18)
      .themeData('fill', 'status', 'statuses'),

    new go.Panel('Vertical', {
      alignment: new go.Spot(0, 0, CARD_PADDING, CARD_PADDING),
      alignmentFocus: go.Spot.TopLeft,
      defaultAlignment: go.Spot.Left,
    }).add(
      head,
      new go.Panel('Vertical', { margin: new go.Margin(4, 0, 0, 0), defaultAlignment: go.Spot.Left }).add(
        metric,
        spark
      )
    )
  );
}

/**
 * Demo i (GoJS) — a live telemetry dashboard of service cards linked by animated
 * flows.
 *
 * This is where the canvas substrate costs the most: the other two tabs render
 * the card as HTML (an emoji, a couple of `<span>`s, an inline SVG sparkline)
 * and let CSS do the layout. Here the same card is assembled from GoJS panels,
 * and the sparkline is a `go.Geometry` recomputed on every tick.
 */
export function GoDashboardDemo(): ReactNode {
  const [diagram, setDiagram] = useState<go.Diagram | null>(null);
  const modelRef = useRef<GoModel<ServiceData> | null>(null);

  const init = useCallback((created: go.Diagram) => {
    created.nodeTemplate = makeCardTemplate();
    created.linkTemplate = makeLinkTemplate({ dashed: true, curved: true, labelled: false });
    const model = createGoModel(createDashboardCells());
    modelRef.current = model;
    created.model = model;
  }, []);

  // Walk each card's metric forward. `commit(fn, null)` runs the change without
  // recording an undo edit — this fires twice a second and should not be undoable.
  useEffect(() => {
    const model = modelRef.current;
    if (diagram === null || model === null) {
      return;
    }
    const timer = window.setInterval(() => {
      model.commit((current) => {
        for (const data of current.nodeDataArray) {
          const next = tickService(data);
          current.set(data, 'value', next.value);
          current.set(data, 'history', next.history);
          current.set(data, 'status', next.status);
        }
      }, null);
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [diagram]);

  // The marching-ants flow along the links, the canvas answer to the CSS
  // `flow-dash` keyframes the other tabs use.
  useEffect(() => {
    if (diagram === null || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const animation = new go.Animation({ duration: FLOW_MS, runCount: Infinity });
    const links = diagram.links;
    while (links.next()) {
      const path = links.value.findObject('PATH');
      if (path instanceof go.Shape) {
        animation.add(path, 'strokeDashOffset', 0, -DASH_CYCLE, true);
      }
    }
    animation.start();
    return () => {
      animation.stop();
    };
  }, [diagram]);

  return (
    <div className="stage">
      <div className="stage__canvas">
        <GoCanvas init={init} onReady={setDiagram}>
          <div className="legend">
            <span className="legend__live">
              <span className="legend__pulse" /> live · updates every {(TICK_MS / 1000).toFixed(1)}s
            </span>
            <span className="legend__item legend__item--ok">Healthy</span>
            <span className="legend__item legend__item--warn">Elevated</span>
            <span className="legend__item legend__item--crit">Critical</span>
          </div>
        </GoCanvas>
      </div>
    </div>
  );
}
