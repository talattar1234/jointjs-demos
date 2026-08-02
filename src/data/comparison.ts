/**
 * The library comparison shown by the "Compare libraries" dialog.
 *
 * Shared data, like every other module in `src/data` — the dialog only renders it.
 * Cell text is deliberately grounded in what this repo actually demonstrates (the
 * demo letters are referenced where a demo proves the point), and the bundle-size
 * row holds measured numbers rather than estimates.
 */

/** The three libraries the showcase compares. Mirrors `LibraryId` in the registry. */
export type CompareLibraryId = 'joint' | 'reactflow' | 'gojs';

/** Column header: the library, its package(s), and how it is licensed. */
export interface ComparisonColumn {
  readonly id: CompareLibraryId;
  readonly label: string;
  /** Package + version, shown under the label. */
  readonly packages: string;
  /** Short license/cost note. */
  readonly cost: string;
}

/** One scored row of the comparison table. */
export interface ComparisonRow {
  /** Stable React key. */
  readonly id: string;
  /** The axis being compared. */
  readonly category: string;
  /** What the axis means in practice, in one short line. */
  readonly detail: string;
  /** Importance weight (1–3). The winner of the row takes these points. */
  readonly weight: number;
  /** The verdict for each library. */
  readonly cells: Readonly<Record<CompareLibraryId, string>>;
  /** Winner(s) of the row. More than one entry is a tie and splits the points. */
  readonly winners: readonly CompareLibraryId[];
}

/** Weight scale used by every row, so the table can explain itself. */
export const WEIGHT_LABELS: Readonly<Record<number, string>> = {
  1: 'nice to have',
  2: 'important',
  3: 'decisive',
};

export const COMPARISON_COLUMNS: readonly ComparisonColumn[] = [
  {
    id: 'joint',
    label: 'JointJS',
    packages: '@joint/react 4.3 + @joint/core 4.3',
    cost: 'Free · MPL-2.0 (free stack only, no @joint/plus)',
  },
  {
    id: 'reactflow',
    label: 'React Flow',
    packages: '@xyflow/react 12.11',
    cost: 'Free · MIT (Pro subscription optional)',
  },
  {
    id: 'gojs',
    label: 'GoJS',
    packages: 'gojs 4.0',
    cost: 'Commercial · per-developer seat, watermarked here',
  },
];

