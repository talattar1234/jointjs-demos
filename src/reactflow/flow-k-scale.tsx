import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import {
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useStore,
  type Edge,
  type Node,
} from '@xyflow/react';

import { ChurnControls } from '../components/churn-controls.tsx';
import { FlowCanvas, FLOW_ZOOM_BOUNDS } from './flow-canvas.tsx';
import { SCALE_NODE_TYPES } from './flow-nodes.tsx';
import { cellsToFlow } from './adapt.ts';
import { useChurnTicker } from '../hooks/use-churn-ticker.ts';
import {
  buildScaleCells,
  churnCountPerTick,
  churnHue,
  isChurnIndex,
  scaleContentSize,
  SCALE_CHURN_DEFAULT_HZ,
  SCALE_LABEL_LOD_SCALE,
  type ScaleNodeData,
} from '../data/scale.ts';

/**
 * React Flow renders nodes as real DOM elements (like JointJS' HTML boxes), so
 * its ceiling is far below the JointJS SVG demo's 200k. We cap well under that
 * and lean on `onlyRenderVisibleElements` — this honestly shows the DOM-substrate
 * limit. For truly huge graphs a WebGL renderer (e.g. Sigma.js) is the answer.
 */
const RF_SCALE_DEFAULT = 400;
const RF_SCALE_MAX = 10_000;
const RF_SCALE_WARN = 2_000;
/**
 * Only auto-fit after generating when the field is small enough to draw at once
 * — fitting puts every node on screen, which defeats `onlyRenderVisibleElements`.
 * Past this the user opts in via the Fit button.
 */
const RF_SCALE_FIT_LIMIT = RF_SCALE_WARN;
/** Hard floor for the content-aware `minZoom` below. */
const RF_ABSOLUTE_MIN_ZOOM = 0.02;
/** React Flow's own `fitView` padding, mirrored so zoom-out lands exactly on fit. */
const RF_FIT_PADDING = 0.1;

function clampCount(raw: string): number {
  const parsed = Math.floor(Number(raw));
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return Math.min(RF_SCALE_MAX, parsed);
}

/**
 * Lowest zoom the user may reach for a field of `count` shapes. Normally the
 * shared floor, but a field too large to fit there lowers it to exactly its fit
 * zoom, so zooming all the way out always shows everything.
 *
 * Derived from {@link scaleContentSize} rather than measuring the nodes: this is
 * recomputed on every churn tick and walking 10k nodes per tick would dominate.
 */
function scaleMinZoom(count: number, paneWidth: number, paneHeight: number): number {
  const content = scaleContentSize(count);
  if (content.width <= 0 || content.height <= 0 || paneWidth <= 0 || paneHeight <= 0) {
    return FLOW_ZOOM_BOUNDS.min;
  }
  const fitZoom = Math.min(
    paneWidth / (content.width * (1 + RF_FIT_PADDING)),
    paneHeight / (content.height * (1 + RF_FIT_PADDING))
  );
  if (!Number.isFinite(fitZoom) || fitZoom >= FLOW_ZOOM_BOUNDS.min) {
    return FLOW_ZOOM_BOUNDS.min;
  }
  return Math.max(RF_ABSOLUTE_MIN_ZOOM, fitZoom);
}

function countRenderedNodes(): number {
  return document.querySelectorAll('.react-flow__node-scale').length;
}

interface Stats {
  readonly count: number;
  readonly buildMs: number;
}

