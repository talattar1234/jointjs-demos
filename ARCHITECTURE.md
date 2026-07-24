# Architecture

## Stack

- **Vite** + **React 19** + **TypeScript** (strict).
- **`@joint/react`** (React bindings) on top of **`@joint/core`** (engine).
- **`react-router-dom`** for per-demo routes.
- No global state library — React state + small contexts are enough.

## Folder structure

```
src/
  main.tsx                 App entry: providers + router
  App.tsx                  Routes (all under AppShell)
  index.css                Design tokens + all component styles
  app/
    theme.tsx              Light/dark theme context (data-theme on <html>)
    app-shell.tsx          Sidebar nav + routed <Outlet>
    demo-page.tsx          Resolves :slug → demo component
    demo-registry.tsx      SINGLE source of truth: the demo list
  components/
    diagram-canvas.tsx     Shared <Paper> wrapper (zoom, pan, fit, controls)
    zoom-controls.tsx      Floating zoom toolbar
    context-menu.tsx       Viewport-clamped React context menu
    event-log.tsx          Event-log side panel (presentational)
    flow-node.tsx          Shared HTML element renderer
  hooks/
    use-zoom-pan.ts        Controlled zoom/pan + ZoomPanContext
    use-selection.tsx      SelectionProvider + SelectionLayer
    use-event-log.tsx      Bounded event log state
  data/
    sample-graph.ts        Shared flow graph + FlowNodeData
    dashboard.ts           Demo i data + telemetry tick
    datasets.ts            Demo f datasets
    scale.ts               Demo k generator
  demos/
    demo-*.tsx             One module per demo
```

## Core model: declarative cells

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

## Shared building blocks

- **`DiagramCanvas`** — the one wrapper every demo mounts inside its
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
- **Event log** (`useEventLog`) — bounded, newest-first list. Demo g wires the full
  `PaperEventHandlers` surface, throttling high-frequency events.

## Virtualization (demo k)

Large graphs stay usable via the `cellVisibility` predicate: only cells whose
bbox intersects the (inflated) viewport are mounted as React views. The graph
holds all N models; the DOM holds a few hundred. Fully fitting a huge graph is the
only heavy case (it forces everything to render), so auto-fit is gated by size.

## Theming

CSS custom properties in `index.css`, switched via `data-theme` on `<html>`
(`ThemeProvider`). SVG stroke colors use concrete hex values — SVG presentation
attributes don't resolve `var()`.

## Constraints

Free stack only. No `@joint/plus`. Zoom/pan, selection, minimaps, and undo/redo
are hand-rolled rather than using plus widgets.
