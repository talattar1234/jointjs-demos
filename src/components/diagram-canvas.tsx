import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import {
  Paper,
  useOnElementsMeasured,
  type PaperProps,
  type RenderElement,
  type RenderLink,
} from '@joint/react';
import type { dia } from '@joint/core';

import { useZoomPan, ZoomPanContext } from '../hooks/use-zoom-pan.ts';
import { ZoomControls } from './zoom-controls.tsx';

type PaperExtras = Omit<PaperProps, 'renderElement' | 'renderLink' | 'transform' | 'style' | 'children'>;

interface DiagramCanvasProps<TElement, TLink> {
  readonly renderElement?: RenderElement<TElement>;
  readonly renderLink?: RenderLink<TLink>;
  /** Extra `<Paper>` props (grid, background, event handlers, `options`, …). */
  readonly paperProps?: PaperExtras;
  /** Overlay UI rendered above the canvas (legends, panels). */
  readonly children?: ReactNode;
  /** Show the built-in zoom toolbar. @default true */
  readonly showZoomControls?: boolean;
  /** Frame all content once, after the first measurement pass. @default true */
  readonly fitOnMount?: boolean;
  /** When set, adds a "zoom to selection" button wired to this element. */
  readonly selectedId?: dia.Cell.ID | null;
  /** Bump this counter to re-fit the viewport to content (e.g. after loading). */
  readonly fitSignal?: number;
}

/**
 * The shared canvas wrapper used by every demo: mounts a `<Paper>`, adds
 * mouse-wheel zoom, drag-to-pan on empty space, and a floating zoom toolbar.
 * Must be rendered inside a `<GraphProvider>`.
 */
export function DiagramCanvas<TElement = unknown, TLink = unknown>({
  renderElement,
  renderLink,
  paperProps,
  children,
  showZoomControls = true,
  fitOnMount = true,
  selectedId,
  fitSignal,
}: Readonly<DiagramCanvasProps<TElement, TLink>>): ReactNode {
  const containerRef = useRef<HTMLDivElement>(null);
  const zoom = useZoomPan(containerRef);
  const panOrigin = useRef<{ x: number; y: number } | null>(null);
  const hasFitted = useRef(false);

  // Re-fit on demand without re-running when the zoom object identity changes.
  const fitContentRef = useRef(zoom.fitContent);
  fitContentRef.current = zoom.fitContent;
  useEffect(() => {
    if (fitSignal !== undefined && fitSignal > 0) {
      fitContentRef.current();
    }
  }, [fitSignal]);

  // Fit once, after elements have been measured (HTML boxes size asynchronously).
  useOnElementsMeasured(({ isInitial }) => {
    if (fitOnMount && isInitial && !hasFitted.current) {
      hasFitted.current = true;
      zoom.fitContent();
    }
  });

  const handleBlankPointerDown = useCallback<NonNullable<PaperProps['onBlankPointerDown']>>(
    (params) => {
      panOrigin.current = { x: params.event.clientX ?? 0, y: params.event.clientY ?? 0 };
      if (containerRef.current !== null) {
        containerRef.current.style.cursor = 'grabbing';
      }
      paperProps?.onBlankPointerDown?.(params);
    },
    [paperProps]
  );

  const handleBlankPointerMove = useCallback<NonNullable<PaperProps['onBlankPointerMove']>>(
    (params) => {
      if (panOrigin.current !== null) {
        const clientX = params.event.clientX ?? 0;
        const clientY = params.event.clientY ?? 0;
        zoom.panBy(clientX - panOrigin.current.x, clientY - panOrigin.current.y);
        panOrigin.current = { x: clientX, y: clientY };
      }
      paperProps?.onBlankPointerMove?.(params);
    },
    [paperProps, zoom]
  );

  const handleBlankPointerUp = useCallback<NonNullable<PaperProps['onBlankPointerUp']>>(
    (params) => {
      panOrigin.current = null;
      if (containerRef.current !== null) {
        containerRef.current.style.cursor = '';
      }
      paperProps?.onBlankPointerUp?.(params);
    },
    [paperProps]
  );

  const zoomToSelected = useCallback(() => {
    if (selectedId !== null && selectedId !== undefined) {
      zoom.zoomToElement(selectedId);
    }
  }, [selectedId, zoom]);

  return (
    <div className="canvas" ref={containerRef}>
      <Paper
        {...paperProps}
        renderElement={renderElement}
        renderLink={renderLink}
        transform={zoom.transform}
        style={{ width: '100%', height: '100%' }}
        onBlankPointerDown={handleBlankPointerDown}
        onBlankPointerMove={handleBlankPointerMove}
        onBlankPointerUp={handleBlankPointerUp}
      />
      {showZoomControls && (
        <ZoomControls
          zoom={zoom}
          onZoomToSelected={selectedId === undefined ? undefined : zoomToSelected}
          hasSelection={selectedId !== null && selectedId !== undefined}
        />
      )}
      <ZoomPanContext value={zoom}>{children}</ZoomPanContext>
    </div>
  );
}
