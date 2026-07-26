import { useEffect, type ReactNode } from 'react';
import {
  Handle,
  Position,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from '@xyflow/react';

import { FlowCanvas } from './flow-canvas.tsx';
import { cellsToFlow } from './adapt.ts';
import {
  createDashboardCells,
  tickService,
  type ServiceData,
  type ServiceStatus,
} from '../data/dashboard.ts';

/** How often the simulated telemetry advances, in milliseconds. */
const TICK_MS = 1400;

const STATUS_LABEL: Record<ServiceStatus, string> = {
  ok: 'Healthy',
  warn: 'Elevated',
  crit: 'Critical',
};

const converted = cellsToFlow(createDashboardCells(), 'svc');
const INITIAL_NODES: Node<ServiceData>[] = converted.nodes;
// Animated "flow" edges — React Flow animates the dash offset for us.
const INITIAL_EDGES: Edge[] = converted.edges.map((edge) => ({ ...edge, animated: true }));

/** A tiny inline sparkline drawn from the service's recent history. */
function Sparkline({ history, ceiling }: Readonly<{ history: readonly number[]; ceiling: number }>): ReactNode {
  const width = 184;
  const height = 34;
  if (history.length < 2) {
    return <svg className="svc__spark" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" />;
  }
  const stepX = width / (history.length - 1);
  const points = history
    .map((value, index) => {
      const x = index * stepX;
      const y = height - (Math.max(0, Math.min(ceiling, value)) / ceiling) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <svg className="svc__spark" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden>
      <polygon className="svc__spark-fill" points={areaPoints} />
      <polyline className="svc__spark-line" points={points} />
    </svg>
  );
}

/** The rich HTML card rendered for each service node. */
function ServiceCardView({ data }: NodeProps<Node<ServiceData>>): ReactNode {
  return (
    <div className={`rf-svc rf-svc--${data.status}`}>
      {/* Hidden handles: floating edges compute their own endpoints, but React
          Flow still requires a source + target handle to exist before it will
          instantiate an edge on the node. */}
      <Handle type="target" position={Position.Left} className="rf-svc__handle" isConnectable={false} />
      <Handle type="source" position={Position.Right} className="rf-svc__handle" isConnectable={false} />
      <div className="svc__head">
        <span className="svc__icon" aria-hidden>
          {data.icon}
        </span>
        <span className="svc__titles">
          <span className="svc__label">{data.label}</span>
          <span className="svc__role">{data.role}</span>
        </span>
        <span className="svc__dot" title={STATUS_LABEL[data.status]} />
      </div>
      <div className="svc__metric">
        <span className="svc__value">{data.value.toLocaleString()}</span>
        <span className="svc__unit">{data.unit}</span>
      </div>
      <Sparkline history={data.history} ceiling={data.ceiling} />
    </div>
  );
}

const DASHBOARD_NODE_TYPES: NodeTypes = { svc: ServiceCardView };

function DashboardStage(): ReactNode {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<ServiceData>>(INITIAL_NODES);
  const [edges, , onEdgesChange] = useEdgesState(INITIAL_EDGES);

  // Every tick, walk each card's metric forward; only the cards re-render.
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNodes((previous) => previous.map((node) => ({ ...node, data: tickService(node.data) })));
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [setNodes]);

  return (
    <div className="stage">
      <div className="stage__canvas">
        <FlowCanvas
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={DASHBOARD_NODE_TYPES}
        >
          <div className="legend">
            <span className="legend__live">
              <span className="legend__pulse" /> live · updates every {(TICK_MS / 1000).toFixed(1)}s
            </span>
            <span className="legend__item legend__item--ok">Healthy</span>
            <span className="legend__item legend__item--warn">Elevated</span>
            <span className="legend__item legend__item--crit">Critical</span>
          </div>
        </FlowCanvas>
      </div>
    </div>
  );
}

/** Demo i (React Flow) — a live telemetry dashboard of service cards linked by animated flows. */
export function FlowDashboardDemo(): ReactNode {
  return (
    <ReactFlowProvider>
      <DashboardStage />
    </ReactFlowProvider>
  );
}
