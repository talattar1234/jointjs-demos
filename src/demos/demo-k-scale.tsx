import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  GraphProvider,
  useGraph,
  useOnPaperEvents,
  usePaper,
  type CellVisibility,
  type ElementPosition,
  type ElementRecord,
  type ElementSize,
  type RenderElement,
} from "@joint/react";
import type { dia } from "@joint/core";

import { ChurnControls } from "../components/churn-controls.tsx";
import { DiagramCanvas } from "../components/diagram-canvas.tsx";
import { useChurnTicker } from "../hooks/use-churn-ticker.ts";
import { useZoomPanControls, ZOOM_BOUNDS } from "../hooks/use-zoom-pan.ts";
import {
  buildScaleCells,
  churnCountPerTick,
  churnHue,
  clampScaleCount,
  forEachChurnIndex,
  NODE_HEIGHT,
  NODE_WIDTH,
  SCALE_CHURN_DEFAULT_HZ,
  SCALE_DEFAULT,
  SCALE_FIT_LIMIT,
  SCALE_LABEL_LOD_SCALE,
  SCALE_MAX,
  SCALE_WARN,
  type ScaleNodeData,
} from "../data/scale.ts";

/** Extra margin (px, local) around the viewport so nodes render just before entering. */
const CULL_MARGIN = 240;