function ScaleStage(): ReactNode {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<ScaleNodeData>>([]);
  const [edges, , onEdgesChange] = useEdgesState<Edge>([]);
  const { fitView } = useReactFlow();
  const [input, setInput] = useState(String(RF_SCALE_DEFAULT));
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [rendered, setRendered] = useState(0);
  const [isCullingEnabled, setIsCullingEnabled] = useState(true);
  const [areLabelsVisible, setAreLabelsVisible] = useState(true);
  const [isChurnRunning, setIsChurnRunning] = useState(false);
  const [churnHz, setChurnHz] = useState(SCALE_CHURN_DEFAULT_HZ);
  const didInit = useRef(false);

  // Pane size and live zoom, straight from the React Flow store.
  const paneWidth = useStore((state) => state.width);
  const paneHeight = useStore((state) => state.height);
  const viewZoom = useStore((state) => state.transform[2]);

  // Kept in a ref too, so `generate` can read the fresh floor without waiting
  // for the re-render that hands the new `minZoom` to <ReactFlow>.
  const paneRef = useRef({ width: paneWidth, height: paneHeight });
  paneRef.current = { width: paneWidth, height: paneHeight };

  const generate = useCallback(() => {
    const count = clampCount(input);
    setInput(String(count));
    setBusy(true);
    // Defer the heavy build so the "Generating…" state can paint first.
    window.setTimeout(() => {
      const start = performance.now();
      const { nodes: nextNodes } = cellsToFlow(buildScaleCells(count), 'scale');
      setNodes(nextNodes);
      const buildMs = performance.now() - start;
      setStats({ count, buildMs });
      setBusy(false);
      window.setTimeout(() => {
        if (count <= RF_SCALE_FIT_LIMIT) {
          const { width, height } = paneRef.current;
          void fitView({ duration: 0, minZoom: scaleMinZoom(count, width, height) });
        }
        setRendered(countRenderedNodes());
      }, 60);
    }, 20);
  }, [input, setNodes, fitView]);

  useEffect(() => {
    if (didInit.current) {
      return;
    }
    didInit.current = true;
    generate();
  }, [generate]);

  const count = stats?.count ?? 0;
  const showWarning = count > RF_SCALE_WARN;
  const minZoom = useMemo(
    () => scaleMinZoom(count, paneWidth, paneHeight),
    [count, paneWidth, paneHeight]
  );
  // Level of detail — same threshold as the other two tabs.
  const isLabelLodActive = viewZoom < SCALE_LABEL_LOD_SCALE;
  const areLabelsDrawn = areLabelsVisible && !isLabelLodActive;

  // React Flow keeps nodes in React state, so a tick is one `setNodes` that
  // rebuilds the array — only the churned nodes get a fresh `data` object, the
  // rest keep their identity so their memoized views don't re-render.
  //
  // `flushSync` forces the render+commit to happen inside the measured window.
  // Without it the timer would only be timing how long it takes to *schedule*
  // an update, which is the cheap half and would flatter this tab unfairly.
  const applyChurn = useCallback(
    (tick: number) => {
      flushSync(() => {
        setNodes((previous) =>
          previous.map((node, index) =>
            isChurnIndex(index, tick)
              ? { ...node, data: { ...node.data, hue: churnHue(index, tick) } }
              : node
          )
        );
      });
    },
    [setNodes]
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
            max={RF_SCALE_MAX}
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
          title="Render only nodes inside the viewport (onlyRenderVisibleElements). Off = mount everything."
        >
          Culling: {isCullingEnabled ? 'on' : 'off'}
        </button>

        <button
          type="button"
          className={`btn ${areLabelsVisible ? 'btn--primary' : ''}`}
          aria-pressed={areLabelsVisible}
          onClick={() => setAreLabelsVisible((visible) => !visible)}
          title={`Show or hide the per-shape index label (CSS-only, no re-render). Dropped automatically below ${SCALE_LABEL_LOD_SCALE * 100}% zoom.`}
        >
          Labels: {areLabelsVisible ? (isLabelLodActive ? 'auto-off' : 'on') : 'off'}
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

        {showWarning && (
          <span className="warn-pill" role="status">
            React Flow renders DOM nodes, so high counts get heavy — this is the DOM-substrate ceiling,
            far below the JointJS SVG demo.
          </span>
        )}
      </div>

      <div className={`stage__canvas ${areLabelsDrawn ? '' : 'labels-hidden'}`}>
        <FlowCanvas
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={SCALE_NODE_TYPES}
          minZoom={minZoom}
          onlyRenderVisibleElements={isCullingEnabled}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          fitView={false}
          onMoveEnd={() => setRendered(countRenderedNodes())}
        />
      </div>
    </div>
  );
}

/** Demo k (React Flow) — generate many shapes with viewport culling. */
export function FlowScaleDemo(): ReactNode {
  return (
    <ReactFlowProvider>
      <ScaleStage />
    </ReactFlowProvider>
  );
}
