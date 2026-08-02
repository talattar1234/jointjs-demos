import { useEffect, useRef, useState } from 'react';

/** What the ticker reports back about the most recent tick. */
export interface ChurnTickerApi {
  /** Wall-clock cost of the last `apply` call, in ms. `null` before the first tick. */
  readonly lastMs: number | null;
  /** Ticks applied since the ticker last started. */
  readonly ticks: number;
}

export interface ChurnTickerOptions {
  /** Whether the timer is running. Turning it off resets the tick counter. */
  readonly isRunning: boolean;
  /** Tick rate. Already clamped by `clampChurnHz`. */
  readonly hz: number;
  /**
   * Applies one tick's worth of change. Receives the tick index so the caller
   * can derive deterministic values (see `churnHue`). Called synchronously and
   * timed — do the whole update here, don't defer it.
   */
  readonly apply: (tick: number) => void;
}

/**
 * Drives the scale demos' live-update load: calls `apply` `hz` times a second
 * and measures how long each call takes.
 *
 * The timer deliberately uses `setInterval` rather than rAF: the point is to
 * request a fixed update rate and watch whether the library can keep up, which
 * a frame-locked loop would hide by simply skipping work.
 */
export function useChurnTicker({ isRunning, hz, apply }: ChurnTickerOptions): ChurnTickerApi {
  const [lastMs, setLastMs] = useState<number | null>(null);
  const [ticks, setTicks] = useState(0);
  // Kept in a ref so changing the callback (it closes over count, graph, …)
  // doesn't tear down and restart the interval on every render.
  const applyRef = useRef(apply);
  applyRef.current = apply;

  useEffect(() => {
    if (!isRunning) {
      setTicks(0);
      setLastMs(null);
      return;
    }
    let tick = 0;
    const id = window.setInterval(() => {
      tick += 1;
      const start = performance.now();
      applyRef.current(tick);
      setLastMs(performance.now() - start);
      setTicks(tick);
    }, 1000 / hz);
    return () => window.clearInterval(id);
  }, [isRunning, hz]);

  return { lastMs, ticks };
}
