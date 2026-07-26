# CLAUDE.md

Guidance for working in this repo (for Claude and humans). Read
[ARCHITECTURE.md](./ARCHITECTURE.md) first for the layout.

## What this is

A side-by-side showcase of **three** React diagramming libraries, one per tab:

- **JointJS** — the **free** React stack (`@joint/react` + `@joint/core`). Do
  **not** introduce `@joint/plus` (commercial) — anything a plus widget would do
  is hand-rolled here.
- **React Flow** (`@xyflow/react`).
- **GoJS** (`gojs`) — commercial, canvas-rendered. No license key is configured,
  so it runs in evaluation mode with a watermark; that's accepted, don't try to
  work around it.

The **same demo list** is implemented on all three. Every tab draws from the shared
`src/data` modules (single source of truth), so they're apples-to-apples. JointJS
demos live in `src/demos/demo-*.tsx`; React Flow demos in `src/reactflow/flow-*.tsx`;
GoJS demos in `src/gojs/go-*.tsx`. The pairing and metadata are wired up in
`src/app/demo-registry.tsx`.

## Conventions

Mirrors `@joint/react`'s own style so our code reads like the library (the React
Flow and GoJS sides follow the same conventions plus their own library's idioms):

- **File names** kebab-case; **components** PascalCase.
- **No `any`.** Prefer `readonly` / immutable data. Use `unknown` + narrowing at
  untyped JointJS boundaries; keep `as` casts rare and local.
- **Boolean names** use `is`/`has`/`should`/`can`.
- Named constants over magic numbers.
- `useMemo`/`useCallback` only when they prevent real work.
- JSDoc on exported functions/components.
- Every demo component returns `ReactNode` and is `export`ed with a
  `*Demo` / descriptive name registered in `src/app/demo-registry.tsx`.

## Verified `@joint/react` API cheat-sheet

(Confirmed against the installed `dist/types` — trust these over web docs.)

- `<GraphProvider initialCells={CellRecord[]}>` (uncontrolled) or `cells`+`onCellsChange` (controlled).
- `<Paper renderElement={fn} renderLink={fn} transform={string} {...events} />`.
- Element record: `{ id, type:'element', position, size, data }`. Link record:
  `{ id, type:'link', source:{id}, target:{id}, style?:LinkStyle, labelMap? }`.
- Content: `HTMLBox` / `HTMLHost` (HTML via foreignObject; `useModelGeometry` to
  size from the model) or return raw SVG.
- Hooks: `useGraph()` (→ `setCell`, `setCellData`, `removeCell(s)`, `resetCells`,
  `importFromJSON`, `exportToJSON`, `transaction`, `graph`), `useCell`, `useCells`,
  `useCellId`, `usePaper()` (→ `{ paper }`), `useMarkup()` (→ `selectorRef`,
  `magnetRef`), `useOnPaperEvents`, `useOnGraphEvents`, `useOnElementsMeasured`.
- Events are `<Paper>` props: `onElementPointerClick`, `onElementContextMenu`,
  `onLink*`, `onBlank*`, `onElementMagnet*`, `onLinkConnect/Disconnect`, plus
  paper-level `onScale/onTranslate/onTransform/onResize/onPaperPan/onPaperPinch`.
  Each handler gets one params object (`{ id, model, paper, graph, event, x, y }`
  where applicable). `event.clientX/clientY` are optional — coalesce with `?? 0`.
- Routing/connectors are set via the `options` escape hatch on `<Paper>`
  (`options: { defaultRouter, defaultConnector }`) or the `linkRouting` prop.
  `background`, `drawGrid`, `gridSize`, `interactive`, `snapLinks`, `defaultLink`,
  `cellVisibility` are dedicated props.

## How to add a demo

A demo exists once as shared metadata and (ideally) once per library. Every tab
builds from the same `DEMO_META` list in `src/app/demo-registry.tsx`.

1. Add the demo's metadata to `DEMO_META` in `src/app/demo-registry.tsx`
   (`slug`, `tag`, `title`, `tagline`, `scroll?`) — this is what all tabs share.
2. **JointJS side:** create `src/demos/demo-<tag>-<name>.tsx`. Mount
   `DiagramCanvas` inside a `<GraphProvider>`; pass `renderElement`. Reuse
   `SelectionProvider`/`SelectionLayer`, `useEventLog`, `ContextMenu` as needed.
   Map its `slug` → component in `JOINT_COMPONENTS`.
3. **React Flow side:** create `src/reactflow/flow-<tag>-<name>.tsx`. Mount
   `FlowCanvas`; reuse `cellsToFlow` (`adapt.ts`) to convert the shared
   `src/data` cells into nodes/edges, and the shared node/edge types. Map its
   `slug` → component in `REACTFLOW_COMPONENTS`.
