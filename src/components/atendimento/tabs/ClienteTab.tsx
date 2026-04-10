import { Building2, Phone, Mail, Hash, ExternalLink, Unlink, RefreshCw } from 'lucide-react'
import type { AtendimentoTicket } from '../types'

interface Props {
  ticket: AtendimentoTicket
}

export function ClienteTab({ ticket }: Props) {
  const client = ticket.client

  if (!client) {
    return (
      <div className="p-4 flex flex-col items-center justify-center h-full text-center">
        <Building2 className="w-10 h-10 text-[var(--gms-g300)] mb-3" />
        <p className="text-[13px] font-medium text-[var(--gms-g700)]">Nenhum cliente vinculado</p>
        <p className="text-xs text-[var(--gms-g500)] mt-1">Vincule um cliente a este atendimento</p>
        <button className="mt-3 px-4 py-2 rounded-md bg-[var(--gms-cyan)] text-[var(--gms-navy)] text-[12px] font-semibold hover:bg-[var(--gms-cyan-hover)] transition-colors">
          Vincular Cliente
        </button>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-5 overflow-y-auto h-full">
      {/* Cliente Vinculado */}
      <section className="border border-[var(--gms-g200)] rounded-lg p-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-[var(--gms-navy)] text-white flex items-center justify-center text-[13px] font-bold flex-shrink-0">
            {ticket.customerInitials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-[var(--gms-navy)]">{client.name}</p>
            {client.companyName && (
              <p className="text-xs text-[var(--gms-g500)]">{client.companyName}</p>
            )}
            <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[9px] font-semibold bg-[var(--gms-g100)] text-[var(--gms-g700)] border border-[var(--gms-g200)]">
              Cliente
            </span>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          <InfoRow icon={Phone} label={client.phone || ticket.customerPhone} />
          {client.email && <InfoRow icon={Mail} label={client.email} />}
          {client.cnpj && <InfoRow icon={Hash} label={client.cnpj} />}
        </div>

        <div className="flex gap-2 mt-3">
          <button className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-md border border-[var(--gms-g200)] text-[var(--gms-g700)] text-xs font-medium hover:bg-[var(--gms-g100)] transition-colors">
            <ExternalLink className="w-3 h-3" />
            Ver Ficha
          </button>
          <button className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-md border border-[var(--gms-err)]/30 text-[var(--gms-err)] text-xs font-medium hover:bg-[var(--gms-err-bg)] transition-colors">
            <Unlink className="w-3 h-3" />
            Desvincular
          </button>
        </div>
      </section>

      {/* Status da Licença */}
      <section>
        <h3 className="text-[12px] font-semibold text-[var(--gms-navy)] mb-2 font-[Poppins]">Status da Licença</h3>
        <div className="flex items-center justify-between p-2.5 bg-[var(--gms-g100)] rounded-lg">
          <div>
            <span className="text-xs text-[var(--gms-g500)]">Status</span>
            <div className="mt-0.5">
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--gms-ok-bg)] text-[var(--gms-ok)] border border-[var(--gms-ok)]/30">
                {client.licenseStatus || 'Desconhecido'}
              </span>
            </div>
          </div>
          <div>
            <span className="text-xs text-[var(--gms-g500)]">Produto</span>
            <p className="text-[12px] font-medium text-[var(--gms-navy)] mt-0.5">{client.product || '—'}</p>
          </div>
          <button className="p-1.5 rounded-md hover:bg-[var(--gms-g200)] transition-colors" aria-label="Sincronizar status">
            <RefreshCw className="w-4 h-4 text-[var(--gms-g500)]" />
          </button>
        </div>
      </section>

      {/* Contratos */}
      <section>
        <h3 className="text-[12px] font-semibold text-[var(--gms-navy)] mb-2 font-[Poppins]">Contratos e Planos</h3>
        <div className="space-y-2">
          <button className="w-full px-3 py-2 rounded-md border border-[var(--gms-g200)] text-[var(--gms-g700)] text-xs font-medium hover:bg-[var(--gms-g100)] transition-colors text-left">
            Buscar Contratos
          </button>
          <button className="w-full px-3 py-2 rounded-md border border-[var(--gms-g200)] text-[var(--gms-g700)] text-xs font-medium hover:bg-[var(--gms-g100)] transition-colors text-left">
            Sincronizar com Admin
          </button>
        </div>
      </section>
    </div>
  )
}

function InfoRow({ icon: Icon, label }: { icon: typeof Phone; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-3.5 h-3.5 text-[var(--gms-g500)]" />
      <span className="text-[12px] text-[var(--gms-g900)]">{label}</span>
    </div>
  )
}
