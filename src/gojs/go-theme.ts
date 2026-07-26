import * as go from 'gojs';

/**
 * GoJS draws to a `<canvas>`, so none of the app's CSS custom properties reach
 * it. These palettes restate the `index.css` design tokens as concrete colors
 * and are registered as GoJS themes, so templates can bind with `.theme(...)` /
 * `.themeData(...)` and follow the light/dark toggle without being rebuilt.
 */

/** Link color, shared verbatim with the JointJS and React Flow tabs. */
export const GO_LINK_COLOR = '#7c8bff';

/** Node accents per flow kind. `io`/`end` are literal hex on the other tabs, so they don't theme. */
const KIND_IO = '#38bdf8';
const KIND_END = '#f472b6';

/** The theme names registered on every diagram — these match the app's `data-theme` values. */
export type GoThemeName = 'light' | 'dark';

const DARK: go.Theme = {
  colors: {
    text: '#e8edf7',
    textDim: '#9aa7bd',
    textFaint: '#6b7890',
    nodeFill: '#1a2338',
    nodeStroke: 'rgba(255, 255, 255, 0.10)',
    panel: '#121a2c',
    panelSoft: 'rgba(18, 26, 44, 0.92)',
    accent: '#6d7cff',
    link: GO_LINK_COLOR,
    selection: '#6d7cff',
    gridMinor: 'rgba(255, 255, 255, 0.05)',
    gridMajor: 'rgba(255, 255, 255, 0.09)',
    overviewBox: '#6d7cff',
    tempLink: '#6d7cff',
    tempPort: '#8b5cf6',
    adornmentFill: '#121a2c',
    adornmentStroke: '#6d7cff',
    kinds: { start: '#34d399', process: '#6d7cff', decision: '#fbbf24', io: KIND_IO, end: KIND_END },
    statuses: { ok: '#34d399', warn: '#fbbf24', crit: '#f87171' },
    strokes: { none: 'rgba(255, 255, 255, 0.10)', alert: '#f87171' },
  },
};

const LIGHT: go.Theme = {
  colors: {
    text: '#0f172a',
    textDim: '#475569',
    textFaint: '#8792a6',
    nodeFill: '#ffffff',
    nodeStroke: 'rgba(15, 23, 42, 0.12)',
    panel: '#ffffff',
    panelSoft: 'rgba(255, 255, 255, 0.92)',
    accent: '#4f46e5',
    link: GO_LINK_COLOR,
    selection: '#4f46e5',
    gridMinor: 'rgba(15, 23, 42, 0.06)',
    gridMajor: 'rgba(15, 23, 42, 0.10)',
    overviewBox: '#4f46e5',
    tempLink: '#4f46e5',
    tempPort: '#7c3aed',
    adornmentFill: '#ffffff',
    adornmentStroke: '#4f46e5',
    kinds: { start: '#059669', process: '#4f46e5', decision: '#d97706', io: KIND_IO, end: KIND_END },
    statuses: { ok: '#059669', warn: '#d97706', crit: '#dc2626' },
    strokes: { none: 'rgba(15, 23, 42, 0.12)', alert: '#dc2626' },
  },
};

const FONTS: go.ThemeValues<string> = {
  kind: '600 9.5px Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  label: '650 13.5px Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  title: '700 13px Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  role: '600 10.5px Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  metric: '700 22px Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  unit: '500 11px Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  edge: '600 11px Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  tiny: '600 10px Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
};

/**
 * Register the app's light/dark palettes on a diagram. Called once per diagram
 * by `GoCanvas`; switching themes afterwards is a single
 * `themeManager.currentTheme = 'light' | 'dark'` assignment.
 */
export function applyThemes(diagram: go.Diagram): void {
  // The palettes are absolute, not derived from CSS variables, so GoJS never
  // has to re-read computed styles when the app's `data-theme` flips.
  diagram.themeManager.readsCssVariables = false;
  diagram.themeManager.set('light', { ...LIGHT, fonts: FONTS });
  diagram.themeManager.set('dark', { ...DARK, fonts: FONTS });
  diagram.themeManager.defaultTheme = 'dark';
}

/** Read a color out of a diagram's current theme (for imperative, non-bound drawing). */
export function themeColor(diagram: go.Diagram, path: string, fallback: string): string {
  const found: unknown = diagram.themeManager.findValue(path, 'colors');
  return typeof found === 'string' ? found : fallback;
}
