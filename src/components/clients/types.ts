export type ClientForm = {
  name: string; company_name: string; cnpj: string; cpf: string
  email: string; phone: string; subscribed_product: string
  subscribed_product_custom: string; notes: string; sistema: string
}

export interface ExtendedClient {
  id: string; name: string; company_name: string | null; cnpj: string | null
  cpf: string | null; email: string | null; phone: string | null
  subscribed_product: string | null; subscribed_product_custom: string | null
  notes: string | null; created_at: string; updated_at: string
  sistema?: string | null; plan_level?: string | null; churn_risk?: boolean | null
  support_eligible?: boolean | null; support_block_reason?: string | null
  gl_status_mais_simples?: string | null; gl_status_maxpro?: string | null
  gl_license_id?: number | null; gl_source_system?: string | null
}

export type ContactForm = {
  name: string; role: string; phone: string; email: string; is_primary: boolean
}

export type ContractForm = {
  contract_number: string; plan_name: string; status: string
  start_date: string; end_date: string; value: string; notes: string
}
