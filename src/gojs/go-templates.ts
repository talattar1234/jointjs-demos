import * as go from 'gojs';

import type { GoNodeData } from './adapt.ts';

/**
 * The shared GoJS templates. This is the GoJS counterpart of `flow-nodes.tsx`
 * on the React Flow tab — but where that file reuses the app's `.flow-node` CSS,
 * GoJS paints to a `<canvas>`, so the same visual is rebuilt out of `Shape`s and
 * `TextBlock`s and colored through theme bindings (see `go-theme.ts`).
 */

/** Corner radius matching the `.flow-node` border-radius. */
const CORNER = 12;
/** Width of the left accent bar (the `.flow-node::before` rule). */
const ACCENT_BAR_WIDTH = 4;
/** Horizontal padding before the text column. */
const TEXT_INSET = 14;
/** Rounded corner used where links turn. */
const LINK_CORNER = 10;

/** Read `{ width, height }` off a node datum as a GoJS size. */
function sizeOfData(data: GoNodeData): go.Size {
  return new go.Size(data.width, data.height);
}

/**
 * The accent outline drawn around a selected node — the canvas equivalent of the
 * `outline: 2px solid var(--accent)` rule the other two tabs use.
 */
function makeNodeSelectionAdornment(): go.Adornment {
  return new go.Adornment('Auto').add(
    new go.Shape('RoundedRectangle', {
      fill: null,
      strokeWidth: 2,
      parameter1: CORNER + 1,
    }).theme('stroke', 'selection'),
    new go.Placeholder({ padding: new go.Margin(1) })
  );
}

/** A thicker accent stroke laid over a selected link. */
function makeLinkSelectionAdornment(): go.Adornment {
  return new go.Adornment('Link').add(
    new go.Shape({ isPanelMain: true, strokeWidth: 4, opacity: 0.55 }).theme('stroke', 'selection')
  );
}

/** Two-way location binding: GoJS writes the dragged position back into `loc`. */
function bindLocation<T extends go.Part>(part: T): T {
  return part.bindTwoWay('location', 'loc', go.Point.parse, go.Point.stringify);
}

interface FlowNodeOptions {
  /** Allow drawing new links from/to this node (demo j). @default false */
  readonly linkable?: boolean;
  /** Let the user drag the node. @default true */
  readonly movable?: boolean;
}

/**
 * The standard flow node: a rounded card with a kind-colored accent bar, a small
 * uppercase kind caption, and the label. Ports are the whole node boundary
 * (`Spot.AllSides`), so links attach edge-to-edge like the floating edges on the
 * React Flow tab rather than needing explicit handles.
 */
export function makeFlowNodeTemplate({ linkable = false, movable = true }: FlowNodeOptions = {}): go.Node {
  const node = new go.Node('Spot', {
    locationSpot: go.Spot.TopLeft,
    cursor: 'pointer',
    movable,
    portId: '',
    fromSpot: go.Spot.AllSides,
    toSpot: go.Spot.AllSides,
    fromLinkable: linkable,
    toLinkable: linkable,
    selectionAdornmentTemplate: makeNodeSelectionAdornment(),
  });

  return bindLocation(node).add(
    new go.Shape('RoundedRectangle', { name: 'BODY', parameter1: CORNER })
      .bind('desiredSize', '', sizeOfData)
      .bind('strokeWidth', 'alert', (alert: unknown) => (alert === true ? 2.5 : 1))
      .theme('fill', 'nodeFill')
      // Theme-aware *and* data-driven: the datum's `alert` flag picks which
      // stroke color to read out of the current theme's `strokes` group.
      .themeData('stroke', 'alert', 'strokes', (alert: unknown) => (alert === true ? 'alert' : 'none')),

    // The kind-colored bar pinned to the left edge (`.flow-node::before`).
    new go.Shape('RoundedRectangle', {
      parameter1: 2,
      strokeWidth: 0,
      width: ACCENT_BAR_WIDTH,
      alignment: new go.Spot(0, 0.5, ACCENT_BAR_WIDTH, 0),
      alignmentFocus: go.Spot.Left,
    })
      .bind('height', '', (data: GoNodeData) => data.height - 16)
      .themeData('fill', 'kind', 'kinds'),

    new go.Panel('Vertical', {
      alignment: new go.Spot(0, 0.5, TEXT_INSET, 0),
      alignmentFocus: go.Spot.Left,
      defaultAlignment: go.Spot.Left,
    }).add(
      new go.TextBlock({ margin: new go.Margin(0, 0, 2, 0) })
        .bind('text', 'kind', (kind: string) => kind.toUpperCase())
        .theme('stroke', 'textFaint')
        .theme('font', 'kind'),
      new go.TextBlock({ overflow: go.TextOverflow.Ellipsis, maxLines: 1 })
        .bind('text', 'label')
        .bind('width', '', (data: GoNodeData) => data.width - TEXT_INSET * 2 - ACCENT_BAR_WIDTH)
        .theme('stroke', 'text')
        .theme('font', 'label')
    )
  );
}

