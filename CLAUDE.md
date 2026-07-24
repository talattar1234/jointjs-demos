# CLAUDE.md

Guidance for working in this repo (for Claude and humans). Read
[ARCHITECTURE.md](./ARCHITECTURE.md) first for the layout.

## What this is

A demo showcase for the **free** JointJS React stack (`@joint/react` +
`@joint/core`). Do **not** introduce `@joint/plus` (commercial) — anything a plus
widget would do is hand-rolled here.

## Conventions

Mirrors `@joint/react`'s own style so our code reads like the library:

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

1. Create `src/demos/demo-<tag>-<name>.tsx` exporting a component.
2. Mount `DiagramCanvas` inside a `<GraphProvider>`; pass `renderElement`.
   Reuse `SelectionProvider`/`SelectionLayer`, `useEventLog`, `ContextMenu` as needed.
3. Register it in `src/app/demo-registry.tsx` (`slug`, `tag`, `title`, `tagline`,
   `ready: true`, `Component`).
4. Style with existing classes / tokens in `index.css`.
5. `npm run typecheck && npm run build`.

## Gotchas

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
- **StrictMode** double-invokes effects in dev; one-time init effects use a ref guard.

## Verification

There is no automated visual test (no Playwright by request). Always run
`npm run typecheck` and `npm run build`. Runtime/visual behavior must be checked
in a real browser (`npm run dev`) — call out anything you couldn't verify.
