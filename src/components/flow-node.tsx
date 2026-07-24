import type { ReactNode } from 'react';
import { HTMLBox } from '@joint/react';

import type { FlowNodeData } from '../data/sample-graph.ts';

/**
 * The shared element renderer for the interactive demos. Selection is applied
 * by {@link SelectionLayer} (an `is-selected` class on the cell view), and the
 * `alert` flag drives the motion-safe pulsing state (demo a).
 */
export function FlowNode({ data }: Readonly<{ data: FlowNodeData }>): ReactNode {
  const className = `flow-node flow-node--${data.kind}${data.alert === true ? ' flow-node--alert' : ''}`;
  return (
    <HTMLBox useModelGeometry className={className}>
      <span className="flow-node__kind">{data.kind}</span>
      <span className="flow-node__label">{data.label}</span>
    </HTMLBox>
  );
}
