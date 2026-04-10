import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Send, Upload, Smile, Meh, Frown, Angry, Bot, BookOpen, PlayCircle, Info, ChevronRight } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { HelpHeader } from '@/components/help/HelpHeader'
import { HelpFloatingChat } from '@/components/help/HelpFloatingChat'
import { cn } from '@/lib/utils'

const MODULES = [
  'Vendas PDV',
  'Financeiro',
  'Estoque',
  'Fiscal',
  'Cadastros',
  'Relatórios',
  'Configurações',
  'Outro',
]

const PRIORITIES = [
  { key: 'low', label: 'Baixa', icon: Smile, color: 'text-green-500', selectedColor: 'text-gms-cyan' },
  { key: 'medium', label: 'Média', icon: Meh, color: 'text-yellow-500', selectedColor: 'text-gms-cyan' },
  { key: 'high', label: 'Alta', icon: Frown, color: 'text-orange-500', selectedColor: 'text-gms-cyan' },
  { key: 'critical', label: 'Crítica', icon: Angry, color: 'text-red-500', selectedColor: 'text-gms-cyan' },
] as const

type Priority = typeof PRIORITIES[number]['key']

interface FormData {
  module: string
  subject: string
  description: string
  system_version: string
  occurred_at: string
  contact_name: string
  contact_email: string
  contact_phone: string
}

