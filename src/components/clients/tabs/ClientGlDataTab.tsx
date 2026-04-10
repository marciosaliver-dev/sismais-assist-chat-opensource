import type { ExtendedClient } from '../types'

interface GlData {
  engajamento?: string | null
  tag?: string | null
  dias_status_atual?: number | null
  dias_assinatura?: number | null
  ltv_dias?: number | null
  dt_inicio_assinatura?: string | null
  dias_instalacao?: number | null
  dias_ult_ver?: number | null
  dias_de_uso?: number | null
  qtd_login?: number | null
  ultimo_login?: string | null
  sistema_utilizado?: string | null
  id_plano?: number | null
  nome_segmento?: string | null
  cidade?: string | null
  uf?: string | null
  ultima_verificacao?: string | null
  crm_data_ultima_sicronizacao?: string | null
  dt_atualizacao?: string | null
}

interface ClientGlDataTabProps {
  client: ExtendedClient
  glData?: GlData | null
}

function GlField({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm text-foreground">{value ?? '—'}</span>
    </div>
  )
}

function GlSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h4 className="text-xs font-bold uppercase tracking-wider text-[#10293F] mb-3 pb-2 border-b border-border">
        {title}
      </h4>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {children}
      </div>
    </div>
  )
}

export function ClientGlDataTab({ client, glData }: ClientGlDataTabProps) {
  if (!glData && !client.gl_license_id) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p className="text-sm">Nenhum dado GL sincronizado para este cliente.</p>
        <p className="text-xs mt-1">Execute um Sync GL para importar os dados.</p>
      </div>
    )
  }

  const formatDate = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString('pt-BR') : null

  return (
    <div className="p-4 space-y-4 overflow-y-auto">
      <GlSection title="Uso do Sistema">
        <GlField label="Dias de Uso" value={glData?.dias_de_uso} />
        <GlField label="Dias Instalação" value={glData?.dias_instalacao} />
        <GlField label="Dias Ult. Verificação" value={glData?.dias_ult_ver} />
        <GlField label="Dias Status Atual" value={glData?.dias_status_atual} />
        <GlField label="Qtd. Logins" value={glData?.qtd_login} />
        <GlField label="Último Login" value={formatDate(glData?.ultimo_login)} />
      </GlSection>

      <GlSection title="Assinatura">
        <GlField label="Início Assinatura" value={formatDate(glData?.dt_inicio_assinatura)} />
        <GlField label="Dias Assinatura" value={glData?.dias_assinatura} />
        <GlField label="LTV (dias)" value={glData?.ltv_dias} />
        <GlField label="Plano (ID)" value={glData?.id_plano} />
        <GlField label="Sistema" value={glData?.sistema_utilizado ?? client.sistema} />
        <GlField label="Dias Status Atual" value={glData?.dias_status_atual} />
      </GlSection>

      <GlSection title="Localização & Segmento">
        <GlField label="Cidade" value={glData?.cidade} />
        <GlField label="UF" value={glData?.uf} />
        <GlField label="Segmento" value={glData?.nome_segmento} />
        <GlField label="Engajamento" value={glData?.engajamento} />
        <GlField label="Tag" value={glData?.tag} />
      </GlSection>

      <GlSection title="Sincronização">
        <GlField label="Última Verificação GL" value={formatDate(glData?.ultima_verificacao)} />
        <GlField label="CRM — Última Sync" value={formatDate(glData?.crm_data_ultima_sicronizacao)} />
        <GlField label="Atualizado em" value={formatDate(glData?.dt_atualizacao)} />
        <GlField label="GL License ID" value={client.gl_license_id} />
        <GlField label="Sistema GL" value={client.gl_source_system} />
      </GlSection>
    </div>
  )
}
