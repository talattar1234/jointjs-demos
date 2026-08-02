import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as go from "gojs";

import { ChurnControls } from "../components/churn-controls.tsx";
import { GoCanvas, GO_FIT_PADDING, GO_ZOOM_BOUNDS } from "./go-canvas.tsx";
import { cellsToGo } from "./adapt.ts";
import { makeScaleNodeTemplate } from "./go-templates.ts";
import { useChurnTicker } from "../hooks/use-churn-ticker.ts";
import {
  buildScaleCells,
  churnCountPerTick,
  churnHue,
  forEachChurnIndex,
  scaleContentSize,
  SCALE_CHURN_DEFAULT_HZ,
  SCALE_LABEL_LOD_SCALE,
} from "../data/scale.ts";

/**
 * GoJS paints to a single canvas, so it never pays the per-node DOM cost the
 * React Flow tab does — but it still allocates a `go.Node` per datum, so it
 * doesn't reach the JointJS SVG demo's 200k either. These bounds sit honestly in
 * between the two.
 */
const GO_SCALE_DEFAULT = 400;
const GO_SCALE_MAX = 100_000;
const GO_SCALE_WARN = 10_000;
/**
 * Only auto-fit after generating when the field is small enough to paint at once
 * — fitting puts every shape in the viewport. Past this the user opts in via the
 * Fit button.
 */
const GO_SCALE_FIT_LIMIT = GO_SCALE_WARN;
/** Hard floor for the content-aware `minScale` below. */
const GO_ABSOLUTE_MIN_SCALE = 0.02;
/** Throttle for recounting what's inside the viewport while panning. */
const COUNT_THROTTLE_MS = 250;

function clampCount(raw: string): number {
  const parsed = Math.floor(Number(raw));
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return Math.min(GO_SCALE_MAX, parsed);
}

/** Build a model for `count` shapes, with the shared label toggle in `modelData`. */
function buildModel(count: number, showLabels: boolean): go.GraphLinksModel {
  const { nodeDataArray } = cellsToGo(buildScaleCells(count));
  return new go.GraphLinksModel(nodeDataArray, [], {
    linkKeyProperty: "key",
    modelData: { showLabels },
  });
}

/**
 * Lower `diagram.minScale` for a field of `count` shapes that cannot fit at the
 * default floor, so zooming all the way out (and `zoomToFit`, which clamps to
 * `minScale` too) can actually reach the whole graph.
 *
 * Sized from {@link scaleContentSize} rather than `documentBounds`, which GoJS
 * only recomputes on its next layout pass — this runs right after the model swap.
 */
function applyMinScale(diagram: go.Diagram, count: number): void {
  const host = diagram.div;
  const content = scaleContentSize(count);
  if (host === null || content.width <= 0 || content.height <= 0) {
    return;
  }
  const fitScale = Math.min(
    (host.clientWidth - GO_FIT_PADDING * 2) / content.width,
    (host.clientHeight - GO_FIT_PADDING * 2) / content.height,
  );
  const next =
    Number.isFinite(fitScale) && fitScale < GO_ZOOM_BOUNDS.min
      ? Math.max(GO_ABSOLUTE_MIN_SCALE, fitScale)
      : GO_ZOOM_BOUNDS.min;
  // Assigning `minScale` invalidates the viewport until the next draw, so skip
  // the write when nothing changes — otherwise every mount pays for it.
  if (diagram.minScale !== next) {
    diagram.minScale = next;
  }
}

function initDiagram(diagram: go.Diagram): void {
  diagram.nodeTemplate = makeScaleNodeTemplate();
  // Nothing here is interactive, so drop every tool that would hit-test.
  diagram.isReadOnly = true;
  diagram.allowSelect = false;
  // GoJS scrolls on wheel by default; zoom instead, like the other two tabs.
  diagram.toolManager.mouseWheelBehavior = go.WheelMode.Zoom;
  diagram.animationManager.isEnabled = false;
  diagram.model = buildModel(GO_SCALE_DEFAULT, true);
}

interface Stats {
  readonly count: number;
  readonly buildMs: number;
}

/** How many nodes currently overlap the viewport — GoJS's painted subset. */
function countInViewport(diagram: go.Diagram): number {
  const viewport = diagram.viewportBounds;
  // Between a model swap (or a `minScale` write) and the next draw GoJS leaves
  // the viewport non-real; intersecting against it throws. The following
  // `ViewportBoundsChanged` re-runs this with a real rect.
  if (!viewport.isReal()) {
    return 0;
  }
  let visible = 0;
  const nodes = diagram.nodes;
  while (nodes.next()) {
    if (nodes.value.actualBounds.intersectsRect(viewport)) {
      visible += 1;
    }
  }
  return visible;
}

/**
 * Demo k (GoJS) — generate many shapes and watch what the canvas actually paints.
 *
 * There is no culling switch to flip: GoJS only draws what intersects the
 * viewport, always. The "in viewport" chip measures that directly rather than
 * counting mounted elements, because on a canvas there are none to count.
 */
