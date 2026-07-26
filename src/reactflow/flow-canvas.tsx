import type { ReactNode } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
  type ReactFlowProps,
} from '@xyflow/react';

import { useTheme } from '../app/theme.tsx';
import { EDGE_TYPES } from './flow-edges.tsx';

interface FlowCanvasProps<NodeType extends Node, EdgeType extends Edge>
  extends ReactFlowProps<NodeType, EdgeType> {
  /** Overlay UI rendered above the canvas (panels, legends). */
  readonly children?: ReactNode;
  /** Layer rendered behind the graph (e.g. a viewport-synced image underlay). */
  readonly underlay?: ReactNode;
  /** Show the minimap in the corner. @default false */
  readonly minimap?: boolean;
}

const PRO_OPTIONS = { hideAttribution: true } as const;

/**
 * The React Flow analogue of `DiagramCanvas`: a themed `<ReactFlow>` framed by
 * the shared `.canvas` chrome, with dotted background, zoom controls, and the
 * floating edge type wired in. Generic over the node/edge types so each demo's
 * typed state flows straight through; all other `<ReactFlow>` props pass through.
 */
export function FlowCanvas<NodeType extends Node = Node, EdgeType extends Edge = Edge>({
  children,
  underlay,
  minimap = false,
  ...flowProps
}: FlowCanvasProps<NodeType, EdgeType>): ReactNode {
  const { theme } = useTheme();

  return (
    <div className="canvas rf-canvas">
      {underlay}
      <ReactFlow<NodeType, EdgeType>
        minZoom={0.2}
        maxZoom={2.5}
        fitView
        proOptions={PRO_OPTIONS}
        {...flowProps}
        colorMode={theme}
        edgeTypes={EDGE_TYPES}
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1} />
        <Controls showInteractive={false} />
        {minimap && <MiniMap pannable zoomable />}
        {children}
      </ReactFlow>
    </div>
  );
}
