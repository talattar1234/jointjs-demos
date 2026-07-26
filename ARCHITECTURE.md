# Architecture

## What this is

A side-by-side showcase of **two** React diagramming libraries. The **same demo
list** is implemented twice — once on the free **JointJS** React stack and once
on **React Flow** — and each library is a tab. Picking a tab swaps the whole demo
set; the sidebar, routes, styling, and underlying sample data stay shared, so the
two tabs are true apples-to-apples comparisons.

## Stack

- **Vite** + **React 19** + **TypeScript** (strict).
- **`@joint/react`** (React bindings) on top of **`@joint/core`** (engine) — the
  JointJS tab.
- **`@xyflow/react`** (React Flow) — the React Flow tab.
- **`react-router-dom`** for per-library, per-demo routes (`/:lib/demo/:slug`).
- No global state library — React state + small contexts are enough.

## Folder structure

```
src/
  main.tsx                 App entry: providers + router
  App.tsx                  Routes (library tabs under AppShell, legacy redirects)
  index.css                Design tokens + all component styles (shared by both tabs)
  app/
    theme.tsx              Light/dark theme context (data-theme on <html>)
    app-shell.tsx          Library tabs + sidebar nav + routed <Outlet>
    demo-page.tsx          Resolves :lib + :slug → demo component
    demo-registry.tsx      SINGLE source of truth: demo metadata + both libraries
  components/              Shared JointJS-side building blocks
    diagram-canvas.tsx     Shared <Paper> wrapper (zoom, pan, fit, controls)
    zoom-controls.tsx      Floating zoom toolbar
    context-menu.tsx       Viewport-clamped React context menu
    event-log.tsx          Event-log side panel (presentational)
    flow-node.tsx          Shared HTML element renderer (JointJS)
    cookbook.tsx           Code-cookbook page scaffold
  hooks/
    use-zoom-pan.ts        Controlled zoom/pan + ZoomPanContext (JointJS)
    use-selection.tsx      SelectionProvider + SelectionLayer (JointJS)
    use-event-log.tsx      Bounded event log state (shared by both tabs)
  data/                    Sample data — SHARED across both libraries
    sample-graph.ts        Shared flow graph + FlowNodeData
    dashboard.ts           Demo i data + telemetry tick
    datasets.ts            Demo f datasets
    scale.ts               Demo k generator
  demos/
    demo-*.tsx             JointJS demos — one module per demo
  reactflow/               React Flow tab — mirrors src/demos + its own shared blocks
    flow-*.tsx             React Flow demos — one module per demo (flow-a … flow-k)
    flow-canvas.tsx        Shared <ReactFlow> wrapper (the FlowCanvas)
    flow-nodes.tsx         Shared node renderers + node-type maps
    flow-edges.tsx         Floating-edge renderer + edge-type map
    adapt.ts               Convert shared JointJS cell data → React Flow nodes/edges
```

## Two-library registry

`src/app/demo-registry.tsx` is the one source of truth for both tabs:

1. **`DEMO_META`** — the ordered list of demos as pure metadata (`slug`, `tag`,
   `title`, `tagline`, `scroll?`). No components. This guarantees both tabs expose
   the same demos, in the same order, with identical copy.
2. **`JOINT_COMPONENTS`** / **`REACTFLOW_COMPONENTS`** — maps from `slug` to the
   component that renders that demo for each library.
3. **`buildDemos(components)`** — joins the shared metadata with a library's
   component map, marking each entry `ready` when a component exists.
4. **`LIBRARIES`** — the two `Library` tabs (`joint`, `reactflow`), each with a
   label, blurb, `defaultSlug`, and its built demo list.

Helpers (`findLibrary`, `findDemo`, `demoPath`) resolve routes and lookups.

## Routing

`App.tsx` nests everything under `/:lib`:

- `/:lib/demo/:slug` → `DemoPage` (inside `AppShell`).
- `/:lib` alone → redirect to that library's `defaultSlug`.
- Legacy `/demo/:slug` → redirect to the JointJS equivalent, so old links survive.
- Anything unknown → `DEFAULT_DEMO_PATH` (the featured JointJS dashboard).

`AppShell` renders the library tabs (a `role="tablist"` of `<Link>`s) above the
sidebar demo nav; switching tabs re-links to the same `slug` under the other `lib`.

## Core model: declarative cells (JointJS)

`@joint/react` is declarative. A graph is an array of **cell records**:

```ts
// element
{ id, type: 'element', position: {x,y}, size: {w,h}, data: {...} }
// link
{ id, type: 'link', source: {id}, target: {id}, style?: {...}, labelMap?: {...} }
```