export const COMPARISON_ROWS: readonly ComparisonRow[] = [
  {
    id: 'license',
    category: 'License & cost',
    detail: 'What it costs to ship this in a product.',
    weight: 3,
    cells: {
      joint: 'Free and open (MPL-2.0). Only the @joint/plus widgets cost money — this app avoids them entirely.',
      reactflow: 'Free and open (MIT). The Pro subscription buys support and extra examples, not features.',
      gojs: 'Commercial only, licensed per developer. With no key set it runs in evaluation mode and watermarks the canvas.',
    },
    winners: ['joint', 'reactflow'],
  },
  {
    id: 'react',
    category: 'React integration',
    detail: 'How naturally it lives inside a React app.',
    weight: 3,
    cells: {
      joint: 'Genuinely declarative: cells are records, <Paper renderElement> renders them, and hooks (useGraph, useCell) mutate them.',
      reactflow: 'React all the way down — nodes are your components, the graph is your own useNodesState/useEdgesState arrays.',
      gojs: 'Framework-agnostic and imperative. React only mounts the diagram; templates are go.Shape trees built in JS, not JSX.',
    },
    winners: ['reactflow'],
  },
  {
    id: 'customization',
    category: 'Node look & customization',
    detail: 'How far you can push what a node looks like.',
    weight: 3,
    cells: {
      joint: 'Most range: raw SVG for cheap nodes, or HTMLBox (foreignObject) for full HTML — CSS tokens, classes, :hover, any React inside.',
      reactflow: 'Least friction: nodes are plain DOM, so the .flow-node CSS is shared verbatim with the JointJS tab.',
      gojs: 'No CSS reaches a shape — a canvas has no cascade. Every visual is rebuilt from Shape/TextBlock/Panel and themed in go-theme.ts.',
    },
    winners: ['joint', 'reactflow'],
  },
  {
    id: 'editing',
    category: 'Built-in editing',
    detail: 'Drag-to-connect, inline rename, resize, rotate, undo/redo.',
    weight: 3,
    cells: {
      joint: 'None in the free stack — demo j hand-rolls linking, renaming, resize/rotate and a snapshot-based undo stack.',
      reactflow: 'Connect-by-handle and node dragging are free; renaming, NodeResizer wiring, rotation and history are still yours to build.',
      gojs: 'LinkingTool, TextEditingTool, ResizingTool, RotatingTool and a real UndoManager all ship in the box.',
    },
    winners: ['gojs'],
  },
  {
    id: 'scale',
    category: 'Performance at scale',
    detail: 'Thousands of nodes, still interactive.',
    weight: 3,
    cells: {
      joint: 'SVG means one DOM subtree per cell; it stays usable into the thousands only via the cellVisibility culling demo k applies.',
      reactflow: 'The heaviest per element (full DOM nodes). onlyRenderVisibleElements is less an optimisation than a requirement.',
      gojs: 'One canvas, painting only the viewport. Thousands of nodes stay smooth — the ceiling is model build time, not render time.',
    },
    winners: ['gojs'],
  },
  {
    id: 'shapes',
    category: 'Shape bank & drag-to-canvas',
    detail: 'A palette of ready shapes you can drag onto the diagram.',
    weight: 2,
    cells: {
      joint: 'About 18 standard.* shapes. A stencil/palette is a @joint/plus widget, so on the free stack you build it yourself.',
      reactflow: 'No shape library at all — you author every node type. Drag-from-sidebar is a documented recipe, not a component.',
      gojs: 'Dozens of built-in figures (many more via the Figures.js extension) plus a real go.Palette with drag-between-diagrams.',
    },
    winners: ['gojs'],
  },
  {
    id: 'layout',
    category: 'Automatic layout',
    detail: 'Arranging a graph you did not position by hand.',
    weight: 2,
    cells: {
      joint: 'Not in the free stack: bring dagre or elkjs (the DirectedGraph layout is a @joint/plus feature).',
      reactflow: 'Nothing built in; the official guidance is to add dagre or elkjs yourself.',
      gojs: 'TreeLayout, LayeredDigraphLayout, ForceDirectedLayout and CircularLayout included, incremental and configurable.',
    },
    winners: ['gojs'],
  },
  {
    id: 'links',
    category: 'Links, routing & ports',
    detail: 'How well connections behave without babysitting.',
    weight: 2,
    cells: {
      joint: 'The richest link model of the three, free: manhattan/orthogonal/metro routers, connectors, labels, ports and vertices.',
      reactflow: 'bezier/step/smoothstep only, with no obstacle avoidance — the floating edges here are hand-computed in flow-edges.tsx.',
      gojs: 'Orthogonal and AvoidsNodes routing, link labels and Spot.AllSides ports; strong, with less router variety than JointJS.',
    },
    winners: ['joint'],
  },
  {
    id: 'chrome',
    category: 'Viewport extras included',
    detail: 'Zoom, pan, fit, minimap, rubber-band selection.',
    weight: 2,
    cells: {
      joint: 'None on the free stack: useZoomPan, SelectionLayer and the zoom toolbar in this repo are all hand-written.',
      reactflow: 'First-class: <Controls>, <MiniMap>, <Background>, fitView, box selection — zoom/pan is the library’s job, not yours.',
      gojs: 'CommandHandler zoom/fit commands, a go.Overview minimap, rubber-band selection and undo, all built in.',
    },
    winners: ['reactflow', 'gojs'],
  },
  {
    id: 'debug',
    category: 'Debuggability & a11y',
    detail: 'Can you inspect it, select text, reach it with a screen reader?',
    weight: 2,
    cells: {
      joint: 'Nodes are real SVG/DOM: devtools inspection, selectable text, CSS overrides and reachable markup.',
      reactflow: 'Same DOM advantage, and the most ordinary React tree of the three to step through.',
      gojs: 'One opaque <canvas>: nothing to inspect, no text selection, and accessibility is entirely on you.',
    },
    winners: ['joint', 'reactflow'],
  },
  {
    id: 'animation',
    category: 'Animation & live data',
    detail: 'Pulsing alerts, flowing links, ticking metrics.',
    weight: 2,
    cells: {
      joint: 'CSS keyframes and transitions inside HTML nodes; prefers-reduced-motion comes free with the media query (demos a, i).',
      reactflow: 'Plain CSS plus React re-renders. There is nothing library-specific to learn.',
      gojs: 'go.Animation only — no keyframes — and reduced motion needs an explicit matchMedia check in both demos a and i.',
    },
    winners: ['joint', 'reactflow'],
  },
  {
    id: 'learning',
    category: 'Learning curve',
    detail: 'Time from install to a diagram you are happy with.',
    weight: 2,
    cells: {
      joint: 'Two layers to learn: the React bindings, plus @joint/core concepts reached through the options escape hatch.',
      reactflow: 'The shallowest of the three — if you know React, you already mostly know React Flow.',
      gojs: 'The steepest: its own Binding/Panel/Tool/Template vocabulary, and none of it resembles React.',
    },
    winners: ['reactflow'],
  },
  {
    id: 'bundle',
    category: 'Bundle size (measured)',
    detail: 'Minified / gzipped weight of the library itself.',
    weight: 2,
    cells: {
      joint: '@joint/core is 471 KB min / 140 KB gzip, plus a thin @joint/react wrapper on top.',
      reactflow: '192 KB min / 61 KB gzip including its d3 and zustand dependencies — the lightest by a wide margin.',
      gojs: '996 KB min / 269 KB gzip. On its own it roughly doubles this app’s built JS.',
    },
    winners: ['reactflow'],
  },
  {
    id: 'docs',
    category: 'Docs, samples & support',
    detail: 'How fast you get unstuck.',
    weight: 2,
    cells: {
      joint: 'Solid API docs, but many of the best tutorials and demos assume the paid @joint/plus packages.',
      reactflow: 'Excellent docs and by far the largest community, so most questions are already answered somewhere.',
      gojs: 'The biggest sample gallery of the three, exhaustive API docs, and responsive paid support from Northwoods.',
    },
    winners: ['reactflow', 'gojs'],
  },
  {
    id: 'export',
    category: 'Export to image / print',
    detail: 'Getting a PNG or SVG of the diagram out.',
    weight: 1,
    cells: {
      joint: 'Manual on the free stack — SVG export is a @joint/plus feature, so you serialize and render it yourself.',
      reactflow: 'Not included; the documented answer is the third-party html-to-image.',
      gojs: 'makeImageData, makeSvg and print support are part of the library.',
    },
    winners: ['gojs'],
  },
  {
    id: 'types',
    category: 'TypeScript quality',
    detail: 'How much the compiler actually helps.',
    weight: 1,
    cells: {
      joint: '@joint/react is well typed; @joint/core is loose in places, which is why this repo narrows unknown at those seams.',
      reactflow: 'Fully typed and generic over your own node and edge data.',
      gojs: 'A thorough hand-written go.d.ts (1.6 MB of declarations) covering the entire API.',
    },
    winners: ['reactflow', 'gojs'],
  },
  {
    id: 'persist',
    category: 'Save & load',
    detail: 'Round-tripping a diagram to JSON.',
    weight: 1,
    cells: {
      joint: 'exportToJSON / importFromJSON on the graph — demo j’s undo history is built directly on it.',
      reactflow: 'You already own the nodes/edges arrays, so JSON.stringify is the whole story.',
      gojs: 'model.toJson / Model.fromJson, with the undo manager aware of the round trip.',
    },
    winners: ['joint', 'reactflow', 'gojs'],
  },
];

