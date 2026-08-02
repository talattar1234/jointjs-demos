import type { ReactNode } from 'react';

import type { ZoomPan } from '../hooks/use-zoom-pan.ts';

interface ZoomControlsProps {
  readonly zoom: ZoomPan;
  /** When provided, adds a "zoom to selection" button (used by demos b/h). */
  readonly onZoomToSelected?: () => void;
  /** Disables the selection button when nothing is selected. */
  readonly hasSelection?: boolean;
}

/** Slack on the floor comparison so float drift doesn't leave the button live at the limit. */
const SCALE_EPSILON = 1.001;

/** Floating zoom toolbar rendered over a {@link DiagramCanvas}. */
export function ZoomControls({ zoom, onZoomToSelected, hasSelection }: Readonly<ZoomControlsProps>): ReactNode {
  const isAtMinScale = zoom.scale <= zoom.minScale * SCALE_EPSILON;

  return (
    <div className="zoom-controls" role="group" aria-label="Zoom controls">
      <button type="button" className="zoom-btn" onClick={zoom.zoomIn} aria-label="Zoom in" title="Zoom in">
        +
      </button>
      <button
        type="button"
        className="zoom-btn"
        onClick={zoom.zoomOut}
        disabled={isAtMinScale}
        aria-label="Zoom out"
        title={isAtMinScale ? 'Zoomed all the way out' : 'Zoom out'}
      >
        −
      </button>
      <div className="zoom-level" aria-live="polite">
        {Math.round(zoom.scale * 100)}%
      </div>
      <button type="button" className="zoom-btn" onClick={zoom.fitContent} title="Fit to content">
        ⤢
      </button>
      <button type="button" className="zoom-btn" onClick={zoom.reset} title="Reset to 100%">
        ⟲
      </button>
      {onZoomToSelected && (
        <button
          type="button"
          className="zoom-btn"
          onClick={onZoomToSelected}
          disabled={hasSelection !== true}
          title="Zoom to selected"
        >
          ◎
        </button>
      )}
    </div>
  );
}
