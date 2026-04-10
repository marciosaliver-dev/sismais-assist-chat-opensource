import { cn } from '@/lib/utils'
import { Bot, Sparkles, FileText, Send, Pencil } from 'lucide-react'
import { mockAISuggestions, mockKBArticles } from '../mockData'
import type { AtendimentoTicket } from '../types'

interface Props {
  ticket: AtendimentoTicket
}

export function IATab({ ticket }: Props) {
  return (
    <div className="p-4 space-y-5 overflow-y-auto h-full">
      {/* Configuração da IA */}
      <section>
        <h3 className="text-[12px] font-semibold text-[var(--gms-navy)] mb-3 font-[Poppins]">Configuração da IA</h3>
        <div className="space-y-2">
          <Row label="Modo de IA">
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--gms-purple)]/10 text-[var(--gms-purple)] border border-[var(--gms-purple)]/30">
              Assistente
            </span>
          </Row>
          <Row label="Especialidade">
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--gms-info-bg)] text-[var(--gms-info)] border border-[var(--gms-info)]/30">
              Suporte Geral
            </span>
          </Row>
          <Row label="Confiança">
            <span className={cn(
              'px-2 py-0.5 rounded-full text-xs font-semibold border',
              (ticket.aiConfidence ?? 0) >= 80 ? 'bg-[var(--gms-ok-bg)] text-[var(--gms-ok)] border-[var(--gms-ok)]/30'
                : (ticket.aiConfidence ?? 0) >= 60 ? 'bg-[var(--gms-yellow-bg)] text-[var(--gms-warn)] border-[var(--gms-yellow)]/30'
                  : 'bg-[var(--gms-err-bg)] text-[var(--gms-err)] border-[var(--gms-err)]/30',
            )}>
              {ticket.aiConfidence ?? 0}%
            </span>
          </Row>
        </div>
      </section>

      {/* Sugestão da IA */}
      <section>
        <h3 className="text-[12px] font-semibold text-[var(--gms-navy)] mb-3 font-[Poppins]">Sugestão da IA</h3>
        {mockAISuggestions.slice(0, 1).map(suggestion => (
          <div key={suggestion.id} className="border border-[var(--gms-cyan)]/30 rounded-lg p-3 bg-[var(--gms-cyan-light)]/30">
            <div className="flex items-center gap-1 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-[var(--gms-cyan-dark)]" />
              <span className="text-xs font-semibold text-[var(--gms-cyan-dark)]">
                Confiança: {suggestion.confidence}%
              </span>
            </div>
            <p className="text-[12px] text-[var(--gms-g900)] leading-relaxed mb-3">{suggestion.content}</p>
            <div className="flex gap-2">
              <button className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-[var(--gms-cyan-light)] border border-[var(--gms-cyan)] text-[var(--gms-navy)] text-xs font-semibold hover:bg-[var(--gms-cyan)]/20 transition-colors">
                <Send className="w-3 h-3" />
                Enviar
              </button>
              <button className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-[var(--gms-g200)] text-[var(--gms-g700)] text-xs font-medium hover:bg-[var(--gms-g100)] transition-colors">
                <Pencil className="w-3 h-3" />
                Editar
              </button>
            </div>
          </div>
        ))}
      </section>

      {/* Contexto RAG */}
      <section>
        <h3 className="text-[12px] font-semibold text-[var(--gms-navy)] mb-3 font-[Poppins]">Contexto RAG</h3>
        <div className="space-y-2">
          {mockKBArticles.slice(0, 3).map(article => (
            <div key={article.id} className="flex items-start gap-2 p-2 rounded-lg hover:bg-[var(--gms-g100)] transition-colors">
              <FileText className="w-4 h-4 text-[var(--gms-cyan-dark)] flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-[var(--gms-navy)] truncate">{article.title}</p>
                <p className="text-xs text-[var(--gms-g500)] truncate">{article.excerpt}</p>
              </div>
              <span className={cn(
                'text-xs font-bold flex-shrink-0',
                article.relevance >= 85 ? 'text-[var(--gms-ok)]' : article.relevance >= 70 ? 'text-[var(--gms-warn)]' : 'text-[var(--gms-g500)]',
              )}>
                {article.relevance}%
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-[var(--gms-g200)]/50 last:border-0">
      <span className="text-xs text-[var(--gms-g500)]">{label}</span>
      {children}
    </div>
  )
}
