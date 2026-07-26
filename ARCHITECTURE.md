# Architecture

## What this is

A side-by-side showcase of **three** React diagramming libraries. The **same demo
list** is implemented three times — on the free **JointJS** React stack, on
**React Flow**, and on **GoJS** — and each library is a tab. Picking a tab swaps
the whole demo set; the sidebar, routes, styling, and underlying sample data stay
shared, so the tabs are true apples-to-apples comparisons.

The three libraries deliberately span two rendering substrates: JointJS and React
Flow both render **DOM/SVG** and share the app's CSS, while GoJS renders to a
**`<canvas>`**. That split is the most interesting thing the comparison surfaces —
see [The GoJS tab](#the-gojs-tab).

## Stack

- **Vite** + **React 19** + **TypeScript** (strict).
- **`@joint/react`** (React bindings) on top of **`@joint/core`** (engine) — the
  JointJS tab.
- **`@xyflow/react`** (React Flow) — the React Flow tab.
- **`gojs`** — the GoJS tab. Commercial; no license key is configured, so it runs
  in evaluation mode and paints a watermark over the canvas.
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
    demo-registry.tsx      SINGLE source of truth: demo metadata + all libraries
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
  gojs/                    GoJS tab — same demo set, canvas-rendered
    go-*.tsx               GoJS demos — one module per demo (go-a … go-k)
    go-canvas.tsx          Shared go.Diagram wrapper (the GoCanvas) + zoom/overview
    go-templates.ts        Shared node/link templates (Shapes, not React components)
    go-theme.ts            The design tokens restated as GoJS themes
    adapt.ts               Convert shared JointJS cell data → GoJS model arrays
```

## Three-library registry

`src/app/demo-registry.tsx` is the one source of truth for every tab:

1. **`DEMO_META`** — the ordered list of demos as pure metadata (`slug`, `tag`,
   `title`, `tagline`, `scroll?`). No components. This guarantees every tab exposes
   the same demos, in the same order, with identical copy.
2. **`JOINT_COMPONENTS`** / **`REACTFLOW_COMPONENTS`** / **`GOJS_COMPONENTS`** —
   maps from `slug` to the component that renders that demo for each library.
3. **`buildDemos(components)`** — joins the shared metadata with a library's
   component map, marking each entry `ready` when a component exists.
4. **`LIBRARIES`** — the three `Library` tabs (`joint`, `reactflow`, `gojs`), each
   with a label, blurb, `defaultSlug`, and its built demo list.

Helpers (`findLibrary`, `findDemo`, `demoPath`) resolve routes and lookups.

## Routing

`App.tsx` nests everything under `/:lib` (`joint`, `reactflow`, `gojs`):

- `/:lib/demo/:slug` → `DemoPage` (inside `AppShell`).
- `/:lib` alone → redirect to that library's `defaultSlug`.
- Legacy `/demo/:slug` → redirect to the JointJS equivalent, so old links survive.
- Anything unknown → `DEFAULT_DEMO_PATH` (the featured JointJS dashboard).

`AppShell` renders the library tabs (a `role="tablist"` of `<Link>`s) above the
sidebar demo nav; switching tabs re-links to the same `slug` under another `lib`.
Nothing in the shell or the router is library-specific — both iterate `LIBRARIES`,
which is why adding the third tab needed no routing changes.

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

## The GoJS tab

The GoJS demos consume the same `src/data` modules, but almost nothing else is
shared — and that is the point of having them. Two differences drive the whole
design of `src/gojs/`:

**1. It paints to a `<canvas>`.** There is no DOM per node, so *no CSS reaches the
shapes*. The `.flow-node` / `.rf-svc` classes the other two tabs share are useless
here; every node visual is rebuilt from GoJS `Shape`s, `TextBlock`s and `Panel`s.

**2. It owns its model imperatively.** GoJS is not reconciled by React. You build
a `go.Diagram`, hand it a `GraphLinksModel`, and mutate that model inside
transactions. React's role shrinks to mounting the diagram and rendering the
surrounding chrome.

- **`adapt.ts` → `cellsToGo(cells)` / `createGoModel(cells)`** — narrows the same
  loose `CellRecord` union and maps element records to GoJS node data (`id`→`key`,
  `position`→GoJS's `"x y"` `loc` string, `size`→`width`/`height`) and link records
  to link data (`from`/`to`, label from `labelMap.main.text`). `createGoModel`
  wraps that in a `GraphLinksModel` with `linkKeyProperty: 'key'` so links keep the
  ids the other tabs use. Build one **per mount** — GoJS writes back into node data.
- **`go-canvas.tsx` → `GoCanvas`** — the analogue of `DiagramCanvas` / `FlowCanvas`.
  Mounts a `go.Diagram` on a bare div inside the shared `.canvas` chrome, registers
  the themes, installs a grid, and renders the floating zoom toolbar (every button
  is a `CommandHandler` command) plus an optional `go.Overview` minimap. Demos pass
  a **stable** `init` callback for one-time setup and receive the live diagram via
  `onReady`. Teardown is GoJS's documented `diagram.div = null`.
- **`go-theme.ts`** — because CSS variables can't cross into a canvas, the
  `index.css` tokens are restated here as concrete colors and registered as GoJS
  themes (`light` / `dark`). Templates bind with `.theme('fill', 'nodeFill')` for
  static keys and `.themeData('fill', 'kind', 'kinds')` where a *data* value picks
  the color. Switching theme is then one `themeManager.currentTheme = …`, with no
  diagram rebuild and no loss of state.
- **`go-templates.ts`** — the shared node/link templates: `makeFlowNodeTemplate`
  rebuilds the `.flow-node` card (rounded body, kind-colored accent bar, caption,
  label) as canvas shapes; `makeLinkTemplate` gives arrow-headed links with an
  optional midpoint label, dashed "flow" mode, and `Routing.AvoidsNodes`;
  `makeScaleNodeTemplate` is the cheap node for demo k. Node ports are
  `Spot.AllSides`, so links attach edge-to-edge without explicit handles — the same
  effect as React Flow's floating edges, but built in.

Where GoJS costs the most is demo **i** (the dashboard card is assembled from
panels, and its sparkline is a `go.Geometry` recomputed per tick) and demo **a**
(no CSS keyframes, so the pulse is a `go.Animation` and the reduced-motion
fallback is an explicit `matchMedia` check). Where it wins outright is demo **j** —
`LinkingTool`, `TextEditingTool` and `UndoManager` are all built in, so the
hand-rolled history both other tabs carry simply isn't needed.

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
- **Event log** (`useEventLog`) — bounded, newest-first list, shared by all three
  tabs. Demo g wires the full event surface, throttling high-frequency events.

## Virtualization (demo k)

**JointJS:** large graphs stay usable via the `cellVisibility` predicate: only
cells whose bbox intersects the (inflated) viewport are mounted as React views.
The graph holds all N models; the DOM holds a few hundred. Fully fitting a huge
graph is the only heavy case (it forces everything to render), so auto-fit is
gated by size. **React Flow** virtualizes on its own via `onlyRenderVisibleElements`.
**GoJS** has no switch at all — it only ever paints the viewport. Its cost is in
allocating one `go.Part` per datum, so build time is the limit rather than render
time; the demo reports "in viewport" by intersecting node bounds with
`diagram.viewportBounds`, since there are no mounted elements to count. The three
ceilings (SVG ≫ canvas ≫ DOM for JointJS, GoJS, React Flow respectively) are
reflected in each tab's own caps.

## Theming

CSS custom properties in `index.css`, switched via `data-theme` on `<html>`
(`ThemeProvider`); all tabs share the same tokens for the surrounding chrome.
JointJS and React Flow also style their *shapes* from those tokens (React Flow
follows the theme through its `colorMode` prop). SVG stroke colors use concrete hex
values — SVG presentation attributes don't resolve `var()`. **GoJS can't use the
tokens at all** for shapes: canvas drawing has no cascade, so `go-theme.ts` mirrors
them as GoJS themes and the diagram is switched imperatively.

## Constraints

The JointJS side is **free stack only** — no `@joint/plus`. Zoom/pan, selection,
minimaps, and undo/redo are hand-rolled there rather than using plus widgets. React
Flow provides those out of the box, and GoJS provides them plus linking and text
editing, which is much of what the comparison surfaces.

**GoJS is commercial.** No license key is set, so it runs in evaluation mode and
draws a watermark on the canvas. Its bundle is also large (it roughly doubles the
built JS), which is worth knowing when reading the build output.
