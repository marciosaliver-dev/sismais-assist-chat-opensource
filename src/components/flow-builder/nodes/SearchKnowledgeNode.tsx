import { memo } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { Search } from 'lucide-react'

function SearchKnowledgeNodeComponent({ data }: NodeProps) {
  return (
    <div className="rounded-xl border-2 border-emerald-500/50 bg-emerald-500/10 p-3 min-w-[180px] shadow-lg">
      <Handle type="target" position={Position.Top} className="!bg-emerald-500 !w-3 !h-3" />
      <div className="flex items-center gap-2 mb-1">
        <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center">
          <Search className="w-4 h-4 text-white" />
        </div>
        <span className="text-xs font-bold text-emerald-400 uppercase">RAG Search</span>
      </div>
      <p className="text-xs text-foreground/80 truncate max-w-[160px]">
        {data.config?.query || 'Configurar query...'}
      </p>
      <Handle type="source" position={Position.Bottom} className="!bg-emerald-500 !w-3 !h-3" />
    </div>
  )
}

export const SearchKnowledgeNode = memo(SearchKnowledgeNodeComponent)
