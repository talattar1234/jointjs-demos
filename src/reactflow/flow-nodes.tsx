import type { ReactNode } from 'react';
import type { Node, NodeProps, NodeTypes } from '@xyflow/react';

import type { FlowNodeData } from '../data/sample-graph.ts';
import type { ScaleNodeData } from '../data/scale.ts';

/**
 * The shared flow-node renderer. Reuses the exact `.flow-node` CSS from the
 * JointJS side (those classes are not JointJS-scoped), so both tabs look
 * identical. Edges are floating, so this node needs no handles.
 */
export function FlowNodeView({ data }: NodeProps<Node<FlowNodeData>>): ReactNode {
  const isAlerting = data.alert === true;
  const className = `flow-node flow-node--${data.kind}${isAlerting ? ' flow-node--alert' : ''}`;
  return (
    <div className={className}>
      <span className="flow-node__kind">{data.kind}</span>
      <span className="flow-node__label">{data.label}</span>
    </div>
  );
}

/** A single generated node for the scale test — the cheapest possible markup. */
export function ScaleNodeView({ data }: NodeProps<Node<ScaleNodeData>>): ReactNode {
  return (
    <div className="rf-scale-node" style={{ background: `hsl(${data.hue} 70% 58%)` }}>
      <span className="rf-scale-node__label">{data.label}</span>
    </div>
  );
}

/** Node-type maps (module constants so React Flow keeps a stable identity). */
export const FLOW_NODE_TYPES: NodeTypes = { flow: FlowNodeView };
export const SCALE_NODE_TYPES: NodeTypes = { scale: ScaleNodeView };
