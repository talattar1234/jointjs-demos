import type { CellRecord } from '@joint/react';

/** Default shape count offered in the input (small, so it fits and renders instantly). */
export const SCALE_DEFAULT = 100;
/** Hard upper bound to avoid a typo (e.g. an extra zero) locking up the tab. */
export const SCALE_MAX = 200_000;
/** Above this, we show a "large graph" warning about fully rendering. */
export const SCALE_WARN = 20_000;
/** Only auto-fit the whole field for counts small enough to render at once. */
export const SCALE_FIT_LIMIT = 4_000;
/** Below this, each node also gets a text label (labels are costly at scale). */
export const SCALE_LABEL_LIMIT = 2_000;

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
  /** Optional label — only present for small graphs. */
  readonly label?: string;
}

const GOLDEN_ANGLE = 137.508;

/**
 * Build `count` element records laid out on a roughly 16:9 grid. Pure data —
 * no views are created here; the paper virtualizes rendering via
 * `cellVisibility`, so only on-screen nodes ever become React views.
 */
export function buildScaleCells(count: number): CellRecord<ScaleNodeData>[] {
  const columns = Math.max(1, Math.round(Math.sqrt((count * 16) / 9)));
  const withLabels = count <= SCALE_LABEL_LIMIT;
  const cells: CellRecord<ScaleNodeData>[] = new Array(count);

  for (let index = 0; index < count; index += 1) {
    const column = index % columns;
    const row = (index - column) / columns;
    const data: ScaleNodeData = withLabels
      ? { hue: (index * GOLDEN_ANGLE) % 360, label: String(index) }
      : { hue: (index * GOLDEN_ANGLE) % 360 };
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
