import { createContext, useCallback, useContext, useEffect, useRef, useState, type RefObject } from 'react';
import { usePaper } from '@joint/react';
import type { dia } from '@joint/core';

/** Zoom limits and step, kept as named constants rather than magic numbers. */
const MIN_SCALE = 0.25;
const MAX_SCALE = 2.5;
const ZOOM_STEP = 1.2;
const FIT_PADDING = 48;
/** Cap used when framing a single element so we never zoom in absurdly close. */
const ELEMENT_MAX_SCALE = 1.5;

interface Transform {
  readonly scale: number;
  readonly tx: number;
  readonly ty: number;
}

interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Imperative zoom/pan controls plus the `transform` string for `<Paper>`. */
export interface ZoomPan {
  /** Value for the `<Paper transform>` prop: `translate(..px,..px) scale(..)`. */
  readonly transform: string;
  readonly scale: number;
  readonly zoomIn: () => void;
  readonly zoomOut: () => void;
  /** Back to 100% at the origin. */
  readonly reset: () => void;
  /** Frame the whole diagram in the viewport. */
  readonly fitContent: () => void;
  /** Frame a single element (used by the "zoom to selected" control). */
  readonly zoomToElement: (id: dia.Cell.ID) => void;
  /** Nudge the viewport by a screen-space delta (used by blank-canvas panning). */
  readonly panBy: (dx: number, dy: number) => void;
}

function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/**
 * Controlled zoom/pan for a `<Paper>`. Owns the viewport transform in React
 * state (single source of truth) so mouse-wheel zoom, drag-pan, and the
 * programmatic controls in demo `h` all stay in sync. Wheel zooming is wired to
 * the passed container so it can `preventDefault` the page scroll.
 * @param containerRef - the element that wraps the `<Paper>` and receives wheel events
 */
const INITIAL_TRANSFORM: Transform = { scale: 1, tx: FIT_PADDING, ty: FIT_PADDING };

export function useZoomPan(containerRef: RefObject<HTMLElement | null>): ZoomPan {
  const { paper } = usePaper();
  const [transform, setTransform] = useState<Transform>(INITIAL_TRANSFORM);

  // `transformRef` is the live source of truth; continuous gestures (wheel/drag)
  // accumulate into it and commit to React state at most once per animation
  // frame, so panning 100k cells doesn't re-run viewport culling 60×/second.
  const transformRef = useRef<Transform>(INITIAL_TRANSFORM);
  const rafRef = useRef<number | null>(null);

  const flush = useCallback(() => {
    rafRef.current = null;
    setTransform(transformRef.current);
  }, []);

  const apply = useCallback(
    (updater: (previous: Transform) => Transform, immediate: boolean) => {
      transformRef.current = updater(transformRef.current);
      if (immediate) {
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        setTransform(transformRef.current);
      } else if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(flush);
      }
    },
    [flush]
  );

  const zoomAtPoint = useCallback(
    (factor: number, px: number, py: number, immediate: boolean) => {
      apply((prev) => {
        const scale = clampScale(prev.scale * factor);
        const ratio = scale / prev.scale;
        return { scale, tx: px - ratio * (px - prev.tx), ty: py - ratio * (py - prev.ty) };
      }, immediate);
    },
    [apply]
  );

  const zoomAtCenter = useCallback(
    (factor: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      zoomAtPoint(factor, (rect?.width ?? 0) / 2, (rect?.height ?? 0) / 2, true);
    },
    [containerRef, zoomAtPoint]
  );

  const zoomIn = useCallback(() => zoomAtCenter(ZOOM_STEP), [zoomAtCenter]);
  const zoomOut = useCallback(() => zoomAtCenter(1 / ZOOM_STEP), [zoomAtCenter]);
  const reset = useCallback(() => apply(() => INITIAL_TRANSFORM, true), [apply]);
  const panBy = useCallback(
    (dx: number, dy: number) => {
      apply((prev) => ({ scale: prev.scale, tx: prev.tx + dx, ty: prev.ty + dy }), false);
    },
    [apply]
  );

  const fitBBox = useCallback(
    (bbox: Rect, maxScale: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect === undefined || bbox.width <= 0 || bbox.height <= 0) {
        return;
      }
      const fitScale = Math.min(
        (rect.width - FIT_PADDING * 2) / bbox.width,
        (rect.height - FIT_PADDING * 2) / bbox.height
      );
      const scale = Math.min(clampScale(fitScale), maxScale);
      apply(
        () => ({
          scale,
          tx: (rect.width - scale * bbox.width) / 2 - scale * bbox.x,
          ty: (rect.height - scale * bbox.height) / 2 - scale * bbox.y,
        }),
        true
      );
    },
    [apply, containerRef]
  );

  const fitContent = useCallback(() => {
    if (paper === null) {
      return;
    }
    fitBBox(paper.getContentArea(), MAX_SCALE);
  }, [paper, fitBBox]);

  const zoomToElement = useCallback(
    (id: dia.Cell.ID) => {
      if (paper === null) {
        return;
      }
      const cell = paper.model.getCell(id);
      if (cell === undefined || !cell.isElement()) {
        return;
      }
      fitBBox(cell.getBBox(), ELEMENT_MAX_SCALE);
    },
    [paper, fitBBox]
  );

  // Wheel zoom is attached natively so we can call preventDefault (React's
  // onWheel is passive and cannot stop the page from scrolling).
  useEffect(() => {
    const element = containerRef.current;
    if (element === null) {
      return;
    }
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      zoomAtPoint(factor, event.clientX - rect.left, event.clientY - rect.top, false);
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [containerRef, zoomAtPoint]);

  // Cancel any pending frame on unmount.
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const transformString = `translate(${transform.tx}px, ${transform.ty}px) scale(${transform.scale})`;
  return { transform: transformString, scale: transform.scale, zoomIn, zoomOut, reset, fitContent, zoomToElement, panBy };
}

/** Re-exported so demos can label their zoom buttons consistently. */
export const ZOOM_BOUNDS = { min: MIN_SCALE, max: MAX_SCALE } as const;

/**
 * Context that exposes the canvas's {@link ZoomPan} API to overlay children, so
 * a demo can render its own zoom buttons (demo h) that drive the same viewport.
 */
export const ZoomPanContext = createContext<ZoomPan | null>(null);

/** Access the surrounding canvas's zoom controls. Throws if no canvas is above. */
export function useZoomPanControls(): ZoomPan {
  const value = useContext(ZoomPanContext);
  if (value === null) {
    throw new Error('useZoomPanControls must be used within a DiagramCanvas');
  }
  return value;
}
