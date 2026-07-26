import { useCallback, type ReactNode } from 'react';
import * as go from 'gojs';

import { GoCanvas } from './go-canvas.tsx';
import type { GoLinkData, GoNodeData } from './adapt.ts';
import { makeFlowNodeTemplate, makeLinkTemplate } from './go-templates.ts';
import { FLOW_NODE_HEIGHT, FLOW_NODE_WIDTH, type FlowNodeData } from '../data/sample-graph.ts';

// A tileable "blueprint" grid, embedded as a data URI so it works fully offline.
const TILE_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48'>
  <path d='M48 0H0V48' fill='none' stroke='#6b7bb0' stroke-opacity='0.5' stroke-width='1'/>
  <circle cx='0' cy='0' r='1.6' fill='#6b7bb0' fill-opacity='0.7'/>
</svg>`;
const BG_IMAGE = `data:image/svg+xml,${encodeURIComponent(TILE_SVG)}`;
/** How far the underlay extends around the origin, in document units. */
const UNDERLAY_EXTENT = 4000;

interface Site {
  readonly id: string;
  readonly label: string;
  readonly x: number;
  readonly y: number;
}

const SITES: readonly Site[] = [
  { id: 'hq', label: 'HQ', x: 120, y: 120 },
  { id: 'dc-west', label: 'DC West', x: 420, y: 60 },
  { id: 'dc-east', label: 'DC East', x: 700, y: 220 },
  { id: 'store-a', label: 'Store A', x: 300, y: 320 },
  { id: 'store-b', label: 'Store B', x: 620, y: 400 },
];

const ROUTES: ReadonlyArray<readonly [string, string]> = [
  ['hq', 'dc-west'],
  ['hq', 'dc-east'],
  ['dc-west', 'store-a'],
  ['dc-east', 'store-b'],
  ['dc-west', 'store-b'],
];

type SiteNodeData = GoNodeData & FlowNodeData;

function buildModel(): go.GraphLinksModel<SiteNodeData, GoLinkData> {
  const nodes: SiteNodeData[] = SITES.map((site) => ({
    key: site.id,
    loc: `${site.x} ${site.y}`,
    width: FLOW_NODE_WIDTH,
    height: FLOW_NODE_HEIGHT,
    label: site.label,
    kind: 'io',
  }));
  const links: GoLinkData[] = ROUTES.map(([from, to]) => ({ key: `${from}~${to}`, from, to }));
  return new go.GraphLinksModel<SiteNodeData, GoLinkData>(nodes, links, { linkKeyProperty: 'key' });
}

/**
 * Add the tiled image as a `Part` in the built-in "Background" layer, filled
 * with a pattern `Brush`. Because it is a real part in document coordinates,
 * GoJS pans and scales it with everything else for free — no viewport transform
 * has to be mirrored by hand the way the React Flow tab does it.
 *
 * `isInDocumentBounds: false` keeps the huge underlay out of `zoomToFit`'s
 * reckoning, so fitting still frames the nodes.
 */
function addUnderlay(diagram: go.Diagram): void {
  const image = new Image();

  image.onload = () => {
    // The diagram may already be torn down (`div = null`) by the time this fires.
    if (diagram.div === null) {
      return;
    }
    const underlay = new go.Part({
      layerName: 'Background',
      location: new go.Point(-UNDERLAY_EXTENT, -UNDERLAY_EXTENT),
      locationSpot: go.Spot.TopLeft,
      selectable: false,
      pickable: false,
      isInDocumentBounds: false,
    });
    underlay.add(
      new go.Shape('Rectangle', {
        width: UNDERLAY_EXTENT * 2,
        height: UNDERLAY_EXTENT * 2,
        strokeWidth: 0,
        fill: new go.Brush(go.BrushType.Pattern, { pattern: image }),
      })
    );
    diagram.add(underlay);
  };
  image.src = BG_IMAGE;
}

function initDiagram(diagram: go.Diagram): void {
  diagram.nodeTemplate = makeFlowNodeTemplate();
  diagram.linkTemplate = makeLinkTemplate({ dashed: true, labelled: false });
  diagram.model = buildModel();
  addUnderlay(diagram);
}

/** Background-image demo (GoJS) — a map-style image underlay beneath the diagram. */
export function GoBackgroundDemo(): ReactNode {
  const init = useCallback(initDiagram, []);

  return (
    <div className="stage">
      <div className="toolbar">
        <span className="hint">
          A tiled SVG fills a pattern <code>Brush</code> on a Part in the Background layer, so it pans
          and zooms with the shapes automatically.
        </span>
      </div>
      <div className="stage__canvas">
        <GoCanvas init={init} />
      </div>
    </div>
  );
}
