import type { ReactNode } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  Position,
  useInternalNode,
  type EdgeProps,
  type EdgeTypes,
  type InternalNode,
} from '@xyflow/react';

/**
 * Floating edges: instead of anchoring to a fixed handle, each endpoint is the
 * point where the straight line between the two node centers crosses the node
 * boundary. This keeps every demo's edges tidy regardless of node layout —
 * the JointJS side gets the same effect for free from its orthogonal router.
 * The intersection math is the canonical React Flow floating-edge utility.
 */
function getNodeIntersection(node: InternalNode, other: InternalNode): { x: number; y: number } {
  const w = (node.measured.width ?? 0) / 2;
  const h = (node.measured.height ?? 0) / 2;
  const nodePos = node.internals.positionAbsolute;
  const otherPos = other.internals.positionAbsolute;

  const x2 = nodePos.x + w;
  const y2 = nodePos.y + h;
  const x1 = otherPos.x + (other.measured.width ?? 0) / 2;
  const y1 = otherPos.y + (other.measured.height ?? 0) / 2;

  const xx1 = (x1 - x2) / (2 * w) - (y1 - y2) / (2 * h);
  const yy1 = (x1 - x2) / (2 * w) + (y1 - y2) / (2 * h);
  const a = 1 / (Math.abs(xx1) + Math.abs(yy1) || 1);
  const xx3 = a * xx1;
  const yy3 = a * yy1;

  return { x: w * (xx3 + yy3) + x2, y: h * (-xx3 + yy3) + y2 };
}

/** Which side of `node` the intersection point sits on (for the bezier tangent). */
function getEdgePosition(node: InternalNode, point: { x: number; y: number }): Position {
  const pos = node.internals.positionAbsolute;
  const nx = Math.round(pos.x);
  const ny = Math.round(pos.y);
  const px = Math.round(point.x);
  const py = Math.round(point.y);
  const width = node.measured.width ?? 0;
  const height = node.measured.height ?? 0;

  if (px <= nx + 1) {
    return Position.Left;
  }
  if (px >= nx + width - 1) {
    return Position.Right;
  }
  if (py <= ny + 1) {
    return Position.Top;
  }
  if (py >= ny + height - 1) {
    return Position.Bottom;
  }
  return Position.Top;
}

interface EdgeGeometry {
  readonly sx: number;
  readonly sy: number;
  readonly tx: number;
  readonly ty: number;
  readonly sourcePos: Position;
  readonly targetPos: Position;
}

function getEdgeParams(source: InternalNode, target: InternalNode): EdgeGeometry {
  const sourcePoint = getNodeIntersection(source, target);
  const targetPoint = getNodeIntersection(target, source);
  return {
    sx: sourcePoint.x,
    sy: sourcePoint.y,
    tx: targetPoint.x,
    ty: targetPoint.y,
    sourcePos: getEdgePosition(source, sourcePoint),
    targetPos: getEdgePosition(target, targetPoint),
  };
}

/** A boundary-to-boundary bezier edge with an optional centered HTML label. */
export function FloatingEdge({ id, source, target, markerEnd, style, data }: EdgeProps): ReactNode {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  if (sourceNode === undefined || targetNode === undefined) {
    return null;
  }

  const { sx, sy, tx, ty, sourcePos, targetPos } = getEdgeParams(sourceNode, targetNode);
  const [path, labelX, labelY] = getBezierPath({
    sourceX: sx,
    sourceY: sy,
    sourcePosition: sourcePos,
    targetX: tx,
    targetY: ty,
    targetPosition: targetPos,
  });

  const label = typeof data?.label === 'string' ? data.label : undefined;

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />
      {label !== undefined && (
        <EdgeLabelRenderer>
          <div
            className="rf-edge-label nodrag nopan"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

/** Registered once and shared by every demo through {@link FlowCanvas}. */
export const EDGE_TYPES: EdgeTypes = { floating: FloatingEdge };
