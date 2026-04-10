import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Search, Command, FileText, Link, Video, 
  X, ArrowRight, Sparkles, Clock, Brain,
  CornerDownLeft, Hash
} from 'lucide-react'
import { useKnowledgeBase } from '@/hooks/useKnowledgeBase'
import { useKnowledgeProducts } from '@/hooks/useKnowledgeProducts'
import { cn } from '@/lib/utils'

interface DocResult {
  id: string
  title: string
  category: string
  content_type: string
  usage_count: number
}

interface OmnibarContentProps {
  query: string
  setQuery: (q: string) => void
  results: DocResult[]
  selectedIndex: number
  isSearching: boolean
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  handleSelectResult: (doc: DocResult) => void
  getIcon: (type: string) => React.ComponentType<{ className?: string }>
  inputRef: React.RefObject<HTMLInputElement>
}

function OmnibarContent({
  query, setQuery, results, selectedIndex, isSearching,
  setIsOpen, handleSelectResult, getIcon, inputRef
}: OmnibarContentProps) {
  return (
    <div className="flex flex-col">
      {/* Search input */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        {isSearching ? (
          <Sparkles className="w-5 h-5 text-[#45E5E5] animate-pulse" />
        ) : (
          <Search className="w-5 h-5 text-muted-foreground" />
        )}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar documentos, tutoriais, FAQs..."
          className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
          autoFocus
        />
        <button onClick={() => setIsOpen(false)}>
          <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
        </button>
      </div>

      {/* Results */}
      <div className="max-h-[400px] overflow-y-auto">
        {results.length > 0 ? (
          <div className="p-2">
            <div className="text-xs text-muted-foreground px-3 py-2 flex items-center gap-2">
              <Brain className="w-3 h-3" />
              Resultados por IA
            </div>
            {results.map((doc, index) => {
              const Icon = getIcon(doc.content_type)
              return (
                <button
                  key={doc.id}
                  onClick={() => handleSelectResult(doc)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                    index === selectedIndex ? "bg-[#E8F9F9]" : "hover:bg-muted"
                  )}
                >
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground truncate">{doc.title}</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-xs">{doc.category}</Badge>
                      <span>{doc.usage_count} usos</span>
                    </div>
                  </div>
                  {index === selectedIndex && (
                    <ArrowRight className="w-4 h-4 text-[#45E5E5]" />
                  )}
                </button>
              )
            })}
          </div>
        ) : query.length >= 2 ? (
          <div className="p-8 text-center">
            <p className="text-muted-foreground">Nenhum resultado encontrado</p>
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-muted-foreground">Digite para buscar...</p>
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <kbd className="bg-muted px-2 py-1 rounded">↑</kbd>
              <kbd className="bg-muted px-2 py-1 rounded">↓</kbd>
              <span>para navegar</span>
              <kbd className="bg-muted px-2 py-1 rounded">Enter</kbd>
              <span>para selecionar</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between p-3 border-t border-border bg-muted/30 text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <CornerDownLeft className="w-3 h-3" /> Enter para selecionar
          </span>
          <span className="flex items-center gap-1">
            <Hash className="w-3 h-3" /> Esc para fechar
          </span>
        </div>
        <span className="flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-[#45E5E5]" /> Busca semântica
        </span>
      </div>
    </div>
  )
}

interface KnowledgeOmnibarProps {
  trigger?: React.ReactNode
  onSelectDoc?: (docId: string) => void
}

export function KnowledgeOmnibar({ trigger, onSelectDoc }: KnowledgeOmnibarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<DocResult[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isSearching, setIsSearching] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const { semanticSearch } = useKnowledgeBase()
  const { products } = useKnowledgeProducts()

  // Keyboard shortcut to open (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(true)
      }
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Search on query change
  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      return
    }

    const searchTimeout = setTimeout(async () => {
      setIsSearching(true)
      try {
        // Try semantic search first
        const semanticResults = await semanticSearch(query, 'all')
        if (semanticResults && semanticResults.length > 0) {
          setResults(semanticResults as DocResult[])
        } else {
          // Fallback to basic search via products
          setResults([])
        }
      } catch (e) {
        console.error("Search error:", e)
        setResults([])
      } finally {
        setIsSearching(false)
      }
    }, 150)

    return () => clearTimeout(searchTimeout)
  }, [query])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyNav = (e: KeyboardEvent) => {
      if (!isOpen || results.length === 0) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(i => Math.min(i + 1, results.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(i => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        handleSelectResult(results[selectedIndex])
      }
    }
    window.addEventListener('keydown', handleKeyNav)
    return () => window.removeEventListener('keydown', handleKeyNav)
  }, [isOpen, results, selectedIndex])

  const handleSelectResult = (doc: DocResult) => {
    setIsOpen(false)
    setQuery('')
    if (onSelectDoc) {
      onSelectDoc(doc.id)
    } else {
      navigate(`/knowledge?doc=${doc.id}`)
    }
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'video': return Video
      case 'link': return Link
      case 'pdf': return FileText
      default: return FileText
    }
  }

  // Render trigger button if provided
  if (trigger) {
    return (
      <>
        <button
          onClick={() => setIsOpen(true)}
          className="w-full"
        >
          {trigger}
        </button>

        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
            <div className="fixed inset-0 bg-black/50" onClick={() => setIsOpen(false)} />
            <div className="relative w-full max-w-xl bg-card rounded-xl shadow-2xl border border-border overflow-hidden">
              <OmnibarContent query={query} setQuery={setQuery} results={results} selectedIndex={selectedIndex} isSearching={isSearching} isOpen={isOpen} setIsOpen={setIsOpen} handleSelectResult={handleSelectResult} getIcon={getIcon} inputRef={inputRef} />
            </div>
          </div>
        )}
      </>
    )
  }

  // Default: always show as modal
  if (!isOpen) {
    return (
      <Button
        variant="outline"
        onClick={() => setIsOpen(true)}
        className="gap-2 text-muted-foreground"
      >
        <Search className="w-4 h-4" />
        <span>Buscar na base...</span>
        <kbd className="ml-auto text-xs bg-muted px-2 py-0.5 rounded">⌘K</kbd>
      </Button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <div className="fixed inset-0 bg-black/50" onClick={() => setIsOpen(false)} />
      <div className="relative w-full max-w-xl bg-card rounded-xl shadow-2xl border border-border overflow-hidden">
        <OmnibarContent query={query} setQuery={setQuery} results={results} selectedIndex={selectedIndex} isSearching={isSearching} isOpen={isOpen} setIsOpen={setIsOpen} handleSelectResult={handleSelectResult} getIcon={getIcon} inputRef={inputRef} />
      </div>
    </div>
  )

}