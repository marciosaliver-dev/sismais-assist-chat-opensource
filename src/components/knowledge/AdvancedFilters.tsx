import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Search, Sparkles, X, Filter,
  BarChart3
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface AdvancedFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  categoryFilter: string
  onCategoryChange: (value: string) => void
  typeFilter: string
  onTypeChange: (value: string) => void
  visibilityFilter: string
  onVisibilityChange: (value: string) => void
  isSemanticMode: boolean
  onSemanticModeChange: (value: boolean) => void
  isSearching: boolean
  searchResultsCount?: number
  stats?: {
    total: number
    viewsToday?: number
    topSearches?: { query: string; count: number }[]
  }
}

const TEMPLATES = [
  { value: 'all', label: 'Todos' },
  { value: 'how-to', label: 'Como Fazer' },
  { value: 'faq', label: 'FAQ' },
  { value: 'troubleshooting', label: 'Problema' },
  { value: 'tutorial', label: 'Tutorial' },
  { value: 'release-notes', label: 'Release' },
  { value: 'policy', label: 'Política' },
]

export function AdvancedFilters({
  search,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
  typeFilter,
  onTypeChange,
  visibilityFilter,
  onVisibilityChange,
  isSemanticMode,
  onSemanticModeChange,
  isSearching,
  searchResultsCount,
  stats
}: AdvancedFiltersProps) {
  const [showInsights, setShowInsights] = useState(false)
  const [expandedSection, setExpandedSection] = useState<string | null>(null)

  return (
    <div className="space-y-3">
      {/* Main Search Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          {isSemanticMode ? (
            <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#45E5E5] animate-pulse" />
          ) : (
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          )}
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={isSemanticMode ? "Pergunte em linguagem natural..." : "Buscar documentos, tags, títulos..."}
            className={cn(
              "pl-10 pr-10",
              isSemanticMode && "border-[#45E5E5] bg-[#E8F9F9]/30 ring-1 ring-[#45E5E5]/20"
            )}
          />
          {search && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 hover:bg-muted rounded-full p-1"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            variant={isSemanticMode ? "default" : "outline"}
            onClick={() => onSemanticModeChange(!isSemanticMode)}
            className={cn(
              "gap-2",
              isSemanticMode && "bg-[#45E5E5] text-[#10293F] hover:bg-[#2ecece]"
            )}
          >
            <Sparkles className="w-4 h-4" />
            IA
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowInsights(!showInsights)}
            className={cn(showInsights && "bg-[#E8F9F9] border-[#45E5E5]")}
          >
            <BarChart3 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Quick Filters Row */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Category */}
        <div className="flex gap-1">
          {TEMPLATES.slice(0, 5).map((template) => (
            <button
              key={template.value}
              onClick={() => onCategoryChange(template.value)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                categoryFilter === template.value
                  ? "bg-[#10293F] text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {template.label}
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-border" />

        {/* Type filter */}
        <select
          value={typeFilter}
          onChange={(e) => onTypeChange(e.target.value)}
          className="px-3 py-1 rounded-full text-xs font-medium bg-muted border-0 cursor-pointer"
        >
          <option value="all">Todos formatos</option>
          <option value="text">Texto</option>
          <option value="video">Vídeo</option>
          <option value="link">Link</option>
          <option value="pdf">PDF</option>
        </select>
      </div>

      {/* Semantic Search Status */}
      {isSemanticMode && (
        <div className="flex items-center gap-2 text-sm">
          {isSearching ? (
            <div className="flex items-center gap-2 text-[#45E5E5]">
              <Sparkles className="w-4 h-4 animate-spin" />
              <span>Pensando...</span>
            </div>
          ) : searchResultsCount !== undefined ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Sparkles className="w-4 h-4 text-[#45E5E5]" />
              <span>{searchResultsCount} resultado{searchResultsCount !== 1 ? 's' : ''} encontrado{searchResultsCount !== 1 ? 's' : ''}</span>
              {searchResultsCount > 0 && (
                <Badge variant="outline" className="text-[10px] bg-[#E8F9F9]">
                  IA
                </Badge>
              )}
            </div>
          ) : search.length > 0 && search.length < 3 ? (
            <span className="text-xs text-muted-foreground">
              Digite pelo menos 3 caracteres para buscar
            </span>
          ) : null}
        </div>
      )}

      {/* Insights Panel */}
      {showInsights && stats && (
        <Card className="bg-gradient-to-br from-[#10293F] to-[#1a3d5c] text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#45E5E5]" />
              Insights da Base de Conhecimento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <div className="text-2xl font-bold text-[#45E5E5]">{stats.total}</div>
                <div className="text-xs text-white/60">Total artigos</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[#45E5E5]">{stats.viewsToday || 0}</div>
                <div className="text-xs text-white/60">Views hoje</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[#45E5E5]">
                  {stats.topSearches?.slice(0, 3).map(s => s.count).reduce((a, b) => a + b, 0) || 0}
                </div>
                <div className="text-xs text-white/60">Buscas hoje</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[#45E5E5]">
                  {stats.topSearches && stats.topSearches.length > 0 ? stats.topSearches[0].query.substring(0, 10) : '-'}
                </div>
                <div className="text-xs text-white/60">Top busca</div>
              </div>
            </div>

            {stats.topSearches && stats.topSearches.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="text-xs text-white/40 mb-2">BUSCAS POPULARES</div>
                <div className="space-y-1">
                  {stats.topSearches.slice(0, 5).map((s, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-white/80 truncate">{s.query}</span>
                      <Badge className="bg-white/10 text-white/80">{s.count}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}