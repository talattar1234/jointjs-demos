import type { ReactNode } from 'react';

import { Cookbook, type Snippet } from '../components/cookbook.tsx';

const SNIPPETS: readonly Snippet[] = [
  {
    id: 'minimal',
    title: '1 · Minimal diagram',
    desc: 'GoJS attaches to a plain div. There is no React component — you construct a Diagram in an effect and tear it down by detaching the div.',
    code: `import { useEffect, useRef } from 'react';
import * as go from 'gojs';

export function Diagram() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (host.current === null) return;
    const diagram = new go.Diagram(host.current, { initialAutoScale: go.AutoScale.Uniform });
    diagram.model = new go.GraphLinksModel(
      [{ key: '1', text: 'Hello' }, { key: '2', text: 'World' }],
      [{ from: '1', to: '2' }],
    );
    // Detaching the div is GoJS's documented teardown.
    return () => { diagram.div = null; };
  }, []);

  return <div ref={host} style={{ width: '100%', height: 400 }} />;
}`,
    demo: 'i-dashboard',
  },
  {
    id: 'template',
    title: '2 · Custom node template',
    desc: 'A "custom node" is a tree of GoJS Shapes and TextBlocks, not a React component — the canvas has no DOM for JSX to target.',
    code: `diagram.nodeTemplate = new go.Node('Auto')
  .add(
    new go.Shape('RoundedRectangle', { parameter1: 12, fill: '#1a2338', stroke: null }),
    new go.TextBlock({ margin: 10, stroke: '#e8edf7' }).bind('text', 'label'),
  );

// Position: bind the node's location to your own data property.
diagram.nodeTemplate.bindTwoWay('location', 'loc', go.Point.parse, go.Point.stringify);`,
    demo: 'a-blinking',
  },
  {
    id: 'model',
    title: '3 · The model is the state',
    desc: 'GoJS owns the graph. You hand it two arrays; it builds Nodes and Links and writes user edits back into your data.',
    code: `const model = new go.GraphLinksModel(
  [{ key: 'a', loc: '0 0', label: 'Ingest' }],
  [{ key: 'a->b', from: 'a', to: 'b' }],
  { linkKeyProperty: 'key' },  // needed if you want stable link ids
);
diagram.model = model;

// Assigning a whole new model swaps the graph against the same templates.
diagram.model = buildOtherDataset();`,
    demo: 'f-datasets',
  },
  {
    id: 'transactions',
    title: '4 · Mutate inside a transaction',
    desc: 'Every model change belongs in a transaction. commit() opens one, runs your function, and closes it — naming it makes it undoable.',
    code: `// Undoable: the name becomes the undo entry.
model.commit((m) => {
  m.addNodeData({ key: 'new', loc: '100 100', label: 'New' });
}, 'add node');

// Not undoable — pass null for high-frequency updates like a telemetry tick.
model.commit((m) => m.set(data, 'value', next), null);

// Removing a node: Diagram.remove takes its links with it.
diagram.commit((d) => d.remove(node), 'remove');`,
    demo: 'e-add-remove',
  },
  {
    id: 'bindings',
    title: '5 · Bindings, one-way and two-way',
    desc: 'Bindings map data properties onto GraphObject properties. Set() on the model re-evaluates them; bindTwoWay writes user edits back.',
    code: `new go.TextBlock()
  .bind('text', 'label')                       // data.label → TextBlock.text
  .bind('stroke', 'status', statusToColor)     // with a converter
  .bindModel('visible', 'showLabels');         // from shared model data

// Two-way: dragging updates data.loc, editing updates data.label.
node.bindTwoWay('location', 'loc', go.Point.parse, go.Point.stringify);
new go.TextBlock({ editable: true }).bindTwoWay('text', 'label');`,
    demo: 'k-scale',
  },
  {
    id: 'theming',
    title: '6 · Theming a canvas',
    desc: "CSS custom properties can't reach a canvas. Register themes on the diagram and bind colors through them instead.",
    code: `diagram.themeManager.set('dark', {
  colors: { text: '#e8edf7', nodeFill: '#1a2338', kinds: { start: '#34d399' } },
});

new go.Shape('RoundedRectangle')
  .theme('fill', 'nodeFill')            // static key
  .themeData('stroke', 'kind', 'kinds'); // data value picks the key

// Flip the whole diagram in one assignment.
diagram.themeManager.currentTheme = isDark ? 'dark' : 'light';`,
    demo: 'i-dashboard',
  },
  {
    id: 'selection',
    title: '7 · Selection',
    desc: 'Selection is built in, including the adornment. Observe it with a diagram listener; drive it with select().',
    code: `diagram.addDiagramListener('ChangedSelection', () => {
  setSelectedId(diagram.selection.first()?.key ?? null);
});

// From code:
const node = diagram.findNodeForKey('process');
if (node !== null) diagram.select(node);
diagram.clearSelection();

// Style it: an Adornment wrapped around a Placeholder.
node.selectionAdornmentTemplate = new go.Adornment('Auto').add(
  new go.Shape('RoundedRectangle', { fill: null, stroke: '#6d7cff', strokeWidth: 2 }),
  new go.Placeholder(),
);`,
    demo: 'b-selection',
  },
  {
    id: 'events',
    title: '8 · Listen to events',
    desc: 'Two surfaces: diagram-wide DiagramEvents, and per-object handlers that live on the template.',
    code: `// Diagram-wide
diagram.addDiagramListener('ObjectSingleClicked', (e) => {
  console.log('clicked', e.subject.part.key);
});
diagram.addDiagramListener('BackgroundContextClicked', () => openMenu());
diagram.addDiagramListener('ViewportBoundsChanged', () => console.log(diagram.scale));

// Per-object — a property on the template, not a diagram prop.
diagram.nodeTemplate.mouseEnter = (_e, obj) => highlight(obj.part);

// Screen coordinates of the current input, for positioning React UI:
const mouse = diagram.lastInput.event;  // a MouseEvent`,
    demo: 'g-events',
  },
  {
    id: 'zoom',
    title: '9 · Zoom & pan from code',
    desc: 'CommandHandler already implements the whole zoom surface, so there is no viewport state to hold.',
    code: `diagram.commandHandler.increaseZoom();
diagram.commandHandler.decreaseZoom();
diagram.commandHandler.resetZoom();
diagram.zoomToFit();

// Frame one part
diagram.zoomToRect(node.actualBounds.copy().inflate(140, 140), go.AutoScale.Uniform);

// Read the live scale
diagram.addDiagramListener('ViewportBoundsChanged', () => setScale(diagram.scale));`,
    demo: 'h-zoom-to',
  },
  {
    id: 'editing',
    title: '10 · Connect, rename, undo',
    desc: "The linking tool, the text editor and the undo manager all ship with GoJS — they only need switching on.",
    code: `// Ports the user can drag from
new go.Shape('Circle', {
  portId: 'R', fromLinkable: true, toLinkable: true, cursor: 'crosshair',
});

// Inline rename on double-click
new go.TextBlock({ editable: true }).bindTwoWay('text', 'label');
diagram.toolManager.textEditingTool.starting = go.TextEditingStarting.DoubleClick;

// Undo / redo
diagram.undoManager.isEnabled = true;
diagram.commandHandler.undo();
diagram.commandHandler.redo();`,
    demo: 'j-editor',
  },
  {
    id: 'background',
    title: '11 · Grid and background image',
    desc: 'Both are diagram parts in document space, so they pan and zoom with the graph without any extra work.',
    code: `diagram.grid = new go.Panel('Grid', { gridCellSize: new go.Size(18, 18) })
  .add(new go.Shape('LineH', { stroke: '#ffffff10' }),
       new go.Shape('LineV', { stroke: '#ffffff10' }));

// A tiled image underlay
const underlay = new go.Part({
  layerName: 'Background',
  isInDocumentBounds: false,  // keep it out of zoomToFit
}).add(new go.Shape('Rectangle', {
  width: 8000, height: 8000, strokeWidth: 0,
  fill: new go.Brush(go.BrushType.Pattern, { pattern: image }),
}));
diagram.add(underlay);`,
    demo: 'bg-background',
  },
  {
    id: 'scale',
    title: '12 · Big graphs',
    desc: 'GoJS only paints the viewport, always — there is no culling flag. Cost scales with the number of Parts it allocates, not with what is on screen.',
    code: `diagram.isReadOnly = true;          // drop the interactive tools
diagram.allowSelect = false;
diagram.animationManager.isEnabled = false;

// One assignment beats N addNodeData calls
diagram.model = new go.GraphLinksModel(bigNodeArray, []);

// What is actually on screen right now:
let painted = 0;
const it = diagram.nodes;
while (it.next()) {
  if (it.value.actualBounds.intersectsRect(diagram.viewportBounds)) painted += 1;
}`,
    demo: 'k-scale',
  },
];

/** GoJS code cookbook — the minimal snippets behind every pattern in this tab. */
export function GoCookbookDemo(): ReactNode {
  return (
    <Cookbook
      basePath="/gojs/demo"
      snippets={SNIPPETS}
      intro={
        <>
          The smallest correct snippets for the core patterns, using <code>gojs</code>. GoJS is
          imperative and canvas-based, so these read quite differently from the other two tabs: you
          construct a <code>Diagram</code>, describe nodes as trees of <code>Shape</code>s rather than
          React components, and change the model inside transactions. Copy a block, or open its live
          demo.
        </>
      }
    />
  );
}
