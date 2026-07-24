# JointJS React — Demo Showcase

An interactive showcase of diagramming use cases built with the **free** JointJS
React stack: [`@joint/react`](https://www.npmjs.com/package/@joint/react) +
[`@joint/core`](https://www.npmjs.com/package/@joint/core). No commercial
`@joint/plus` license is required.

> Built with Vite + React 19 + TypeScript (strict).

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
```

Other scripts:

| Script | Purpose |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Type-check (`tsc -b`) + production build |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | Type-check only |

## Demos

Each demo is a self-contained module under `src/demos/`, registered in
`src/app/demo-registry.tsx` (the single source of truth for the sidebar + router).

| Tag | Demo | Highlights |
|---|---|---|
| i | Live telemetry dashboard | Rich HTML cards, live `setCellData` updates, sparklines, animated links |
| k | Scale test | Generate up to 200k shapes; viewport-virtualized rendering |
| b | Click to select | Single selection across elements **and** links |
| g | Event inspector | Live log of every supported paper/graph event |
| h | Programmatic zoom | Code-driven zoom in/out/reset/fit/zoom-to-selected |
| a | Blinking alert shape | Motion-safe CSS pulse on a target node |
| c | React context menu | Right-click node/link/blank → contextual React menu |
| d | Select from code | Select a shape by id or label from an input |
| e | Add & remove | Incremental graph mutation, cascading link removal |
| f | Switch datasets | Buttons load different datasets and refit |
| j | Interactive editor | Drag-to-connect ports, inline rename, undo/redo |
| bg | Background image | Tiled SVG image underlay |

## Constraints (free stack)

The paid `@joint/plus` widgets (PaperScroller, Navigator, Halo, Inspector,
Stencil, CommandManager) are **not** used. Their equivalents here are hand-rolled:
zoom/pan (`useZoomPan`), selection (`useSelection`), and undo/redo (JSON snapshots
in demo j).

See [ARCHITECTURE.md](./ARCHITECTURE.md) for how it fits together and
[CLAUDE.md](./CLAUDE.md) for conventions and how to add a demo.
