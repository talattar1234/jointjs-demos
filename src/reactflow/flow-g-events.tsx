import { useCallback, useRef, type ReactNode } from 'react';
import {
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
} from '@xyflow/react';

import { FlowCanvas } from './flow-canvas.tsx';
import { FLOW_NODE_TYPES } from './flow-nodes.tsx';
import { cellsToFlow } from './adapt.ts';
import { EventLog } from '../components/event-log.tsx';
import { useEventLog, type LogTone } from '../hooks/use-event-log.tsx';
import { createSampleCells, type FlowNodeData } from '../data/sample-graph.ts';

const { nodes: INITIAL_NODES, edges: INITIAL_EDGES } = cellsToFlow(createSampleCells(false), 'flow');

/** Throttle window (ms) for high-frequency events so the log doesn't flood. */
const THROTTLE_MS = 180;
/** How long the on-canvas flash lasts. */
const FLASH_MS = 480;

/** Briefly highlight the node/edge that triggered an event (DOM class, no re-render). */
function flash(selector: string): void {
  const element = document.querySelector(selector);
  if (element === null) {
    return;
  }
  element.classList.add('flash');
  window.setTimeout(() => element.classList.remove('flash'), FLASH_MS);
}

function EventsStage(): ReactNode {
  const log = useEventLog(200);
  const [nodes, , onNodesChange] = useNodesState<Node<FlowNodeData>>(INITIAL_NODES);
  const [edges, , onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const throttleRef = useRef<Record<string, number>>({});

  const throttle = useCallback((key: string, ms: number, run: () => void) => {
    const now = performance.now();
    if (now - (throttleRef.current[key] ?? 0) > ms) {
      throttleRef.current[key] = now;
      run();
    }
  }, []);

  const push = useCallback(
    (label: string, detail?: string, tone: LogTone = 'info') => log.push(label, detail, tone),
    [log]
  );

  return (
    <div className="stage">
      <div className="toolbar">
        <div className="chips">
          <span className="chip">
            logged <b>{log.entries.length}</b>
          </span>
        </div>
        <span className="hint">
          Click, double-click, right-click, hover, drag, and zoom — every supported event streams on
          the right (high-frequency ones are throttled).
        </span>
      </div>
      <div className="split">
        <div className="split__main">
          <FlowCanvas<Node<FlowNodeData>, Edge>
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={FLOW_NODE_TYPES}
            onNodeClick={(_event: React.MouseEvent, node: Node) => {
              push('node:click', node.id, 'accent');
              flash(`.react-flow__node[data-id="${node.id}"]`);
            }}
            onNodeDoubleClick={(_event: React.MouseEvent, node: Node) => push('node:dblclick', node.id, 'accent')}
            onNodeContextMenu={(event: React.MouseEvent, node: Node) => {
              event.preventDefault();
              push('node:contextmenu', node.id, 'accent');
            }}
            onNodeMouseEnter={(_event: React.MouseEvent, node: Node) =>
              throttle('n-enter', THROTTLE_MS, () => push('node:mouseenter', node.id))
            }
            onNodeMouseLeave={(_event: React.MouseEvent, node: Node) =>
              throttle('n-leave', THROTTLE_MS, () => push('node:mouseleave', node.id))
            }
            onNodeDragStart={(_event: MouseEvent | TouchEvent, node: Node) => push('node:dragstart', node.id)}
            onNodeDrag={(_event: MouseEvent | TouchEvent, node: Node) =>
              throttle(`drag:${node.id}`, THROTTLE_MS, () => push('node:drag', node.id))
            }
            onNodeDragStop={(_event: MouseEvent | TouchEvent, node: Node) => push('node:dragstop', node.id)}
            onEdgeClick={(_event: React.MouseEvent, edge: Edge) => {
              push('edge:click', edge.id, 'accent');
              flash(`.react-flow__edge[data-id="${edge.id}"]`);
            }}
            onEdgeContextMenu={(event: React.MouseEvent, edge: Edge) => {
              event.preventDefault();
              push('edge:contextmenu', edge.id, 'accent');
            }}
            onEdgeMouseEnter={(_event: React.MouseEvent, edge: Edge) =>
              throttle('e-enter', THROTTLE_MS, () => push('edge:mouseenter', edge.id))
            }
            onEdgeMouseLeave={(_event: React.MouseEvent, edge: Edge) =>
              throttle('e-leave', THROTTLE_MS, () => push('edge:mouseleave', edge.id))
            }
            onConnect={(connection: Connection) => push('edge:connect', `${connection.source}→${connection.target}`, 'accent')}
            onSelectionChange={({ nodes: selectedNodes, edges: selectedEdges }) =>
              throttle('sel', THROTTLE_MS, () =>
                push('selection:change', `${selectedNodes.length}n · ${selectedEdges.length}e`)
              )
            }
            onPaneClick={() => push('pane:click')}
            onPaneContextMenu={(event: MouseEvent | React.MouseEvent) => {
              event.preventDefault();
              push('pane:contextmenu', undefined, 'accent');
            }}
            onMoveStart={() => throttle('move-start', THROTTLE_MS, () => push('viewport:movestart'))}
            onMove={() => throttle('move', THROTTLE_MS, () => push('viewport:move'))}
            onMoveEnd={() => throttle('move-end', THROTTLE_MS, () => push('viewport:moveend'))}
          />
        </div>
        <EventLog log={log} />
      </div>
    </div>
  );
}

/** Demo g (React Flow) — a live inspector of every supported diagram event. */
export function FlowEventsDemo(): ReactNode {
  return (
    <ReactFlowProvider>
      <EventsStage />
    </ReactFlowProvider>
  );
}