4. **GoJS side:** create `src/gojs/go-<tag>-<name>.tsx`. Mount `GoCanvas` with a
   **stable** `init` callback (module function + `useCallback(fn, [])`) that sets
   `nodeTemplate`/`linkTemplate` from `go-templates.ts` and assigns a model from
   `createGoModel` (`adapt.ts`). Take the live diagram via `onReady`. Map its
   `slug` → component in `GOJS_COMPONENTS`.
   (`ready` is derived from whether a component exists — no need to set it.)
5. Put shared data in `src/data/*` so every tab renders the same graph.
6. Style with existing classes / tokens in `index.css` (shared across tabs) — but
   see the GoJS gotchas: canvas shapes need colors in `go-theme.ts` instead.
7. `npm run typecheck && npm run build`.

## Gotchas

JointJS:

- **SVG stroke ≠ `var()`.** Set link/SVG colors to concrete hex; CSS variables
  don't resolve in SVG presentation attributes. (CSS `fill`/`stroke` set via a
  class *do* resolve `var()`, as in `.ednode`.)
- **Controlled transform.** Zoom/pan is React-state-driven via the `transform`
  prop (`useZoomPan`). Don't also call `paper.scale()/translate()` imperatively —
  it will fight the controlled value.
- **Fit timing.** HTML boxes measure asynchronously; fit-on-mount runs in
  `useOnElementsMeasured`. SVG-only demos (k) don't measure — use the `fitSignal`
  prop to refit after loading.
- **Scale.** For big graphs use plain SVG nodes + `cellVisibility` culling; avoid
  `HTMLBox` and per-cell subscriptions in the render path.
- **Undo/redo (demo j)** is snapshot-based (`exportToJSON`/`importFromJSON`) with a
  `restoring` guard so restores don't re-enter the history.

React Flow:

- **Node/edge type maps** (`FLOW_NODE_TYPES`, `EDGE_TYPES`, …) must be module-level
  constants — inline objects give a new identity each render and React Flow warns.
- **Floating edges** are the default (`type: 'floating'`), so nodes need no
  handles; endpoints are computed from node-center intersections in `flow-edges.tsx`.
- **Theme** flows through `<ReactFlow colorMode>` (wired in `FlowCanvas`); don't
  restyle it by hand. Node/edge visuals reuse the shared `.flow-node` / token CSS.
- **Data conversion** goes through `cellsToFlow` (`adapt.ts`) — don't hand-build
  nodes/edges; the JointJS `CellRecord` union is loose and narrowing lives there.

GoJS:

- **CSS does not reach the shapes.** GoJS draws to a `<canvas>`, so `var()` tokens,
  `.flow-node`, keyframes, and `:hover` are all unavailable inside a node. Colors
  and fonts live in `src/gojs/go-theme.ts` as GoJS themes; bind them with
  `.theme('fill', 'nodeFill')`, or `.themeData('fill', 'kind', 'kinds')` when a data
  value selects the color. Never hard-code a hex in a template — it won't follow the
  light/dark toggle.
- **`GoCanvas`'s `init` must be stable.** It's an effect dependency; an inline arrow
  rebuilds the whole diagram every render. Use a module-level function wrapped in
  `useCallback(fn, [])`.
- **Build a fresh model per mount.** `createGoModel` returns arrays GoJS *writes
  back into* (`loc` via the two-way location binding). Never share one model or one
  node-data array between two diagrams.
- **Model changes need a transaction.** `model.commit(fn, 'name')` records an undo
  edit; `model.commit(fn, null)` deliberately doesn't — use `null` for
  high-frequency updates like the dashboard tick. To delete a node use
  `diagram.remove(node)` (takes its links with it), not `model.removeNodeData`.
- **Node positions are top-left** only because templates set
  `locationSpot: go.Spot.TopLeft` and bind `location` ↔ `loc`. GoJS defaults to
  centering, which would misalign against the other two tabs.
- **Teardown is `diagram.div = null`.** That's GoJS's documented dispose;
  `GoCanvas` already does it, and it's what makes StrictMode's double-invoke safe.
- **Animation is `go.Animation`,** not CSS — and `prefers-reduced-motion` has to be
  checked explicitly with `matchMedia` (demos a and i both do).

All three:

- **StrictMode** double-invokes effects in dev; one-time init effects use a ref guard.

## Verification

There is no automated visual test (no Playwright by request). Always run
`npm run typecheck` and `npm run build`. Runtime/visual behavior must be checked
in a real browser (`npm run dev`) — call out anything you couldn't verify.
