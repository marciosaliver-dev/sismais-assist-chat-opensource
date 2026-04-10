import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Search, FileText, Plus } from 'lucide-react'
import { mockKBArticles } from '../mockData'
import type { AtendimentoTicket } from '../types'

interface Props {
  ticket: AtendimentoTicket
}

export function BaseTab({ ticket }: Props) {
  const [search, setSearch] = useState('')

  const filtered = search
    ? mockKBArticles.filter(a =>
        a.title.toLowerCase().includes(search.toLowerCase()) ||
        a.excerpt.toLowerCase().includes(search.toLowerCase())
      )
    : mockKBArticles

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      <h3 className="text-[12px] font-semibold text-[var(--gms-navy)] font-[Poppins]">Base de Conhecimento</h3>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--gms-g500)]" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar artigos..."
          className="w-full h-9 pl-8 pr-3 text-[12px] text-[var(--gms-g900)] placeholder:text-[var(--gms-g300)] border border-[var(--gms-g200)] rounded-lg outline-none focus:border-[var(--gms-cyan)] focus:ring-2 focus:ring-[var(--gms-cyan)]/15 transition-colors"
        />
      </div>

      {/* Articles */}
      <div className="space-y-2">
        {filtered.map(article => (
          <div
            key={article.id}
            className="flex items-start gap-2.5 p-2.5 border border-[var(--gms-g200)] rounded-lg hover:bg-[var(--gms-g100)]/50 cursor-pointer transition-colors group"
          >
            <FileText className="w-5 h-5 text-[var(--gms-cyan-dark)] flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-[var(--gms-navy)]">{article.title}</p>
              <p className="text-xs text-[var(--gms-g500)] mt-0.5 line-clamp-2">{article.excerpt}</p>
              <div className="flex gap-1 mt-1.5">
                {article.tags.map(tag => (
                  <span key={tag} className="px-1.5 py-0.5 rounded-full text-[9px] text-[var(--gms-g700)] bg-[var(--gms-g100)] border border-[var(--gms-g200)]">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <span className={cn(
                'text-xs font-bold',
                article.relevance >= 85 ? 'text-[var(--gms-ok)]' : article.relevance >= 70 ? 'text-[var(--gms-warn)]' : 'text-[var(--gms-g500)]',
              )}>
                {article.relevance}%
              </span>
              <button
                className="opacity-0 group-hover:opacity-100 transition-opacity px-2 py-0.5 rounded text-[9px] font-medium bg-[var(--gms-cyan-light)] text-[var(--gms-navy)] hover:bg-[var(--gms-cyan)]/20"
                aria-label={`Inserir artigo ${article.title}`}
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-6">
            <p className="text-[12px] text-[var(--gms-g500)]">Nenhum artigo encontrado</p>
          </div>
        )}
      </div>
    </div>
  )
}
