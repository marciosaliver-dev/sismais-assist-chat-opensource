export const PRODUCT_OPTIONS = [
  { value: 'mais_simples', label: 'Mais Simples' },
  { value: 'sismais_erp', label: 'Sismais ERP' },
  { value: 'sismais_pdv', label: 'Sismais PDV' },
  { value: 'sismais_os', label: 'Sismais O.S.' },
  { value: 'outro', label: 'Outro' },
]

export const PRODUCT_BG: Record<string, string> = {
  mais_simples: 'from-blue-500 to-blue-600',
  sismais_erp: 'from-emerald-500 to-emerald-600',
  sismais_pdv: 'from-purple-500 to-purple-600',
  sismais_os: 'from-amber-500 to-amber-600',
  outro: 'from-gray-500 to-gray-600',
}

export const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  resolved: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  closed: 'bg-muted text-muted-foreground',
  escalated: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
}

export const CONTRACT_STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  suspended: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
}

export const SISTEMA_OPTIONS = [
  { value: 'GMS Desktop', label: 'GMS Desktop' },
  { value: 'GMS Web', label: 'GMS Web' },
  { value: 'Maxpro', label: 'Maxpro' },
  { value: 'Outro', label: 'Outro' },
]

export const PLAN_LEVEL_COLORS: Record<string, string> = {
  Enterprise: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  Profissional: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  Basico: 'bg-muted text-muted-foreground',
}

export const TIER_COLORS: Record<string, string> = {
  platinum: 'bg-[#10293F] text-[#45E5E5]',
  gold: 'bg-[#FFB800] text-[#10293F]',
  silver: 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  bronze: 'bg-amber-100 text-amber-800',
}

export const EVENT_TYPE_CHIPS = [
  { value: 'message', label: 'Mensagens' },
  { value: 'ticket_created', label: 'Tickets' },
  { value: 'ticket_resolved', label: 'Resolvidos' },
  { value: 'payment', label: 'Pagamentos' },
  { value: 'contract_change', label: 'Contratos' },
  { value: 'annotation', label: 'Notas' },
  { value: 'system', label: 'Sistema' },
]

export const CHANNEL_CHIPS = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'web', label: 'Web' },
  { value: 'phone', label: 'Telefone' },
  { value: 'email', label: 'E-mail' },
]

export const productLabel = (v: string) => PRODUCT_OPTIONS.find(p => p.value === v)?.label || v
