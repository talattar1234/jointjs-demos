import type { CellRecord } from '@joint/react';

/** Health status derived from a service's current metric value. */
export type ServiceStatus = 'ok' | 'warn' | 'crit';

/** The `data` payload carried on each dashboard element. */
export interface ServiceData {
  readonly [key: string]: unknown;
  readonly label: string;
  readonly role: string;
  /** Emoji used as the card glyph. */
  readonly icon: string;
  /** Unit shown next to the current value, e.g. `req/s`. */
  readonly unit: string;
  /** Current metric value. */
  readonly value: number;
  /** Recent values, oldest first, used to draw the sparkline. */
  readonly history: readonly number[];
  readonly status: ServiceStatus;
  /** Random-walk centre the value drifts around. */
  readonly baseline: number;
  /** Largest value the metric can reach (also the sparkline ceiling). */
  readonly ceiling: number;
  /** Thresholds (as a fraction of `ceiling`) for the warn/crit states. */
  readonly warnFraction: number;
  readonly critFraction: number;
}

const CARD_WIDTH = 216;
const CARD_HEIGHT = 108;
const HISTORY_LENGTH = 16;

/** Seed a plausible-looking history around a baseline so sparklines aren't flat. */
function seedHistory(baseline: number, spread: number): number[] {
  const values: number[] = [];
  for (let index = 0; index < HISTORY_LENGTH; index += 1) {
    const wobble = Math.sin(index * 0.7) * spread * 0.5 + (Math.random() - 0.5) * spread;
    values.push(Math.max(0, Math.round(baseline + wobble)));
  }
  return values;
}

interface ServiceSeed {
  readonly id: string;
  readonly label: string;
  readonly role: string;
  readonly icon: string;
  readonly unit: string;
  readonly baseline: number;
  readonly ceiling: number;
  readonly x: number;
  readonly y: number;
}

const SERVICE_SEEDS: readonly ServiceSeed[] = [
  { id: 'gateway', label: 'API Gateway', role: 'Ingress', icon: '🌐', unit: 'req/s', baseline: 820, ceiling: 1200, x: 40, y: 200 },
  { id: 'auth', label: 'Auth Service', role: 'Service', icon: '🔐', unit: 'ms', baseline: 60, ceiling: 200, x: 320, y: 40 },
  { id: 'orders', label: 'Orders API', role: 'Service', icon: '📦', unit: 'req/s', baseline: 340, ceiling: 600, x: 320, y: 200 },
  { id: 'payments', label: 'Payments', role: 'Service', icon: '💳', unit: 'req/s', baseline: 180, ceiling: 400, x: 320, y: 360 },
  { id: 'cache', label: 'Redis Cache', role: 'Cache', icon: '⚡', unit: '% hit', baseline: 92, ceiling: 100, x: 620, y: 40 },
  { id: 'db', label: 'Postgres', role: 'Database', icon: '🗄️', unit: '% CPU', baseline: 55, ceiling: 100, x: 620, y: 200 },
  { id: 'queue', label: 'Event Queue', role: 'Broker', icon: '📨', unit: 'msg/s', baseline: 240, ceiling: 500, x: 620, y: 360 },
  { id: 'worker', label: 'Workers', role: 'Compute', icon: '⚙️', unit: 'jobs/s', baseline: 150, ceiling: 300, x: 900, y: 200 },
];

interface Edge {
  readonly from: string;
  readonly to: string;
}

const EDGES: readonly Edge[] = [
  { from: 'gateway', to: 'auth' },
  { from: 'gateway', to: 'orders' },
  { from: 'gateway', to: 'payments' },
  { from: 'orders', to: 'db' },
  { from: 'orders', to: 'cache' },
  { from: 'payments', to: 'db' },
  { from: 'payments', to: 'queue' },
  { from: 'auth', to: 'cache' },
  { from: 'queue', to: 'worker' },
];

function statusFor(value: number, seed: ServiceSeed): ServiceStatus {
  const fraction = value / seed.ceiling;
  if (fraction >= 0.85) {
    return 'crit';
  }
  if (fraction >= 0.7) {
    return 'warn';
  }
  return 'ok';
}

/** Build the initial cells for the dashboard: one card per service, plus flow links. */
export function createDashboardCells(): CellRecord<ServiceData>[] {
  const elements: CellRecord<ServiceData>[] = SERVICE_SEEDS.map((seed) => {
    const history = seedHistory(seed.baseline, seed.ceiling * 0.12);
    const value = history[history.length - 1];
    return {
      id: seed.id,
      type: 'element',
      position: { x: seed.x, y: seed.y },
      size: { width: CARD_WIDTH, height: CARD_HEIGHT },
      data: {
        label: seed.label,
        role: seed.role,
        icon: seed.icon,
        unit: seed.unit,
        value,
        history,
        status: statusFor(value, seed),
        baseline: seed.baseline,
        ceiling: seed.ceiling,
        warnFraction: 0.7,
        critFraction: 0.85,
      },
    };
  });

  const links: CellRecord<ServiceData>[] = EDGES.map((edge) => ({
    id: `${edge.from}->${edge.to}`,
    type: 'link',
    source: { id: edge.from },
    target: { id: edge.to },
    style: {
      // Concrete color (SVG stroke attributes don't resolve CSS var()).
      color: '#7c8bff',
      width: 2,
      dasharray: '6 8',
      targetMarker: 'arrow',
      className: 'flow-line',
    },
  }));

  return [...elements, ...links];
}

/** Advance one metric value by a bounded random walk and recompute its status. */
export function tickService(previous: ServiceData): ServiceData {
  const seed: ServiceSeed = {
    id: '',
    label: previous.label,
    role: previous.role,
    icon: previous.icon,
    unit: previous.unit,
    baseline: previous.baseline,
    ceiling: previous.ceiling,
    x: 0,
    y: 0,
  };
  const step = previous.ceiling * 0.08;
  const drift = (previous.baseline - previous.value) * 0.05;
  const next = Math.max(0, Math.min(previous.ceiling, previous.value + drift + (Math.random() - 0.5) * step));
  const rounded = Math.round(next);
  const history = [...previous.history.slice(-(HISTORY_LENGTH - 1)), rounded];
  return { ...previous, value: rounded, history, status: statusFor(rounded, seed) };
}
