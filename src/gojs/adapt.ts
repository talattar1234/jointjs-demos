import * as go from 'gojs';
import type { CellRecord } from '@joint/react';

/**
 * Every GoJS node datum carries its key, its top-left location as GoJS's `"x y"`
 * string form, and the size the other two tabs give the same shape. Demo payloads
 * (label/kind/status/…) are spread on top.
 */
export interface GoNodeData extends go.ObjectData {
  key: string;
  /** Top-left position in `go.Point.stringify` form, e.g. `"60 40"`. */
  loc: string;
  width: number;
  height: number;
}

/** A GoJS link datum: endpoints by node key, plus the optional label text. */
export interface GoLinkData extends go.ObjectData {
  key: string;
  from: string;
  to: string;
  text?: string;
}

interface GoConversion<TData> {
  readonly nodeDataArray: Array<GoNodeData & TData>;
  readonly linkDataArray: GoLinkData[];
}

/** The subset of a JointJS element record we read (its record type is loose). */
interface ElementCellShape<TData> {
  readonly id: string | number;
  readonly position: { readonly x: number; readonly y: number };
  readonly size: { readonly width: number; readonly height: number };
  readonly data: TData;
}

/** The subset of a JointJS link record we read. */
interface LinkCellShape {
  readonly id: string | number;
  readonly source: { readonly id: string | number };
  readonly target: { readonly id: string | number };
}

/**
 * Read a JointJS link's primary label without leaking `any`. The label lives at
 * `labelMap.main.text` on the link record; anything else yields `undefined`.
 */
function readLinkLabel(cell: unknown): string | undefined {
  const labelMap = (cell as { labelMap?: { main?: { text?: unknown } } }).labelMap;
  return typeof labelMap?.main?.text === 'string' ? labelMap.main.text : undefined;
}

/**
 * Convert a JointJS cell array (the single source of truth reused from the
 * `src/data` modules) into the `nodeDataArray` / `linkDataArray` a GoJS
 * `GraphLinksModel` wants — the GoJS analogue of `cellsToFlow`.
 *
 * Element records become node data keyed by id, with `position` flattened into
 * GoJS's `"x y"` location string and `size` carried as `width`/`height` so the
 * templates can size themselves exactly like the other tabs. Link records become
 * link data with `from`/`to` keys and the label read off `labelMap.main.text`.
 *
 * The arrays are intentionally mutable: GoJS writes back to node data (for
 * example `loc` on drag, through a two-way location binding).
 */
export function cellsToGo<TData extends object>(
  cells: readonly CellRecord<TData>[]
): GoConversion<TData> {
  const nodeDataArray: Array<GoNodeData & TData> = [];
  const linkDataArray: GoLinkData[] = [];

  for (const cell of cells) {
    if (cell.type === 'element') {
      const element = cell as unknown as ElementCellShape<TData>;
      nodeDataArray.push({
        ...element.data,
        key: String(element.id),
        loc: `${element.position.x} ${element.position.y}`,
        width: element.size.width,
        height: element.size.height,
      });
    } else if (cell.type === 'link') {
      const link = cell as unknown as LinkCellShape;
      const text = readLinkLabel(cell);
      linkDataArray.push({
        key: String(link.id),
        from: String(link.source.id),
        to: String(link.target.id),
        ...(text === undefined ? {} : { text }),
      });
    }
  }

  return { nodeDataArray, linkDataArray };
}

/** A `GraphLinksModel` typed to the data a given demo puts on its nodes. */
export type GoModel<TData> = go.GraphLinksModel<GoNodeData & TData, GoLinkData>;

/**
 * Build a ready-to-assign `GraphLinksModel` from shared JointJS cells.
 *
 * `linkKeyProperty` is set so links carry the same stable ids the other tabs
 * use, which is what lets the event and context-menu demos name a specific link.
 * Call this per mount rather than reusing one model: GoJS writes back into node
 * data (`loc` on drag), so two diagrams must never share the same arrays.
 */
export function createGoModel<TData extends object>(
  cells: readonly CellRecord<TData>[]
): GoModel<TData> {
  const { nodeDataArray, linkDataArray } = cellsToGo(cells);
  return new go.GraphLinksModel<GoNodeData & TData, GoLinkData>(nodeDataArray, linkDataArray, {
    linkKeyProperty: 'key',
  });
}
