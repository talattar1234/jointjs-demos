import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  GraphProvider,
  useGraph,
  useOnPaperEvents,
  usePaper,
  type CellVisibility,
  type ElementPosition,
  type ElementSize,
  type RenderElement,
} from '@joint/react';
import type { dia } from '@joint/core';

import { DiagramCanvas } from '../components/diagram-canvas.tsx';
import {
  buildScaleCells,
  clampScaleCount,
  NODE_HEIGHT,
  NODE_WIDTH,
  SCALE_DEFAULT,
  SCALE_FIT_LIMIT,
  SCALE_MAX,
  SCALE_WARN,
  type ScaleNodeData,
} from '../data/scale.ts';

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

const renderElement: RenderElement<ScaleNodeData> = (data) => <ScaleNode data={data} />;

/** Reports how many cell views are actually mounted in the DOM after each render pass. */
function RenderStats({ onRendered }: Readonly<{ onRendered: (count: number) => void }>): ReactNode {
  const { paper } = usePaper();
  useOnPaperEvents({
    'render:done': () => {
      if (paper !== null) {
        onRendered(paper.el.querySelectorAll('.joint-cell').length);
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
  const { resetCells } = useGraph();
  const [input, setInput] = useState(String(SCALE_DEFAULT));
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [rendered, setRendered] = useState(0);
  const [fitSignal, setFitSignal] = useState(0);
  const [isCullingEnabled, setIsCullingEnabled] = useState(false);
  const [areLabelsVisible, setAreLabelsVisible] = useState(true);
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
      const { x, y } = model.get('position') as ElementPosition;
      const { width, height } = model.get('size') as ElementSize;
      return x < bounds.maxX && x + width > bounds.minX && y < bounds.maxY && y + height > bounds.minY;
    },
    [refreshBounds]
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
              if (event.key === 'Enter') {
                generate();
              }
            }}
          />
        </label>
        <button type="button" className="btn btn--primary" onClick={generate} disabled={busy}>
          {busy ? 'Generating…' : 'Generate'}
        </button>

        <button
          type="button"
          className={`btn ${isCullingEnabled ? 'btn--primary' : ''}`}
          aria-pressed={isCullingEnabled}
          onClick={() => setIsCullingEnabled((enabled) => !enabled)}
          title="Render only shapes inside the viewport. Off = mount everything (slower)."
        >
          Culling: {isCullingEnabled ? 'on' : 'off'}
        </button>

        <button
          type="button"
          className={`btn ${areLabelsVisible ? 'btn--primary' : ''}`}
          aria-pressed={areLabelsVisible}
          onClick={() => setAreLabelsVisible((visible) => !visible)}
          title="Show or hide the per-shape index label (CSS-only, no re-render)."
        >
          Labels: {areLabelsVisible ? 'on' : 'off'}
        </button>

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
              Large graph — only the viewport is rendered. Zooming all the way out (Fit) draws
              everything and may stutter.
            </span>
          )
        ) : (
          <span className="warn-pill" role="status">
            Culling off — every shape is mounted regardless of the viewport. At high counts this can
            freeze the tab.
          </span>
        )}
      </div>

      <div className={`stage__canvas ${areLabelsVisible ? '' : 'labels-hidden'}`}>
        <RenderStats onRendered={setRendered} />
        <DiagramCanvas<ScaleNodeData>
          renderElement={renderElement}
          fitOnMount={false}
          fitSignal={fitSignal}
          paperProps={{
            cellVisibility: isCullingEnabled ? cellVisibility : undefined,
            // Recompute cached viewport bounds only when the viewport actually moved.
            onTransform: markBoundsDirty,
            onResize: markBoundsDirty,
            // Shapes are read-only in the scale test: no element dragging.
            // (Panning still works on empty canvas; zoom still works.)
            interactive: false,
            drawGrid: { name: 'mesh', args: { color: 'rgba(140,150,190,0.10)' } },
            gridSize: 30,
          }}
        />
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
