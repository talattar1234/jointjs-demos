import { useEffect, useRef, useState, type ReactNode } from 'react';
import * as go from 'gojs';

import { useTheme } from '../app/theme.tsx';
import { applyThemes } from './go-theme.ts';

/** Zoom bounds mirroring the React Flow tab, so the tabs feel the same. */
const MIN_SCALE = 0.2;
const MAX_SCALE = 2.5;
/** Grid spacing, matching the React Flow `<Background gap={18} />`. */
const GRID_STEP = 18;
/** Slack left around the content when fitting. */
const FIT_PADDING = 24;

interface GoCanvasProps {
  /**
   * One-time diagram setup: templates, model, tools, listeners. Must be stable
   * (a module constant or `useCallback`) — the diagram is rebuilt if it changes.
   */
  readonly init: (diagram: go.Diagram) => void;
  /** Called with the live diagram once it exists, and with `null` on teardown. */
  readonly onReady?: (diagram: go.Diagram | null) => void;
  /** Overlay UI rendered above the canvas (panels, legends). */
  readonly children?: ReactNode;
  /** Show the GoJS `Overview` (its minimap) in the corner. @default false */
  readonly overview?: boolean;
  /** Show the floating zoom toolbar. @default true */
  readonly zoomControls?: boolean;
  /** Adds a "zoom to selected" button that frames the current selection. */
  readonly canZoomToSelection?: boolean;
}

/**
 * The GoJS analogue of `DiagramCanvas` / `FlowCanvas`: a `go.Diagram` mounted on
 * a plain div inside the shared `.canvas` chrome, with the app's palettes
 * registered as GoJS themes, a grid, and the floating zoom toolbar.
 *
 * Unlike the other two tabs there is no React reconciliation here — GoJS owns
 * its own model and view. Demos get the live `go.Diagram` through `onReady` and
 * drive it imperatively inside transactions.
 */
export function GoCanvas({
  init,
  onReady,
  children,
  overview = false,
  zoomControls = true,
  canZoomToSelection = false,
}: Readonly<GoCanvasProps>): ReactNode {
  const hostRef = useRef<HTMLDivElement>(null);
  const [diagram, setDiagram] = useState<go.Diagram | null>(null);
  const { theme } = useTheme();

  // Held in refs so a demo's inline callback — or a theme flip — never forces a
  // diagram rebuild.
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const themeRef = useRef(theme);
  themeRef.current = theme;

  useEffect(() => {
    const host = hostRef.current;
    if (host === null) {
      return;
    }

    const created = new go.Diagram(host, {
      'animationManager.isInitial': false,
      'undoManager.isEnabled': false,
      'toolManager.hoverDelay': 250,
      initialAutoScale: go.AutoScale.Uniform,
      initialContentAlignment: go.Spot.Center,
      padding: new go.Margin(FIT_PADDING),
      minScale: MIN_SCALE,
      maxScale: MAX_SCALE,
      grid: new go.Panel('Grid', { gridCellSize: new go.Size(GRID_STEP, GRID_STEP) }).add(
        new go.Shape('LineH', { strokeWidth: 1 }).theme('stroke', 'gridMinor'),
        new go.Shape('LineV', { strokeWidth: 1 }).theme('stroke', 'gridMinor')
      ),
    });

    applyThemes(created);
    // Set before the first paint, otherwise a dark app briefly shows light nodes.
    created.themeManager.currentTheme = themeRef.current;
    init(created);

    setDiagram(created);
    onReadyRef.current?.(created);

    // GoJS's documented teardown: detaching the div releases its listeners.
    return () => {
      onReadyRef.current?.(null);
      setDiagram(null);
      created.div = null;
    };
  }, [init]);

  useEffect(() => {
    if (diagram !== null) {
      diagram.themeManager.currentTheme = theme;
    }
  }, [diagram, theme]);

  return (
    <div className="canvas go-canvas">
      <div ref={hostRef} className="go-canvas__host" />
      {overview && diagram !== null && <GoOverview observed={diagram} />}
      {zoomControls && diagram !== null && (
        <GoZoomControls diagram={diagram} canZoomToSelection={canZoomToSelection} />
      )}
      {children}
    </div>
  );
}

/** GoJS's built-in minimap, mounted on its own div and bound to the main diagram. */
function GoOverview({ observed }: Readonly<{ observed: go.Diagram }>): ReactNode {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (host === null) {
      return;
    }
    const overview = new go.Overview(host, { observed, contentAlignment: go.Spot.Center });
    applyThemes(overview);
    overview.themeManager.currentTheme = observed.themeManager.currentTheme;
    return () => {
      overview.div = null;
    };
  }, [observed]);

  return <div ref={hostRef} className="go-overview" />;
}

interface GoZoomControlsProps {
  readonly diagram: go.Diagram;
  readonly canZoomToSelection: boolean;
}

/**
 * The floating zoom toolbar, reusing the JointJS tab's `.zoom-controls` styling.
 * Everything here is a `CommandHandler` call — GoJS ships these commands, so
 * unlike the JointJS side there is no hand-rolled zoom/pan state to keep in sync.
 */
function GoZoomControls({ diagram, canZoomToSelection }: Readonly<GoZoomControlsProps>): ReactNode {
  const [scale, setScale] = useState(diagram.scale);
  const [hasSelection, setHasSelection] = useState(diagram.selection.count > 0);

  useEffect(() => {
    const onViewport = (): void => setScale(diagram.scale);
    const onSelection = (): void => setHasSelection(diagram.selection.count > 0);
    diagram.addDiagramListener('ViewportBoundsChanged', onViewport);
    diagram.addDiagramListener('ChangedSelection', onSelection);
    return () => {
      diagram.removeDiagramListener('ViewportBoundsChanged', onViewport);
      diagram.removeDiagramListener('ChangedSelection', onSelection);
    };
  }, [diagram]);

  const zoomToSelection = (): void => {
    const part = diagram.selection.first();
    if (part !== null) {
      diagram.zoomToRect(part.actualBounds.copy().inflate(120, 120), go.AutoScale.Uniform);
    }
  };

  return (
    <div className="zoom-controls" role="group" aria-label="Zoom controls">
      <button
        type="button"
        className="zoom-btn"
        onClick={() => diagram.commandHandler.increaseZoom()}
        aria-label="Zoom in"
        title="Zoom in"
      >
        +
      </button>
      <button
        type="button"
        className="zoom-btn"
        onClick={() => diagram.commandHandler.decreaseZoom()}
        aria-label="Zoom out"
        title="Zoom out"
      >
        −
      </button>
      <div className="zoom-level" aria-live="polite">
        {Math.round(scale * 100)}%
      </div>
      <button type="button" className="zoom-btn" onClick={() => diagram.zoomToFit()} title="Fit to content">
        ⤢
      </button>
      <button
        type="button"
        className="zoom-btn"
        onClick={() => diagram.commandHandler.resetZoom()}
        title="Reset to 100%"
      >
        ⟲
      </button>
      {canZoomToSelection && (
        <button
          type="button"
          className="zoom-btn"
          onClick={zoomToSelection}
          disabled={!hasSelection}
          title="Zoom to selected"
        >
          ◎
        </button>
      )}
    </div>
  );
}
