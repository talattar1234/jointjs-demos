import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ReactFlowProvider, useEdgesState, useNodesState, useReactFlow, type Edge, type Node } from '@xyflow/react';

import { FlowCanvas } from './flow-canvas.tsx';
import { SCALE_NODE_TYPES } from './flow-nodes.tsx';
import { cellsToFlow } from './adapt.ts';
import { buildScaleCells, type ScaleNodeData } from '../data/scale.ts';

/**
 * React Flow renders nodes as real DOM elements (like JointJS' HTML boxes), so
 * its ceiling is far below the JointJS SVG demo's 200k. We cap well under that
 * and lean on `onlyRenderVisibleElements` — this honestly shows the DOM-substrate
 * limit. For truly huge graphs a WebGL renderer (e.g. Sigma.js) is the answer.
 */
const RF_SCALE_DEFAULT = 400;
const RF_SCALE_MAX = 10_000;
const RF_SCALE_WARN = 2_000;
const RF_SCALE_FIT_LIMIT = 1_500;

function clampCount(raw: string): number {
  const parsed = Math.floor(Number(raw));
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return Math.min(RF_SCALE_MAX, parsed);
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
  const didInit = useRef(false);

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
          void fitView({ duration: 0 });
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

        {showWarning && (
          <span className="warn-pill" role="status">
            React Flow renders DOM nodes, so high counts get heavy — this is the DOM-substrate ceiling,
            far below the JointJS SVG demo.
          </span>
        )}
      </div>

      <div className={`stage__canvas ${areLabelsVisible ? '' : 'labels-hidden'}`}>
        <FlowCanvas
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={SCALE_NODE_TYPES}
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
