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

import { FlowBlinkingDemo } from '../reactflow/flow-a-blinking.tsx';
import { FlowSelectionDemo } from '../reactflow/flow-b-selection.tsx';
import { FlowContextMenuDemo } from '../reactflow/flow-c-context-menu.tsx';
import { FlowCodeSelectDemo } from '../reactflow/flow-d-code-select.tsx';
import { FlowAddRemoveDemo } from '../reactflow/flow-e-add-remove.tsx';
import { FlowDatasetsDemo } from '../reactflow/flow-f-datasets.tsx';
import { FlowEventsDemo } from '../reactflow/flow-g-events.tsx';
import { FlowZoomToDemo } from '../reactflow/flow-h-zoom-to.tsx';
import { FlowDashboardDemo } from '../reactflow/flow-i-dashboard.tsx';
import { FlowEditorDemo } from '../reactflow/flow-j-editor.tsx';
import { FlowScaleDemo } from '../reactflow/flow-k-scale.tsx';
import { FlowBackgroundDemo } from '../reactflow/flow-bg-background.tsx';
import { FlowCookbookDemo } from '../reactflow/flow-code-cookbook.tsx';

import { GoBlinkingDemo } from '../gojs/go-a-blinking.tsx';
import { GoSelectionDemo } from '../gojs/go-b-selection.tsx';
import { GoContextMenuDemo } from '../gojs/go-c-context-menu.tsx';
import { GoCodeSelectDemo } from '../gojs/go-d-code-select.tsx';
import { GoAddRemoveDemo } from '../gojs/go-e-add-remove.tsx';
import { GoDatasetsDemo } from '../gojs/go-f-datasets.tsx';
import { GoEventsDemo } from '../gojs/go-g-events.tsx';
import { GoZoomToDemo } from '../gojs/go-h-zoom-to.tsx';
import { GoDashboardDemo } from '../gojs/go-i-dashboard.tsx';
import { GoEditorDemo } from '../gojs/go-j-editor.tsx';
import { GoScaleDemo } from '../gojs/go-k-scale.tsx';
import { GoBackgroundDemo } from '../gojs/go-bg-background.tsx';
import { GoCookbookDemo } from '../gojs/go-code-cookbook.tsx';

/** The three diagramming libraries the showcase compares, one per tab. */
export type LibraryId = 'joint' | 'reactflow' | 'gojs';

/** A single showcase entry surfaced in the sidebar and routed by `slug`. */
export interface DemoEntry {
  /** URL slug, e.g. `i-dashboard`. */
  readonly slug: string;
  /** Short tag shown in the sidebar (matches the agreed a–k naming). */
  readonly tag: string;
  /** Human title. */
  readonly title: string;
  /** One-line description of what the demo shows. */
  readonly tagline: string;
  /** Whether the demo is implemented for the current library. */
  readonly ready: boolean;
  /** The React component that renders the demo, when ready. */
  readonly Component?: ComponentType;
  /** Render inside a vertically scrollable body (for text/code pages, not canvases). */
  readonly scroll?: boolean;
}

/** Shared per-demo metadata — identical across both libraries, so the tabs mirror. */
interface DemoMeta {
  readonly slug: string;
  readonly tag: string;
  readonly title: string;
  readonly tagline: string;
  readonly scroll?: boolean;
}

/**
 * The ordered demo list (metadata only). The JointJS, React Flow and GoJS tabs
 * are built from this single source of truth, guaranteeing they stay in lockstep.
 */
const DEMO_META: readonly DemoMeta[] = [
  { slug: 'code-cookbook', tag: '{}', title: 'Code cookbook', tagline: 'Minimal, copy-paste snippets for every core pattern.', scroll: true },
  { slug: 'i-dashboard', tag: 'i', title: 'Live telemetry dashboard', tagline: 'Rich HTML cards with live metrics, status colors, and animated flow links.' },
  { slug: 'k-scale', tag: 'k', title: 'Scale test', tagline: 'Generate many shapes; only the viewport is rendered.' },
  { slug: 'b-selection', tag: 'b', title: 'Click to select', tagline: 'Single selection across nodes and links, with a highlighted border.' },
  { slug: 'g-events', tag: 'g', title: 'Event inspector', tagline: 'A live log of diagram events with on-canvas indication.' },
  { slug: 'h-zoom-to', tag: 'h', title: 'Programmatic zoom', tagline: 'Zoom in/out, reset, fit-to-content, and zoom-to-selected via buttons.' },
  { slug: 'a-blinking', tag: 'a', title: 'Blinking alert shape', tagline: 'A specific shape pulses red to draw attention (motion-safe).' },
  { slug: 'c-context-menu', tag: 'c', title: 'React context menu', tagline: 'Right-click a shape for a custom React menu, viewport-aware.' },
  { slug: 'd-code-select', tag: 'd', title: 'Select from code', tagline: 'Pick a shape by id or label from an input + button.' },
  { slug: 'e-add-remove', tag: 'e', title: 'Add & remove shapes', tagline: 'Mutate the graph incrementally without redrawing everything.' },
  { slug: 'f-datasets', tag: 'f', title: 'Switch datasets', tagline: 'Each button loads a different data set and refits the view.' },
  { slug: 'j-editor', tag: 'j', title: 'Interactive editor', tagline: 'Drag to connect, rename inline, and undo/redo.' },
  { slug: 'bg-background', tag: 'bg', title: 'Background image', tagline: 'A map-style image underlay that stays aligned under zoom/pan.' },
];

