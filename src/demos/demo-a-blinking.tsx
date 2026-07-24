import { useCallback, useState, type ReactNode } from 'react';
import { GraphProvider, useGraph, type ElementRecord, type RenderElement } from '@joint/react';

import { DiagramCanvas } from '../components/diagram-canvas.tsx';
import { FlowNode } from '../components/flow-node.tsx';
import { createSampleCells, type FlowNodeData } from '../data/sample-graph.ts';

/** The node that carries the alert in this demo. */
const ALERT_NODE_ID = 'reject';
const initialCells = createSampleCells(true);
const renderElement: RenderElement<FlowNodeData> = (data) => <FlowNode data={data} />;

function BlinkingStage(): ReactNode {
  const { setCellData } = useGraph<ElementRecord<FlowNodeData>>();
  const [alerting, setAlerting] = useState(true);
  const renderElementCb = useCallback(renderElement, []);

  const toggle = useCallback(() => {
    setAlerting((current) => {
      const next = !current;
      setCellData(ALERT_NODE_ID, (previous) => ({ ...previous, alert: next }));
      return next;
    });
  }, [setCellData]);

  return (
    <div className="stage">
      <div className="toolbar">
        <button type="button" className={`btn ${alerting ? '' : 'btn--primary'}`} onClick={toggle}>
          {alerting ? 'Silence alert' : 'Trigger alert'}
        </button>
        <span className="hint">
          The “Reject &amp; alert” node pulses red via a CSS animation. It falls back to a static red
          outline when the OS prefers reduced motion.
        </span>
      </div>
      <div className="stage__canvas">
        <DiagramCanvas<FlowNodeData>
          renderElement={renderElementCb}
          paperProps={{
            drawGrid: { name: 'dot', args: { color: 'rgba(140,150,190,0.14)' } },
            gridSize: 16,
            options: {
              defaultRouter: { name: 'orthogonal' },
              defaultConnector: { name: 'rounded', args: { radius: 10 } },
            },
          }}
        />
      </div>
    </div>
  );
}

/** Demo a — a specific shape pulses red to grab attention. */
export function BlinkingDemo(): ReactNode {
  return (
    <GraphProvider initialCells={initialCells}>
      <BlinkingStage />
    </GraphProvider>
  );
}
