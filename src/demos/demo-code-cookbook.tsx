import type { ReactNode } from 'react';

import { Cookbook, type Snippet } from '../components/cookbook.tsx';

const SNIPPETS: readonly Snippet[] = [
  {
    id: 'minimal',
    title: '1 · Minimal diagram',
    desc: 'A graph is a plain array of cell records. Seed it once with GraphProvider; Paper renders it.',
    code: `import { GraphProvider, Paper, HTMLBox, type CellRecord } from '@joint/react';

interface NodeData { label: string }

const cells: CellRecord<NodeData>[] = [
  { id: '1', type: 'element', position: { x: 40, y: 40 },
    size: { width: 120, height: 48 }, data: { label: 'Hello' } },
  { id: '2', type: 'element', position: { x: 240, y: 160 },
    size: { width: 120, height: 48 }, data: { label: 'World' } },
  { id: 'e1', type: 'link', source: { id: '1' }, target: { id: '2' } },
];

export function Diagram() {
  return (
    <GraphProvider initialCells={cells}>
      <Paper
        style={{ width: '100%', height: 400 }}
        renderElement={(data) => <HTMLBox>{data.label}</HTMLBox>}
      />
    </GraphProvider>
  );
}`,
    demo: 'i-dashboard',
  },
  {
    id: 'custom-element',
    title: '2 · Custom element (HTML or SVG)',
    desc: 'renderElement gets the element’s data slice. Return HTML via <HTMLBox>, or raw SVG for speed.',
    code: `// Rich HTML content — wrap it in <HTMLBox> (rendered via foreignObject).
const renderElement = (data) => (
  <HTMLBox useModelGeometry className="card">
    <strong>{data.label}</strong>
  </HTMLBox>
);

// Or return raw SVG directly — the cheapest option at scale.
const renderElement = (data) => (
  <rect width={120} height={48} rx={8} fill={data.color} />
);`,
    demo: 'k-scale',
  },
  {
    id: 'add',
    title: '3 · Add a shape dynamically',
    desc: 'useGraph().setCell adds (or updates) a cell. React reconciles — the rest is not redrawn.',
    code: `import { useGraph } from '@joint/react';

function AddButton() {
  const { setCell } = useGraph();
  return (
    <button
      onClick={() =>
        setCell({
          id: \`n-\${Date.now()}\`,
          type: 'element',
          position: { x: 80, y: 80 },
          size: { width: 120, height: 48 },
          data: { label: 'New node' },
        })
      }
    >
      Add node
    </button>
  );
}`,
    demo: 'e-add-remove',
  },
  {
    id: 'remove',
    title: '4 · Remove a shape (and its links)',
    desc: 'Remove the element together with any connected links, so nothing is left dangling.',
    code: `const { graph, removeCells } = useGraph();

function remove(id) {
  const cell = graph.getCell(id);
  const links = cell ? graph.getConnectedLinks(cell) : [];
  removeCells([id, ...links.map((link) => link.id)]);
}`,
    demo: 'e-add-remove',
  },
  {
    id: 'update',
    title: '5 · Update data live',
    desc: 'setCellData merges into one cell’s data; only components subscribed to that cell re-render.',
    code: `const { setCellData } = useGraph();

// Functional form — merge a partial update into the previous data.
setCellData('cpu', (prev) => ({ ...prev, value: prev.value + 1 }));`,
    demo: 'i-dashboard',
  },
  {
    id: 'select',
    title: '6 · Select & style one element',
    desc: 'Keep the selected id in state, then toggle a CSS class on the selected cell’s view.',
    code: `// 1) Track the selection and set it from clicks.
const [selectedId, setSelectedId] = useState(null);

<Paper
  renderElement={renderElement}
  onElementPointerClick={({ id }) => setSelectedId(id)}
  onLinkPointerClick={({ id }) => setSelectedId(id)}
  onBlankPointerClick={() => setSelectedId(null)}
/>

// 2) Apply an "is-selected" class to that cell's view (elements AND links).
const { paper } = usePaper();
useEffect(() => {
  if (!paper || selectedId == null) return;
  const view = paper.findViewByModel(selectedId);
  view?.el.classList.add('is-selected');
  return () => view?.el.classList.remove('is-selected');
}, [paper, selectedId]);

/* 3) Style it in CSS:
   .joint-cell.is-selected { outline: 2px solid #6d7cff; } */`,
    demo: 'b-selection',
  },
  {
    id: 'events',
    title: '7 · Listen to events',
    desc: 'Paper events are props; graph-model events come from the useOnGraphEvents hook.',
    code: `// Pointer / context-menu events are Paper props.
<Paper
  onElementPointerClick={({ id }) => console.log('clicked', id)}
  onLinkPointerClick={({ id }) => console.log('link', id)}
  onElementContextMenu={({ id, event }) => openMenu(event.clientX, event.clientY, id)}
/>;

// Model events (add / remove / move ...) via a hook.
useOnGraphEvents({
  add: (cell) => console.log('added', cell.id),
  remove: (cell) => console.log('removed', cell.id),
  'change:position': (cell) => console.log('moved', cell.id),
});`,
    demo: 'g-events',
  },
  {
    id: 'zoom',
    title: '8 · Zoom & pan (controlled transform)',
    desc: 'Drive the viewport from React state via the transform prop, or fit content imperatively.',
    code: `const [scale, setScale] = useState(1);

<Paper transform={\`scale(\${scale})\`} renderElement={renderElement} />
<button onClick={() => setScale((s) => s * 1.2)}>Zoom in</button>;

// Frame everything in the viewport.
const { paper } = usePaper();
paper?.transformToFitContent({ padding: 20 });`,
    demo: 'h-zoom-to',
  },
  {
    id: 'link-style',
    title: '9 · Style a link',
    desc: 'Links take a declarative style (color, width, dashes, markers) and labels via labelMap.',
    code: `const link: CellRecord = {
  id: 'e1',
  type: 'link',
  source: { id: '1' },
  target: { id: '2' },
  style: { color: '#6d7cff', width: 2, dasharray: '6 8', targetMarker: 'arrow' },
  labelMap: { main: { text: 'flow' } },
};`,
    demo: 'i-dashboard',
  },
  {
    id: 'datasets',
    title: '10 · Load / switch datasets',
    desc: 'resetCells atomically replaces the whole graph — perfect for a dataset switcher.',
    code: `const { resetCells } = useGraph();

// Replace everything in one commit.
resetCells(nextDataset);`,
    demo: 'f-datasets',
  },
  {
    id: 'virtualize',
    title: '11 · Virtualize a huge graph',
    desc: 'Render only cells in the viewport, so the model can hold 100k+ while the DOM stays small.',
    code: `<Paper
  renderElement={renderElement}
  cellVisibility={({ model, paper }) =>
    paper.getArea().intersect(model.getBBox()) !== null
  }
/>;`,
    demo: 'k-scale',
  },
];

/** Code cookbook — the minimal snippets behind every pattern in the showcase. */
export function CookbookDemo(): ReactNode {
  return (
    <Cookbook
      basePath="/joint/demo"
      snippets={SNIPPETS}
      intro={
        <>
          The smallest correct snippets for the core patterns. Everything uses only the free{' '}
          <code>@joint/react</code> + <code>@joint/core</code> APIs. Copy a block, or open its live demo.
        </>
      }
    />
  );
}