/** Map each slug to the component that renders it for a given library. */
const JOINT_COMPONENTS: Record<string, ComponentType> = {
  'code-cookbook': CookbookDemo,
  'i-dashboard': DashboardDemo,
  'k-scale': ScaleDemo,
  'b-selection': SelectionDemo,
  'g-events': EventsDemo,
  'h-zoom-to': ZoomToDemo,
  'a-blinking': BlinkingDemo,
  'c-context-menu': ContextMenuDemo,
  'd-code-select': CodeSelectDemo,
  'e-add-remove': AddRemoveDemo,
  'f-datasets': DatasetsDemo,
  'j-editor': EditorDemo,
  'bg-background': BackgroundDemo,
};

const REACTFLOW_COMPONENTS: Record<string, ComponentType> = {
  'code-cookbook': FlowCookbookDemo,
  'i-dashboard': FlowDashboardDemo,
  'k-scale': FlowScaleDemo,
  'b-selection': FlowSelectionDemo,
  'g-events': FlowEventsDemo,
  'h-zoom-to': FlowZoomToDemo,
  'a-blinking': FlowBlinkingDemo,
  'c-context-menu': FlowContextMenuDemo,
  'd-code-select': FlowCodeSelectDemo,
  'e-add-remove': FlowAddRemoveDemo,
  'f-datasets': FlowDatasetsDemo,
  'j-editor': FlowEditorDemo,
  'bg-background': FlowBackgroundDemo,
};

const GOJS_COMPONENTS: Record<string, ComponentType> = {
  'code-cookbook': GoCookbookDemo,
  'i-dashboard': GoDashboardDemo,
  'k-scale': GoScaleDemo,
  'b-selection': GoSelectionDemo,
  'g-events': GoEventsDemo,
  'h-zoom-to': GoZoomToDemo,
  'a-blinking': GoBlinkingDemo,
  'c-context-menu': GoContextMenuDemo,
  'd-code-select': GoCodeSelectDemo,
  'e-add-remove': GoAddRemoveDemo,
  'f-datasets': GoDatasetsDemo,
  'j-editor': GoEditorDemo,
  'bg-background': GoBackgroundDemo,
};

/** Attach a library's components to the shared metadata to build its demo list. */
function buildDemos(components: Record<string, ComponentType>): readonly DemoEntry[] {
  return DEMO_META.map((meta) => ({
    ...meta,
    ready: components[meta.slug] !== undefined,
    Component: components[meta.slug],
  }));
}

/** A diagramming library tab: its demos plus how it is labelled and routed. */
export interface Library {
  readonly id: LibraryId;
  /** Tab label. */
  readonly label: string;
  /** One-line note under the brand. */
  readonly blurb: string;
  /** Slug opened when the tab is first selected. */
  readonly defaultSlug: string;
  readonly demos: readonly DemoEntry[];
}

export const LIBRARIES: readonly Library[] = [
  { id: 'joint', label: 'JointJS', blurb: 'Interactive showcase · free @joint/react stack', defaultSlug: 'i-dashboard', demos: buildDemos(JOINT_COMPONENTS) },
  { id: 'reactflow', label: 'React Flow', blurb: 'The same demos, rebuilt on @xyflow/react', defaultSlug: 'i-dashboard', demos: buildDemos(REACTFLOW_COMPONENTS) },
  { id: 'gojs', label: 'GoJS', blurb: 'The same demos on gojs — canvas-rendered, commercial (evaluation build)', defaultSlug: 'i-dashboard', demos: buildDemos(GOJS_COMPONENTS) },
];

/** The library shown when no tab is specified. */
export const DEFAULT_LIBRARY_ID: LibraryId = 'joint';

/** Look up a library by its id. */
export function findLibrary(id: string | undefined): Library | undefined {
  return LIBRARIES.find((library) => library.id === id);
}

/** Look up a demo within a library by slug. */
export function findDemo(libraryId: string | undefined, slug: string | undefined): DemoEntry | undefined {
  return findLibrary(libraryId)?.demos.find((demo) => demo.slug === slug);
}

/** Build the route for a demo, e.g. `/joint/demo/i-dashboard`. */
export function demoPath(libraryId: LibraryId, slug: string): string {
  return `/${libraryId}/demo/${slug}`;
}

/** The route shown by default (the featured JointJS live demo). */
export const DEFAULT_DEMO_PATH = demoPath(DEFAULT_LIBRARY_ID, 'i-dashboard');