interface LinkOptions {
  /** Draw the link as a dashed "flow" line (the dashboard). @default false */
  readonly dashed?: boolean;
  /** Curve the link instead of routing it orthogonally. @default false */
  readonly curved?: boolean;
  /** Render the `text` label at the midpoint. @default true */
  readonly labelled?: boolean;
  /** Let the user select the link. @default true */
  readonly selectable?: boolean;
}

/**
 * The standard link: an arrow-headed line themed to the shared `#7c8bff`.
 * `AvoidsNodes` routing is GoJS doing for free what the JointJS tab asks of its
 * orthogonal router and the React Flow tab hand-computes in `FloatingEdge`.
 */
export function makeLinkTemplate({
  dashed = false,
  curved = false,
  labelled = true,
  selectable = true,
}: LinkOptions = {}): go.Link {
  const link = new go.Link({
    routing: curved ? go.Routing.Normal : go.Routing.AvoidsNodes,
    curve: curved ? go.Curve.Bezier : go.Curve.None,
    corner: LINK_CORNER,
    selectable,
    relinkableFrom: false,
    relinkableTo: false,
    selectionAdornmentTemplate: makeLinkSelectionAdornment(),
  }).add(
    new go.Shape({
      name: 'PATH',
      strokeWidth: 2,
      ...(dashed ? { strokeDashArray: [6, 8] } : {}),
    }).theme('stroke', 'link'),
    new go.Shape({ toArrow: 'Standard', strokeWidth: 0, scale: 1.1 }).theme('fill', 'link')
  );

  if (!labelled) {
    return link;
  }

  return link.add(
    new go.Panel('Auto', { visible: false })
      .bind('visible', 'text', (text: unknown) => typeof text === 'string' && text !== '')
      .add(
        new go.Shape('RoundedRectangle', { parameter1: 6, strokeWidth: 1 })
          .theme('fill', 'panelSoft')
          .theme('stroke', 'nodeStroke'),
        new go.TextBlock({ margin: new go.Margin(2, 7) })
          .bind('text')
          .theme('stroke', 'text')
          .theme('font', 'edge')
      )
  );
}

/**
 * The cheapest node the scale test can use: one solid rounded rect plus its
 * index. GoJS renders to a single canvas, so unlike the DOM-based tabs there is
 * no per-node element to virtualize away — it simply doesn't paint what is
 * off-screen.
 */
export function makeScaleNodeTemplate(): go.Node {
  const node = new go.Node('Spot', {
    locationSpot: go.Spot.TopLeft,
    selectable: false,
    movable: false,
    pickable: false,
  });

  return bindLocation(node).add(
    new go.Shape('RoundedRectangle', { parameter1: 5, strokeWidth: 0 })
      .bind('desiredSize', '', sizeOfData)
      .bind('fill', 'hue', (hue: number) => `hsl(${hue} 70% 58%)`),
    // `bindModel` reads shared model data, so toggling every label at once is a
    // single `Model.set` on `modelData` rather than a walk over N nodes.
    new go.TextBlock({ name: 'LABEL', stroke: '#0b1020' })
      .bind('text', 'label')
      .bindModel('visible', 'showLabels')
      .theme('font', 'tiny')
  );
}
