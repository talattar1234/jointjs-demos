import type { ComponentType } from 'react';

import { BlinkingDemo } from '../demos/demo-a-blinking.tsx';
import { SelectionDemo } from '../demos/demo-b-selection.tsx';
import { ContextMenuDemo } from '../demos/demo-c-context-menu.tsx';
import { CodeSelectDemo } from '../demos/demo-d-code-select.tsx';
import { AddRemoveDemo } from '../demos/demo-e-add-remove.tsx';
import { DatasetsDemo } from '../demos/demo-f-datasets.tsx';
import { EventsDemo } from '../demos/demo-g-events.tsx';
import { ZoomToDemo } from '../demos/demo-h-zoom-to.tsx';
import { DashboardDemo } from '../demos/demo-i-dashboard.tsx';
import { EditorDemo } from '../demos/demo-j-editor.tsx';
import { ScaleDemo } from '../demos/demo-k-scale.tsx';
import { BackgroundDemo } from '../demos/demo-bg-background.tsx';
import { CookbookDemo } from '../demos/demo-code-cookbook.tsx';

/** A single showcase entry surfaced in the sidebar and routed by `slug`. */
export interface DemoEntry {
  /** URL slug, e.g. `i-dashboard`. */
  readonly slug: string;
  /** Short letter tag shown in the sidebar (matches the agreed a–k naming). */
  readonly tag: string;
  /** Human title. */
  readonly title: string;
  /** One-line description of what the demo shows. */
  readonly tagline: string;
  /** Whether the demo is implemented yet (planned ones render a placeholder). */
  readonly ready: boolean;
  /** The React component that renders the demo, when ready. */
  readonly Component?: ComponentType;
}

/**
 * The ordered list of demos. The sidebar and the router are both driven from
 * this single source of truth, so adding a demo is a one-line change here.
 */
export const DEMOS: readonly DemoEntry[] = [
  {
    slug: 'code-cookbook',
    tag: '{}',
    title: 'Code cookbook',
    tagline: 'Minimal, copy-paste snippets for every core pattern.',
    ready: true,
    Component: CookbookDemo,
  },
  {
    slug: 'i-dashboard',
    tag: 'i',
    title: 'Live telemetry dashboard',
    tagline: 'Rich HTML cards with live metrics, status colors, and animated flow links.',
    ready: true,
    Component: DashboardDemo,
  },
  {
    slug: 'k-scale',
    tag: 'k',
    title: 'Scale test',
    tagline: 'Generate up to 200k shapes; only the viewport is rendered.',
    ready: true,
    Component: ScaleDemo,
  },
  {
    slug: 'b-selection',
    tag: 'b',
    title: 'Click to select',
    tagline: 'Single selection across elements and links, with a highlighted border.',
    ready: true,
    Component: SelectionDemo,
  },
  {
    slug: 'g-events',
    tag: 'g',
    title: 'Event inspector',
    tagline: 'A live log of diagram events with on-canvas indication.',
    ready: true,
    Component: EventsDemo,
  },
  {
    slug: 'h-zoom-to',
    tag: 'h',
    title: 'Programmatic zoom',
    tagline: 'Zoom in/out, reset, fit-to-content, and zoom-to-selected via buttons.',
    ready: true,
    Component: ZoomToDemo,
  },
  {
    slug: 'a-blinking',
    tag: 'a',
    title: 'Blinking alert shape',
    tagline: 'A specific shape pulses red to draw attention (motion-safe).',
    ready: true,
    Component: BlinkingDemo,
  },
  {
    slug: 'c-context-menu',
    tag: 'c',
    title: 'React context menu',
    tagline: 'Right-click a shape for a custom React menu, viewport-aware.',
    ready: true,
    Component: ContextMenuDemo,
  },
  {
    slug: 'd-code-select',
    tag: 'd',
    title: 'Select from code',
    tagline: 'Pick a shape by id from an input + button; shares selection with demo b.',
    ready: true,
    Component: CodeSelectDemo,
  },
  {
    slug: 'e-add-remove',
    tag: 'e',
    title: 'Add & remove shapes',
    tagline: 'Mutate the graph incrementally without redrawing everything.',
    ready: true,
    Component: AddRemoveDemo,
  },
  {
    slug: 'f-datasets',
    tag: 'f',
    title: 'Switch datasets',
    tagline: 'Each button loads a different data set and refits the view.',
    ready: true,
    Component: DatasetsDemo,
  },
  {
    slug: 'j-editor',
    tag: 'j',
    title: 'Interactive editor',
    tagline: 'Drag-to-connect ports, inline rename, and undo/redo.',
    ready: true,
    Component: EditorDemo,
  },
  {
    slug: 'bg-background',
    tag: 'bg',
    title: 'Background image',
    tagline: 'A map-style image underlay that stays aligned under zoom/pan.',
    ready: true,
    Component: BackgroundDemo,
  },
];

/** Look up a demo by its slug. */
export function findDemo(slug: string | undefined): DemoEntry | undefined {
  return DEMOS.find((demo) => demo.slug === slug);
}

/** The slug shown by default (the featured live demo, not the cookbook). */
export const DEFAULT_DEMO_SLUG = 'i-dashboard';
