import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Ticket, Sparkles, Building2, History, BookOpen, BarChart3 } from 'lucide-react'
import { TicketTab } from './tabs/TicketTab'
import { IATab } from './tabs/IATab'
import { ClienteTab } from './tabs/ClienteTab'
import { HistoricoTab } from './tabs/HistoricoTab'
import { BaseTab } from './tabs/BaseTab'
import { RelatorioTab } from './tabs/RelatorioTab'
import type { AtendimentoTicket } from './types'

interface Props {
  ticket: AtendimentoTicket
  compact?: boolean
}

const tabs = [
  { value: 'ticket', label: 'Ticket', icon: Ticket },
  { value: 'ia', label: 'IA', icon: Sparkles },
  { value: 'cliente', label: 'Cliente', icon: Building2 },
  { value: 'historico', label: 'Histórico', icon: History },
  { value: 'base', label: 'Base', icon: BookOpen },
  { value: 'relatorio', label: 'Relatório', icon: BarChart3 },
]

export function DetailTabs({ ticket, compact }: Props) {
  return (
    <Tabs defaultValue="ticket" className="h-full flex flex-col">
      <TabsList className="w-full h-auto p-0 bg-white border-b border-[var(--gms-g200)] rounded-none flex-shrink-0">
        {tabs.map(tab => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className="flex-1 flex flex-col items-center gap-0.5 py-2.5 px-1 rounded-none border-b-2 border-transparent data-[state=active]:border-b-[var(--gms-cyan)] data-[state=active]:text-[var(--gms-navy)] data-[state=active]:font-semibold text-[var(--gms-g500)] data-[state=active]:shadow-none bg-transparent hover:bg-[var(--gms-bg)] transition-colors"
          >
            <tab.icon className="w-[18px] h-[18px]" />
            <span className="text-[9px] leading-none">{tab.label}</span>
          </TabsTrigger>
        ))}
      </TabsList>

      <div className="flex-1 overflow-hidden">
        <TabsContent value="ticket" className="h-full m-0">
          <TicketTab ticket={ticket} />
        </TabsContent>
        <TabsContent value="ia" className="h-full m-0">
          <IATab ticket={ticket} />
        </TabsContent>
        <TabsContent value="cliente" className="h-full m-0">
          <ClienteTab ticket={ticket} />
        </TabsContent>
        <TabsContent value="historico" className="h-full m-0">
          <HistoricoTab ticket={ticket} />
        </TabsContent>
        <TabsContent value="base" className="h-full m-0">
          <BaseTab ticket={ticket} />
        </TabsContent>
        <TabsContent value="relatorio" className="h-full m-0">
          <RelatorioTab ticket={ticket} />
        </TabsContent>
      </div>
    </Tabs>
  )
}
