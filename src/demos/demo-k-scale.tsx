import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  GraphProvider,
  useGraph,
  useOnPaperEvents,
  usePaper,
  type CellVisibility,
  type RenderElement,
} from '@joint/react';

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
      {data.label !== undefined && (
        <text
          x={NODE_WIDTH / 2}
          y={NODE_HEIGHT / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={11}
          fontWeight={600}
          fill="#0b0f1a"
        >
          {data.label}
        </text>
      )}
    </g>
  );
}

const renderElement: RenderElement<ScaleNodeData> = (data) => <ScaleNode data={data} />;

/** Only render cells whose bounding box intersects the (inflated) viewport. */
const cellVisibility: CellVisibility = ({ model, paper }) => {
  const area = paper.getArea().inflate(CULL_MARGIN);
  return area.intersect(model.getBBox()) !== null;
};

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
  const didInit = useRef(false);

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

        {showWarning && (
          <span className="warn-pill" role="status">
            Large graph — only the viewport is rendered. Zooming all the way out (Fit) draws
            everything and may stutter.
          </span>
        )}
      </div>

      <div className="stage__canvas">
        <RenderStats onRendered={setRendered} />
        <DiagramCanvas<ScaleNodeData>
          renderElement={renderElement}
          fitOnMount={false}
          fitSignal={fitSignal}
          paperProps={{
            cellVisibility,
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