export default function HelpOpenTicket() {
  const navigate = useNavigate()
  const [selectedPriority, setSelectedPriority] = useState<Priority>('medium')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<FormData>({
    module: '',
    subject: '',
    description: '',
    system_version: 'GMS 4.2.1',
    occurred_at: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
  })

  const updateField = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.module || !formData.subject || !formData.description || !formData.contact_name || !formData.contact_email) {
      toast.error('Preencha todos os campos obrigatórios.')
      return
    }

    setIsSubmitting(true)
    try {
      const { error } = await supabase.from('help_tickets').insert({
        subject: `[${formData.module}] ${formData.subject}`,
        description: formData.description,
        status: 'open',
        priority: selectedPriority,
        contact_name: formData.contact_name,
        contact_email: formData.contact_email,
        contact_phone: formData.contact_phone || null,
      })

      if (error) throw error

      toast.success('Chamado enviado com sucesso! Você receberá uma confirmação por e-mail.')
      navigate('/help/tickets')
    } catch (err: any) {
      toast.error('Erro ao enviar chamado. Tente novamente.')
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <HelpHeader />

      {/* Page Header */}
      <div className="bg-gms-navy px-5 py-8">
        <div className="max-w-[800px] mx-auto">
          <nav className="flex items-center gap-1.5 text-[13px] text-white/55 mb-3">
            <Link to="/help-center" className="hover:text-white/80 transition-colors">Início</Link>
            <ChevronRight className="w-3.5 h-3.5 text-white/30" />
            <Link to="/help/tickets" className="hover:text-white/80 transition-colors">Meus Chamados</Link>
            <ChevronRight className="w-3.5 h-3.5 text-white/30" />
            <span className="text-white font-medium">Abrir Chamado</span>
          </nav>
          <h1 className="text-white font-display font-bold text-xl">Abrir Novo Chamado</h1>
          <p className="text-white/60 text-sm mt-1">
            Preencha as informações abaixo e nossa equipe retornará em até 2 horas.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-[800px] mx-auto px-5 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
          {/* Left — Form Card */}
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gms-g200 overflow-hidden">
            <div className="px-6 pt-6 pb-4 border-b border-gms-g200">
              <h2 className="text-gms-g900 font-display font-semibold text-base">Detalhes do Chamado</h2>
              <p className="text-gms-g500 text-[13px] mt-0.5">Quanto mais detalhes, mais rápido resolveremos.</p>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Módulo */}
              <div>
                <label className="block text-[13px] font-medium text-gms-g900 mb-1.5">
                  Módulo / Área <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.module}
                  onChange={e => updateField('module', e.target.value)}
                  className="w-full h-[38px] px-3 border border-gms-g300 rounded-md text-[13px] text-gms-g900 bg-white outline-none transition-all focus:border-gms-cyan focus:ring-2 focus:ring-gms-cyan/15"
                >
                  <option value="">Selecione o módulo...</option>
                  {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              {/* Assunto */}
              <div>
                <label className="block text-[13px] font-medium text-gms-g900 mb-1.5">
                  Assunto <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Erro ao emitir nota fiscal de serviço"
                  value={formData.subject}
                  onChange={e => updateField('subject', e.target.value)}
                  className="w-full h-[38px] px-3 border border-gms-g300 rounded-md text-[13px] text-gms-g900 bg-white outline-none transition-all focus:border-gms-cyan focus:ring-2 focus:ring-gms-cyan/15 placeholder:text-gms-g500/60"
                />
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-[13px] font-medium text-gms-g900 mb-1.5">
                  Descrição detalhada <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  placeholder="Descreva o problema com o máximo de detalhes possível: o que estava fazendo, qual erro apareceu, se o problema é recorrente..."
                  value={formData.description}
                  onChange={e => updateField('description', e.target.value)}
                  className="w-full min-h-[120px] px-3 py-2.5 border border-gms-g300 rounded-md text-[13px] text-gms-g900 bg-white outline-none transition-all focus:border-gms-cyan focus:ring-2 focus:ring-gms-cyan/15 placeholder:text-gms-g500/60 resize-y"
                />
              </div>

              {/* Prioridade */}
              <div>
                <label className="block text-[13px] font-medium text-gms-g900 mb-1.5">Prioridade</label>
                <div className="grid grid-cols-4 gap-2">
                  {PRIORITIES.map(p => {
                    const Icon = p.icon
                    const isSelected = selectedPriority === p.key
                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => setSelectedPriority(p.key)}
                        className={cn(
                          'flex flex-col items-center gap-1.5 py-3 rounded-lg border text-[12px] font-medium transition-all',
                          isSelected
                            ? 'bg-gms-navy text-white border-gms-navy shadow-md'
                            : 'bg-white text-gms-g900 border-gms-g200 hover:border-gms-g300 hover:bg-gms-g100'
                        )}
                      >
                        <Icon className={cn('w-5 h-5', isSelected ? p.selectedColor : p.color)} />
                        {p.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Versão + Horário */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-medium text-gms-g900 mb-1.5">Versão do sistema</label>
                  <input
                    type="text"
                    value={formData.system_version}
                    onChange={e => updateField('system_version', e.target.value)}
                    className="w-full h-[38px] px-3 border border-gms-g300 rounded-md text-[13px] text-gms-g900 bg-white outline-none transition-all focus:border-gms-cyan focus:ring-2 focus:ring-gms-cyan/15"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-gms-g900 mb-1.5">Horário do ocorrido</label>
                  <input
                    type="text"
                    placeholder="Ex: Hoje às 14:30"
                    value={formData.occurred_at}
                    onChange={e => updateField('occurred_at', e.target.value)}
                    className="w-full h-[38px] px-3 border border-gms-g300 rounded-md text-[13px] text-gms-g900 bg-white outline-none transition-all focus:border-gms-cyan focus:ring-2 focus:ring-gms-cyan/15 placeholder:text-gms-g500/60"
                  />
                </div>
              </div>

              {/* Separator */}
              <div className="border-t border-gms-g200 pt-5">
                <h3 className="text-[13px] font-semibold text-gms-g900 mb-3">Seus dados de contato</h3>
              </div>

              {/* Nome */}
              <div>
                <label className="block text-[13px] font-medium text-gms-g900 mb-1.5">
                  Nome completo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.contact_name}
                  onChange={e => updateField('contact_name', e.target.value)}
                  className="w-full h-[38px] px-3 border border-gms-g300 rounded-md text-[13px] text-gms-g900 bg-white outline-none transition-all focus:border-gms-cyan focus:ring-2 focus:ring-gms-cyan/15"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-[13px] font-medium text-gms-g900 mb-1.5">
                  E-mail <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={formData.contact_email}
                  onChange={e => updateField('contact_email', e.target.value)}
                  className="w-full h-[38px] px-3 border border-gms-g300 rounded-md text-[13px] text-gms-g900 bg-white outline-none transition-all focus:border-gms-cyan focus:ring-2 focus:ring-gms-cyan/15"
                />
              </div>

              {/* Telefone */}
              <div>
                <label className="block text-[13px] font-medium text-gms-g900 mb-1.5">Telefone</label>
                <input
                  type="text"
                  placeholder="(00) 00000-0000"
                  value={formData.contact_phone}
                  onChange={e => updateField('contact_phone', e.target.value)}
                  className="w-full h-[38px] px-3 border border-gms-g300 rounded-md text-[13px] text-gms-g900 bg-white outline-none transition-all focus:border-gms-cyan focus:ring-2 focus:ring-gms-cyan/15 placeholder:text-gms-g500/60"
                />
              </div>

              {/* Upload */}
              <div>
                <label className="block text-[13px] font-medium text-gms-g900 mb-1.5">Anexos</label>
                <div className="border-2 border-dashed border-gms-g300 rounded-xl p-6 text-center transition-colors hover:border-gms-cyan hover:bg-gms-cyan-light/50 cursor-pointer group">
                  <Upload className="w-8 h-8 text-gms-g500 mx-auto mb-2 group-hover:text-gms-cyan transition-colors" />
                  <p className="text-[13px] text-gms-g500">
                    <span className="text-gms-cyan font-medium">Clique para enviar</span> ou arraste arquivos aqui
                  </p>
                  <p className="text-[11px] text-gms-g500/70 mt-1">PNG, JPG, PDF ou TXT (máx. 10MB)</p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gms-g200 flex items-center justify-end gap-3">
              <Link
                to="/help/tickets"
                className="inline-flex items-center justify-center h-[38px] px-4 rounded-md border border-gms-g200 text-[13px] font-semibold text-gms-g900 hover:bg-gms-g100 transition-colors"
              >
                Cancelar
              </Link>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2 h-[38px] px-5 rounded-md bg-gms-navy text-white text-[13px] font-semibold hover:bg-[#1a3d5c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>Enviando...</>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Enviar Chamado
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Right Sidebar */}
          <div className="space-y-4">
            {/* Info card */}
            <div className="bg-white rounded-2xl border border-gms-g200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Info className="w-4 h-4 text-gms-cyan" />
                <h3 className="text-[13px] font-semibold text-gms-g900">O que acontece depois?</h3>
              </div>
              <ul className="space-y-3">
                {[
                  'Você recebe uma confirmação por e-mail',
                  'Nossa equipe faz a triagem em até 30 minutos',
                  'Primeira resposta em até 2 horas úteis',
                  'Chamados críticos são tratados em até 30 minutos',
                ].map((text, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[12px] text-gms-g500 leading-relaxed">
                    <span className="w-1.5 h-1.5 rounded-full bg-gms-cyan mt-1.5 shrink-0" />
                    {text}
                  </li>
                ))}
              </ul>
            </div>

            {/* Quick links card */}
            <div className="bg-gms-navy rounded-2xl p-5">
              <h3 className="text-white text-[13px] font-semibold mb-3">Resolva mais rápido</h3>
              <div className="space-y-2">
                {[
                  { label: 'Perguntar para IA', icon: Bot, to: '/help-center' },
                  { label: 'Buscar manuais', icon: BookOpen, to: '/help/manuals' },
                  { label: 'Ver vídeos', icon: PlayCircle, to: '/help/videos' },
                ].map(link => (
                  <Link
                    key={link.label}
                    to={link.to}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-all text-[13px]"
                  >
                    <link.icon className="w-4 h-4 text-gms-cyan" />
                    {link.label}
                    <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-40" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      <HelpFloatingChat />
    </div>
  )
}