/** Inflated viewport bounds (local coords) reused across a whole culling pass. */
interface CullBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/** A single generated node — plain SVG for maximum rendering throughput. */
function ScaleNode({ data }: Readonly<{ data: ScaleNodeData }>): ReactNode {
  const fill = `hsl(${data.hue} 70% 58%)`;
  return (
    <g>
      <rect
        width={NODE_WIDTH}
        height={NODE_HEIGHT}
        rx={7}
        fill={fill}
        stroke="rgba(255,255,255,0.28)"
        strokeWidth={1}
      />
      <text
        className="scale-node-label"
        x={NODE_WIDTH / 2}
        y={NODE_HEIGHT / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={10}
        fontWeight={600}
        fill="#0b0f1a"
      >
        {data.label}
      </text>
    </g>
  );
}

const renderElement: RenderElement<ScaleNodeData> = (data) => (
  <ScaleNode data={data} />
);

/**
 * Reports the canvas's live zoom back up to the stage. Must be mounted as a
 * child of {@link DiagramCanvas} — that is where the zoom context is provided.
 */
function ScaleWatcher({
  onScaleChange,
}: Readonly<{ onScaleChange: (scale: number) => void }>): ReactNode {
  const { scale } = useZoomPanControls();
  useEffect(() => {
    onScaleChange(scale);
  }, [scale, onScaleChange]);
  return null;
}

/** Reports how many cell views are actually mounted in the DOM after each render pass. */
function RenderStats({
  onRendered,
}: Readonly<{ onRendered: (count: number) => void }>): ReactNode {
  const { paper } = usePaper();
  useOnPaperEvents({
    "render:done": () => {
      if (paper !== null) {
        onRendered(paper.el.querySelectorAll(".joint-cell").length);
      }
    },
  });
  return null;
}

interface Stats {
  readonly count: number;
  readonly buildMs: number;
}

/** Controls + canvas for the scale test. Lives inside the GraphProvider. */
function ScaleStage(): ReactNode {
  const { resetCells, setCellData, transaction } =
    useGraph<ElementRecord<ScaleNodeData>>();
  const [input, setInput] = useState(String(SCALE_DEFAULT));
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [rendered, setRendered] = useState(0);
  const [fitSignal, setFitSignal] = useState(0);
  // On by default: without it every cell mounts a view + React portal regardless
  // of the viewport, so the cost scales with the total count instead of the screen.
  const [isCullingEnabled, setIsCullingEnabled] = useState(true);
  const [areLabelsVisible, setAreLabelsVisible] = useState(true);
  const [viewScale, setViewScale] = useState(1);
  const [isChurnRunning, setIsChurnRunning] = useState(false);
  const [churnHz, setChurnHz] = useState(SCALE_CHURN_DEFAULT_HZ);
  const didInit = useRef(false);

  // Viewport-culling cache. The inflated viewport is identical for every cell in
  // a pass, so we compute it once (when the viewport moved) instead of per cell.
  const boundsRef = useRef<CullBounds | null>(null);
  const isBoundsDirty = useRef(true);

  const markBoundsDirty = useCallback(() => {
    isBoundsDirty.current = true;
  }, []);

  const refreshBounds = useCallback((paper: dia.Paper) => {
    const area = paper.getArea();
    boundsRef.current = {
      minX: area.x - CULL_MARGIN,
      minY: area.y - CULL_MARGIN,
      maxX: area.x + area.width + CULL_MARGIN,
      maxY: area.y + area.height + CULL_MARGIN,
    };
    isBoundsDirty.current = false;
  }, []);

  // Only render cells whose box overlaps the (inflated) viewport. The overlap is a
  // handful of number comparisons against cached bounds — no per-cell getArea()
  // or Rect allocation — so this stays cheap even when scanning 200k cells.
  const cellVisibility = useCallback<CellVisibility>(
    ({ model, paper }) => {
      if (isBoundsDirty.current || boundsRef.current === null) {
        refreshBounds(paper);
      }
      const bounds = boundsRef.current;
      if (bounds === null || !model.isElement()) {
        return true;
      }
      const { x, y } = model.get("position") as ElementPosition;
      const { width, height } = model.get("size") as ElementSize;
      return (
        x < bounds.maxX &&
        x + width > bounds.minX &&
        y < bounds.maxY &&
        y + height > bounds.minY
      );
    },
    [refreshBounds],
  );

  const generate = useCallback(() => {
    const count = clampScaleCount(input);
    setInput(String(count));
    setBusy(true);
    // Defer the heavy synchronous build so the "Generating…" state can paint.
    window.setTimeout(() => {
      const start = performance.now();
      resetCells(buildScaleCells(count));
      const buildMs = performance.now() - start;
      setStats({ count, buildMs });
      setBusy(false);
      if (count <= SCALE_FIT_LIMIT) {
        setFitSignal((value) => value + 1);
      }
    }, 20);
  }, [input, resetCells]);

  // Seed an initial graph once on mount.
  useEffect(() => {
    if (didInit.current) {
      return;
    }
    didInit.current = true;
    generate();
  }, [generate]);

  const count = stats?.count ?? 0;
  const showWarning = count > SCALE_WARN;
  // Level of detail: once the whole field is on screen the labels are sub-pixel
  // noise, and painting 10k text nodes is what makes that zoom level crawl.
  const isLabelLodActive = viewScale < SCALE_LABEL_LOD_SCALE;
  const areLabelsDrawn = areLabelsVisible && !isLabelLodActive;

  // One transaction per tick: every `setCellData` inside it collapses into a
  // single React update, and `deferPaint` holds the paper back so the whole
  // batch repaints once. Without both, a tick would cost one render pass per
  // changed cell.
  const applyChurn = useCallback(
    (tick: number) => {
      transaction(
        () => {
          forEachChurnIndex(count, tick, (index) => {
            setCellData(`n${index}`, (previous) => ({
              ...previous,
              hue: churnHue(index, tick),
            }));
          });
        },
        { deferPaint: true, name: "churn" },
      );
    },
    [count, setCellData, transaction],
  );

  const { lastMs: churnMs } = useChurnTicker({
    isRunning: isChurnRunning,
    hz: churnHz,
    apply: applyChurn,
  });

  return (
    <div className="stage">
      <div className="toolbar">
        <label className="field">
          <span className="field__label">Shapes</span>
          <input
            className="field__input"
            type="number"
            min={1}
            max={SCALE_MAX}
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
          className={`btn ${isCullingEnabled ? "btn--primary" : ""}`}
          aria-pressed={isCullingEnabled}
          onClick={() => setIsCullingEnabled((enabled) => !enabled)}
          title="Render only shapes inside the viewport. Off = mount everything (slower)."
        >
          Culling: {isCullingEnabled ? "on" : "off"}
        </button>

        <button
          type="button"
          className={`btn ${areLabelsVisible ? "btn--primary" : ""}`}
          aria-pressed={areLabelsVisible}
          onClick={() => setAreLabelsVisible((visible) => !visible)}
          title={`Show or hide the per-shape index label (CSS-only, no re-render). Dropped automatically below ${SCALE_LABEL_LOD_SCALE * 100}% zoom.`}
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
            rendered <b>{rendered.toLocaleString()}</b>
          </span>
          {stats !== null && (
            <span className="chip">
              built in <b>{stats.buildMs.toFixed(0)} ms</b>
            </span>
          )}
        </div>

        {isCullingEnabled ? (
          showWarning && (
            <span className="warn-pill" role="status">
              Large graph — above {SCALE_WARN.toLocaleString()} shapes the field
              is too big to draw at once, so zoom-out stops at{" "}
              {ZOOM_BOUNDS.min * 100}% and you pan to explore. Below it, Fit
              frames everything.
            </span>
          )
        ) : (
          <span className="warn-pill" role="status">
            Culling off — every shape is mounted regardless of the viewport. At
            high counts this can freeze the tab.
          </span>
        )}
      </div>

      <div className={`stage__canvas ${areLabelsDrawn ? "" : "labels-hidden"}`}>
        <RenderStats onRendered={setRendered} />
        <DiagramCanvas<ScaleNodeData>
          renderElement={renderElement}
          fitOnMount={false}
          fitSignal={fitSignal}
          // Below the warn threshold the whole field can be drawn, so zoom-out
          // is allowed to reach fit. Above it, framing everything would mount a
          // view per shape and lock the tab — keep the ordinary floor and pan.
          minScale={showWarning ? ZOOM_BOUNDS.min : undefined}
          paperProps={{
            cellVisibility: isCullingEnabled ? cellVisibility : undefined,
            // Recompute cached viewport bounds only when the viewport actually moved.
            onTransform: markBoundsDirty,
            onResize: markBoundsDirty,
            // Shapes are read-only in the scale test: no element dragging.
            // (Panning still works on empty canvas; zoom still works.)
            interactive: false,
            drawGrid: {
              name: "mesh",
              args: { color: "rgba(140,150,190,0.10)" },
            },
            gridSize: 30,
          }}
        >
          <ScaleWatcher onScaleChange={setViewScale} />
        </DiagramCanvas>
      </div>
    </div>
  );
}

/** Demo k — generate up to {@link SCALE_MAX} shapes with virtualized rendering. */
export function ScaleDemo(): ReactNode {
  return (
    <GraphProvider>
      <ScaleStage />
    </GraphProvider>
  );
}