export function GoScaleDemo(): ReactNode {
  const [diagram, setDiagram] = useState<go.Diagram | null>(null);
  const [input, setInput] = useState(String(GO_SCALE_DEFAULT));
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [visible, setVisible] = useState(0);
  const [areLabelsVisible, setAreLabelsVisible] = useState(true);
  const [isLabelLodActive, setIsLabelLodActive] = useState(false);
  const [isChurnRunning, setIsChurnRunning] = useState(false);
  const [churnHz, setChurnHz] = useState(SCALE_CHURN_DEFAULT_HZ);
  const lastCountRef = useRef(0);

  // Read inside the diagram listener below, which is subscribed once.
  const areLabelsVisibleRef = useRef(areLabelsVisible);
  areLabelsVisibleRef.current = areLabelsVisible;

  const init = useCallback(initDiagram, []);

  /**
   * Push the effective label visibility — the button's choice, minus the
   * level-of-detail cutoff — into `modelData`. One shared-model write fans out
   * to every label, and the no-op guard keeps it off the per-frame path.
   */
  const syncLabels = useCallback((target: go.Diagram) => {
    const isLod = target.scale < SCALE_LABEL_LOD_SCALE;
    setIsLabelLodActive(isLod);
    const next = areLabelsVisibleRef.current && !isLod;
    const { modelData } = target.model;
    if (modelData.showLabels !== next) {
      target.model.commit(
        (model) => model.set(modelData, "showLabels", next),
        null,
      );
    }
  }, []);

  const generate = useCallback(() => {
    if (diagram === null) {
      return;
    }
    const count = clampCount(input);
    setInput(String(count));
    setBusy(true);
    // Defer the heavy build so the "Generating…" state can paint first.
    window.setTimeout(() => {
      const start = performance.now();
      diagram.model = buildModel(count, areLabelsVisible);
      const buildMs = performance.now() - start;
      setStats({ count, buildMs });
      setBusy(false);
      applyMinScale(diagram, count);
      if (count <= GO_SCALE_FIT_LIMIT) {
        diagram.zoomToFit();
      }
      syncLabels(diagram);
      setVisible(countInViewport(diagram));
    }, 20);
  }, [diagram, input, areLabelsVisible, syncLabels]);

  // Seed the first measurement and keep it fresh as the viewport moves.
  useEffect(() => {
    if (diagram === null) {
      return;
    }
    const onViewport = (): void => {
      // Cheap and needs to track every zoom step, so it runs unthrottled.
      syncLabels(diagram);
      const now = performance.now();
      if (now - lastCountRef.current > COUNT_THROTTLE_MS) {
        lastCountRef.current = now;
        setVisible(countInViewport(diagram));
      }
    };
    const initialCount = diagram.model.nodeDataArray.length;
    setStats({ count: initialCount, buildMs: 0 });
    applyMinScale(diagram, initialCount);
    setVisible(countInViewport(diagram));
    diagram.addDiagramListener("ViewportBoundsChanged", onViewport);
    return () => {
      diagram.removeDiagramListener("ViewportBoundsChanged", onViewport);
    };
  }, [diagram, syncLabels]);

  const toggleLabels = useCallback(() => {
    if (diagram === null) {
      return;
    }
    const next = !areLabelsVisible;
    setAreLabelsVisible(next);
    areLabelsVisibleRef.current = next;
    syncLabels(diagram);
  }, [diagram, areLabelsVisible, syncLabels]);

  // One `commit` per tick, named `null` so this high-frequency load never enters
  // the undo stack. Writing through `Model.set` is what notifies the `fill`
  // binding; assigning `data.hue` directly would change nothing on screen.
  const applyChurn = useCallback(
    (tick: number) => {
      if (diagram === null) {
        return;
      }
      const nodeData = diagram.model.nodeDataArray;
      diagram.model.commit((model) => {
        forEachChurnIndex(nodeData.length, tick, (index) => {
          model.set(nodeData[index], "hue", churnHue(index, tick));
        });
      }, null);
    },
    [diagram],
  );

  const { lastMs: churnMs } = useChurnTicker({
    isRunning: isChurnRunning,
    hz: churnHz,
    apply: applyChurn,
  });

  const count = stats?.count ?? 0;
  const showWarning = count > GO_SCALE_WARN;

  return (
    <div className="stage">
      <div className="toolbar">
        <label className="field">
          <span className="field__label">Shapes</span>
          <input
            className="field__input"
            type="number"
            min={1}
            max={GO_SCALE_MAX}
            step={100}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                generate();
              }
            }}
          />
        </label>
        <button
          type="button"
          className="btn btn--primary"
          onClick={generate}
          disabled={busy}
        >
          {busy ? "Generating…" : "Generate"}
        </button>

        <button
          type="button"
          className={`btn ${areLabelsVisible ? "btn--primary" : ""}`}
          aria-pressed={areLabelsVisible}
          onClick={toggleLabels}
          title={`Show or hide the per-shape index label (one shared-model write). Dropped automatically below ${SCALE_LABEL_LOD_SCALE * 100}% zoom.`}
        >
          Labels:{" "}
          {areLabelsVisible ? (isLabelLodActive ? "auto-off" : "on") : "off"}
        </button>

        <ChurnControls
          isRunning={isChurnRunning}
          onToggleRunning={() => setIsChurnRunning((running) => !running)}
          hz={churnHz}
          onHzChange={setChurnHz}
          perTick={churnCountPerTick(count)}
          lastMs={churnMs}
        />

        <div className="chips">
          <span className="chip">
            total <b>{count.toLocaleString()}</b>
          </span>
          <span className="chip">
            in viewport <b>{visible.toLocaleString()}</b>
          </span>
          {stats !== null && stats.buildMs > 0 && (
            <span className="chip">
              built in <b>{stats.buildMs.toFixed(0)} ms</b>
            </span>
          )}
        </div>

        <span className="hint">
          GoJS always paints only the viewport — there is no culling switch to
          turn off.
        </span>

        {showWarning && (
          <span className="warn-pill" role="status">
            GoJS still allocates one Part per shape, so build time climbs well
            before the canvas does — above the React Flow DOM ceiling, below the
            JointJS SVG demo's 200k.
          </span>
        )}
      </div>

      <div className="stage__canvas">
        <GoCanvas init={init} onReady={setDiagram} />
      </div>
    </div>
  );
}
