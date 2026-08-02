import type { CellRecord } from '@joint/react';

/** Default shape count offered in the input (small, so it fits and renders instantly). */
export const SCALE_DEFAULT = 100;
/** Hard upper bound to avoid a typo (e.g. an extra zero) locking up the tab. */
export const SCALE_MAX = 200_000;
/** Above this, we show a "large graph" warning about fully rendering. */
export const SCALE_WARN = 20_000;
/** Only auto-fit the whole field for counts small enough to render at once. */
export const SCALE_FIT_LIMIT = 4_000;

/** Fixed node geometry, shared by the generator and the renderer. */
export const NODE_WIDTH = 44;
export const NODE_HEIGHT = 30;
const GAP_X = 60;
const GAP_Y = 46;

/** Data payload carried by each generated shape. */
export interface ScaleNodeData {
  readonly [key: string]: unknown;
  /** Hue used to color the node, spread via the golden angle for variety. */
  readonly hue: number;
  /** Per-node label (its index). Always present; visibility is toggled in the UI. */
  readonly label: string;
}

const GOLDEN_ANGLE = 137.508;

/**
 * Build `count` element records laid out on a roughly 16:9 grid. Pure data —
 * no views are created here; the paper virtualizes rendering via
 * `cellVisibility`, so only on-screen nodes ever become React views.
 */
export function buildScaleCells(count: number): CellRecord<ScaleNodeData>[] {
  const columns = Math.max(1, Math.round(Math.sqrt((count * 16) / 9)));
  const cells: CellRecord<ScaleNodeData>[] = new Array(count);

  for (let index = 0; index < count; index += 1) {
    const column = index % columns;
    const row = (index - column) / columns;
    const data: ScaleNodeData = { hue: (index * GOLDEN_ANGLE) % 360, label: String(index) };
    cells[index] = {
      id: `n${index}`,
      type: 'element',
      position: { x: column * GAP_X, y: row * GAP_Y },
      size: { width: NODE_WIDTH, height: NODE_HEIGHT },
      data,
    };
  }

  return cells;
}

/** Clamp raw user input to a sane, generatable integer. */
export function clampScaleCount(raw: string): number {
  const parsed = Math.floor(Number(raw));
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return Math.min(SCALE_MAX, parsed);
}

/* -------------------------------------------------------------------------- */
/* Churn — a live "some shapes keep changing" load, shared by all three tabs.  */
/* -------------------------------------------------------------------------- */

/** Ticks per second the churn starts at. */
export const SCALE_CHURN_DEFAULT_HZ = 1;
/** Slowest / fastest tick rate the input accepts. */
export const SCALE_CHURN_MIN_HZ = 0.1;
export const SCALE_CHURN_MAX_HZ = 60;

/**
 * One in every `SCALE_CHURN_STRIDE` shapes is recolored per tick, so each shape
 * changes once per that many ticks. Striding (rather than taking a contiguous
 * slice) spreads the changed set across the whole field, so the churn is visible
 * wherever the viewport happens to be — and the per-tick cost still grows with
 * the total count, which is the thing being measured.
 */
export const SCALE_CHURN_STRIDE = 10;

/** Hue rotation applied per tick — big enough that a change is unmistakable. */
const CHURN_HUE_STEP = 61;

/** Clamp raw Hz input to the supported tick-rate range. */
export function clampChurnHz(raw: string): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < SCALE_CHURN_MIN_HZ) {
    return SCALE_CHURN_MIN_HZ;
  }
  return Math.min(SCALE_CHURN_MAX_HZ, parsed);
}

/** How many shapes a single tick touches, for `count` total shapes. */
export function churnCountPerTick(count: number): number {
  return Math.ceil(count / SCALE_CHURN_STRIDE);
}

/**
 * Hue for shape `index` on tick `tick`. Pure, so every tab lands on the same
 * color for the same tick — the tabs stay comparable frame by frame.
 */
export function churnHue(index: number, tick: number): number {
  return (index * GOLDEN_ANGLE + tick * CHURN_HUE_STEP) % 360;
}

/** Whether shape `index` is one of the ones tick `tick` recolors. */
export function isChurnIndex(index: number, tick: number): boolean {
  return index % SCALE_CHURN_STRIDE === tick % SCALE_CHURN_STRIDE;
}

/**
 * Visit the shape indices this tick recolors. Kept as a callback so no
 * intermediate array is allocated — at 200k shapes the tick runs 20k times a
 * second in the worst case and allocation would dominate the measurement.
 */
export function forEachChurnIndex(
  count: number,
  tick: number,
  visit: (index: number) => void
): void {
  for (let index = tick % SCALE_CHURN_STRIDE; index < count; index += SCALE_CHURN_STRIDE) {
    visit(index);
  }
}
