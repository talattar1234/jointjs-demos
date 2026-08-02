import { useState, type ReactNode } from 'react';

import {
  clampChurnHz,
  SCALE_CHURN_MAX_HZ,
  SCALE_CHURN_MIN_HZ,
  SCALE_CHURN_STRIDE,
} from '../data/scale.ts';

export interface ChurnControlsProps {
  /** Whether the live-update loop is ticking. */
  readonly isRunning: boolean;
  /** Toggles the loop on/off. */
  readonly onToggleRunning: () => void;
  /** Current tick rate. */
  readonly hz: number;
  /** Called with an already-clamped rate whenever the input holds a usable number. */
  readonly onHzChange: (hz: number) => void;
  /** How many shapes one tick recolors — shown so the load is explicit. */
  readonly perTick: number;
  /** Cost of the last tick in ms, or `null` before the first one. */
  readonly lastMs: number | null;
}

/**
 * Toolbar controls for the scale demos' live-update load: a run toggle, a tick
 * rate, and the measured cost of the last tick.
 *
 * Shared by all three library tabs so the comparison is like-for-like — the
 * only thing that differs between tabs is how the update is actually applied.
 */
export function ChurnControls({
  isRunning,
  onToggleRunning,
  hz,
  onHzChange,
  perTick,
  lastMs,
}: Readonly<ChurnControlsProps>): ReactNode {
  const [input, setInput] = useState(String(hz));
  const budgetMs = 1000 / hz;
  // The tick took longer than the interval it was asked to run at, so the
  // library is the bottleneck, not the timer.
  const isOverBudget = lastMs !== null && lastMs > budgetMs;

  return (
    <>
      <button
        type="button"
        className={`btn ${isRunning ? 'btn--primary' : ''}`}
        aria-pressed={isRunning}
        onClick={onToggleRunning}
        title={`Recolor 1 in every ${SCALE_CHURN_STRIDE} shapes on every tick, to show how the library copes with a constantly changing graph.`}
      >
        Churn: {isRunning ? 'on' : 'off'}
      </button>

      <label className="field">
        <span className="field__label">Hz</span>
        <input
          className="field__input field__input--narrow"
          type="number"
          min={SCALE_CHURN_MIN_HZ}
          max={SCALE_CHURN_MAX_HZ}
          step={1}
          value={input}
          onChange={(event) => {
            const raw = event.target.value;
            setInput(raw);
            if (raw.trim() !== '' && Number.isFinite(Number(raw))) {
              onHzChange(clampChurnHz(raw));
            }
          }}
          // Snap the text back to what was actually applied (empty, or clamped).
          onBlur={() => setInput(String(hz))}
        />
      </label>

      {isRunning && (
        <div className="chips">
          <span className="chip">
            churn <b>{perTick.toLocaleString()}</b>/tick
          </span>
          <span className={`chip ${isOverBudget ? 'chip--warn' : ''}`}>
            update <b>{lastMs === null ? '—' : `${lastMs.toFixed(1)} ms`}</b>
          </span>
        </div>
      )}
    </>
  );
}
