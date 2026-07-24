import { useCallback, useEffect, type ReactNode } from 'react';
import {
  GraphProvider,
  HTMLBox,
  useCells,
  useGraph,
  type CellRecord,
  type ElementRecord,
  type RenderElement,
} from '@joint/react';

import { DiagramCanvas } from '../components/diagram-canvas.tsx';
import {
  createDashboardCells,
  tickService,
  type ServiceData,
  type ServiceStatus,
} from '../data/dashboard.ts';

/** How often the simulated telemetry advances, in milliseconds. */
const TICK_MS = 1400;

const initialCells: CellRecord<ServiceData>[] = createDashboardCells();

const STATUS_LABEL: Record<ServiceStatus, string> = {
  ok: 'Healthy',
  warn: 'Elevated',
  crit: 'Critical',
};

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

/** The rich HTML card rendered for each service element. */
function ServiceCard({ data }: Readonly<{ data: ServiceData }>): ReactNode {
  return (
    <HTMLBox useModelGeometry className={`svc svc--${data.status}`}>
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
    </HTMLBox>
  );
}

/**
 * Invisible engine mounted inside the provider: every tick it walks each
 * service's metric via `setCellData`, and the subscribed cards re-render on
 * their own — showcasing the reactive data flow without touching the DOM.
 */
function TelemetryEngine(): ReactNode {
  const { setCellData } = useGraph<ElementRecord<ServiceData>>();
  const ids = useCells((cells) => cells.filter((cell) => cell.type === 'element').map((cell) => cell.id));

  useEffect(() => {
    const timer = window.setInterval(() => {
      for (const id of ids) {
        setCellData(id, (previous) => tickService(previous));
      }
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [ids, setCellData]);

  return null;
}

const renderElement: RenderElement<ServiceData> = (data) => <ServiceCard data={data} />;

/** Demo i — a live telemetry dashboard of service cards linked by animated flows. */
export function DashboardDemo(): ReactNode {
  const renderElementCb = useCallback(renderElement, []);

  return (
    <GraphProvider initialCells={initialCells}>
      <TelemetryEngine />
      <DiagramCanvas
        renderElement={renderElementCb}
        paperProps={{
          drawGrid: { name: 'dot', args: { color: 'rgba(140,150,190,0.16)' } },
          gridSize: 16,
          options: {
            defaultRouter: { name: 'orthogonal' },
            defaultConnector: { name: 'rounded', args: { radius: 12 } },
          },
        }}
      >
        <div className="legend">
          <span className="legend__live">
            <span className="legend__pulse" /> live · updates every {(TICK_MS / 1000).toFixed(1)}s
          </span>
          <span className="legend__item legend__item--ok">Healthy</span>
          <span className="legend__item legend__item--warn">Elevated</span>
          <span className="legend__item legend__item--crit">Critical</span>
        </div>
      </DiagramCanvas>
    </GraphProvider>
  );
}
