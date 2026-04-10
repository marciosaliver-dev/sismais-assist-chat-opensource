import { memo } from 'react'
import { type EdgeProps, getBezierPath } from 'reactflow'

function CustomEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
  markerEnd,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  return (
    <>
      <path
        id={id}
        style={{ strokeWidth: 2, stroke: '#64748b', ...style }}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
      />
      {data?.label && (
        <foreignObject
          width={80}
          height={24}
          x={labelX - 40}
          y={labelY - 12}
          requiredExtensions="http://www.w3.org/1999/xhtml"
        >
          <div className="flex items-center justify-center w-full h-full">
            <span className="bg-card border border-border rounded px-2 py-0.5 text-xs text-muted-foreground font-medium shadow-sm">
              {data.label}
            </span>
          </div>
        </foreignObject>
      )}
    </>
  )
}

export const CustomEdge = memo(CustomEdgeComponent)

export const edgeTypes = {
  custom: CustomEdge,
}