Seed them once with `<GraphProvider initialCells={...}>`, or drive imperatively
with `useGraph()` (`setCell`, `setCellData`, `removeCell(s)`, `resetCells`,
`importFromJSON`, `exportToJSON`, `transaction`). React reconciles views, so
adding/removing a cell never redraws the rest (demo e).

`<Paper renderElement={fn}>` renders each element from its `data` slice:
- **HTML** content → wrap in `<HTMLBox>` (foreignObject portal). Used by the
  dashboard (i) and flow nodes.
- **SVG** content → return `<rect>`/`<g>` directly. Used by the scale test (k,
  cheapest) and the editor (j, needs SVG magnets).

## The React Flow tab

The React Flow demos consume the **same** `src/data` modules, converting the
shared JointJS cell arrays into React Flow `nodes`/`edges` so both tabs draw the
same graph from one dataset:

- **`adapt.ts` → `cellsToFlow(cells, nodeType)`** — narrows the loosely-typed
  JointJS `CellRecord` union and maps element records to nodes (carrying size on
  `style`) and link records to floating edges (reading the label from
  `labelMap.main.text`). It also exports the shared `EDGE_COLOR` / `ARROW_MARKER`
  / `EDGE_DEFAULTS` so edges match the JointJS side.
- **`FlowCanvas`** (`flow-canvas.tsx`) — the React Flow analogue of
  `DiagramCanvas`. A themed `<ReactFlow>` inside the shared `.canvas` chrome, with
  dotted `Background`, `Controls`, optional `MiniMap`, `fitView`, and the floating
  edge type pre-registered. Generic over node/edge types; extra `<ReactFlow>` props
  pass through. Zoom/pan/fit are handled by React Flow itself (not the hand-rolled
  `useZoomPan`).
- **`flow-nodes.tsx`** — `FlowNodeView` reuses the exact `.flow-node` CSS from the
  JointJS side (those classes aren't JointJS-scoped), so both tabs look identical;
  `ScaleNodeView` is the cheapest markup for the scale test. Node-type maps are
  module constants for stable identity. Edges are floating, so nodes need no
  handles.
- **`flow-edges.tsx`** — `FloatingEdge` draws a boundary-to-boundary bezier
  (endpoints computed from node-center intersections) with an optional centered
  HTML label via `EdgeLabelRenderer`. This mirrors the tidy links the JointJS
  orthogonal router gives for free. Registered as the `floating` edge type.

## Shared building blocks (JointJS)

- **`DiagramCanvas`** — the one wrapper every JointJS demo mounts inside its
  `GraphProvider`. Owns mouse-wheel zoom, drag-to-pan on blank space, fit-on-mount,
  the floating zoom toolbar, and exposes the zoom API to overlay children via
  `ZoomPanContext`. Props: `renderElement`, `renderLink`, `paperProps`,
  `selectedId` (adds a zoom-to-selected button), `fitSignal` (bump to refit),
  `fitOnMount`.
- **Zoom/pan** (`useZoomPan`) — the viewport transform lives in React state
  (`{scale, tx, ty}`) and is fed to `<Paper transform="translate(..px,..px) scale(..)">`.
  Single source of truth, so wheel/drag/programmatic controls never disagree.
  `fitContent` uses `paper.getContentArea()`; `zoomToElement` uses the element bbox.
- **Selection** (`useSelection` + `SelectionLayer`) — one `selectedId` in context
  (elements and links). `SelectionLayer` toggles an `is-selected` class on the
  cell view, so selection is styled in pure CSS. Click (b) and code (d) write the
  same state.
- **Event log** (`useEventLog`) — bounded, newest-first list, shared by both tabs.
  Demo g wires the full event surface, throttling high-frequency events.

## Virtualization (demo k)

**JointJS:** large graphs stay usable via the `cellVisibility` predicate: only
cells whose bbox intersects the (inflated) viewport are mounted as React views.
The graph holds all N models; the DOM holds a few hundred. Fully fitting a huge
graph is the only heavy case (it forces everything to render), so auto-fit is
gated by size. **React Flow** virtualizes on its own via `onlyRenderVisibleElements`.

## Theming

CSS custom properties in `index.css`, switched via `data-theme` on `<html>`
(`ThemeProvider`); both tabs share the same tokens and component styles. React
Flow follows the theme through its `colorMode` prop. SVG stroke colors use
concrete hex values — SVG presentation attributes don't resolve `var()`.

## Constraints

Free stack only. No `@joint/plus`. On the JointJS side, zoom/pan, selection,
minimaps, and undo/redo are hand-rolled rather than using plus widgets. React Flow
provides those out of the box, which is part of what the comparison surfaces.