/** A library's weighted score across every row. */
export interface ComparisonScore {
  readonly id: CompareLibraryId;
  /** Weighted points won. Ties split a row's weight between its winners. */
  readonly points: number;
  /** How many rows the library won outright (no tie). */
  readonly outrightWins: number;
}

/** Points a library takes from one row; a tie splits the row's weight evenly. */
export function rowPoints(row: ComparisonRow, id: CompareLibraryId): number {
  return row.winners.includes(id) ? row.weight / row.winners.length : 0;
}

/** The sum of every row weight — the maximum any one library could score. */
export const COMPARISON_MAX_POINTS: number = COMPARISON_ROWS.reduce((sum, row) => sum + row.weight, 0);

/** Final weighted scores, highest first. Static data, so this is computed once. */
export const COMPARISON_SCORES: readonly ComparisonScore[] = [
  ...COMPARISON_COLUMNS.map((column) => ({
    id: column.id,
    points: COMPARISON_ROWS.reduce((sum, row) => sum + rowPoints(row, column.id), 0),
    outrightWins: COMPARISON_ROWS.filter((row) => row.winners.length === 1 && row.winners[0] === column.id).length,
  })),
].sort((a, b) => b.points - a.points);

/** Look up a library's score. */
export function findScore(id: CompareLibraryId): ComparisonScore | undefined {
  return COMPARISON_SCORES.find((score) => score.id === id);
}

/** Format points for display: `7.3`, but `7` when it lands on a whole number. */
export function formatPoints(points: number): string {
  return Number.isInteger(points) ? String(points) : points.toFixed(1);
}

/** The closing "pick this one if…" note per library. */
export const COMPARISON_VERDICTS: Readonly<Record<CompareLibraryId, string>> = {
  joint: 'Pick JointJS when the diagram itself is the product: bespoke node visuals, serious link routing and ports, and no per-seat licence — accepting that editing tools, layout and a stencil are yours to build (or a @joint/plus purchase away).',
  reactflow:
    'Pick React Flow when you want a node-based UI shipped this week: smallest bundle, shallowest learning curve, ordinary React nodes — accepting that routing, layout, history and scale are all things you bolt on.',
  gojs: 'Pick GoJS when you need a real diagram editor at thousands of nodes: linking, in-place editing, undo, layouts, palette and export are already done — accepting a commercial licence, a 269 KB gzip payload, and that no CSS reaches your shapes.',
};

/** Honest caveat about the scoring, shown under the table. */
export const COMPARISON_CAVEAT =
  'Weights are a judgement call, not a benchmark: every row counts 1–3 points and ties split them. The JointJS column is scored on the free stack only (this app’s rule) — with @joint/plus it would take the editing, shape-bank, layout and export rows, which is most of GoJS’s lead. Bundle sizes are measured from the installed packages; everything else reflects building these same 13 demos three times.';
