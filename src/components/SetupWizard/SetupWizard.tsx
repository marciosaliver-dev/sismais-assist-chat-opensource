import { useState } from 'react'
import { CheckCircle, ChevronRight, ExternalLink, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface SetupData {
  supabaseUrl: string
  supabaseKey: string
}

const STEPS = [
  {
    id: 'welcome',
    title: 'Bem-vindo ao Sismais Assist Chat!',
    description: 'Vamos configurar o sistema em poucos minutos.',
  },
  {
    id: 'supabase',
    title: 'Configurar banco de dados (Supabase)',
    description: 'O Supabase é onde todos os dados do sistema ficam armazenados.',
  },
  {
    id: 'done',
    title: 'Tudo pronto!',
    description: 'Suas configurações foram salvas.',
  },
]

export function SetupWizard() {
  const [step, setStep] = useState(0)
  const [data, setData] = useState<SetupData>({ supabaseUrl: '', supabaseKey: '' })
  const [errors, setErrors] = useState<Partial<SetupData>>({})

  function validate() {
    const e: Partial<SetupData> = {}
    if (!data.supabaseUrl.startsWith('https://')) e.supabaseUrl = 'A URL deve começar com https://'
    if (!data.supabaseKey || data.supabaseKey.length < 20) e.supabaseKey = 'Cole a chave anon/public completa'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleNext() {
    if (step === 1 && !validate()) return
    setStep(s => s + 1)
  }

  function handleSave() {
    // Salva no localStorage para persistir durante o desenvolvimento
    // Em produção: o usuário deve preencher o arquivo .env
    localStorage.setItem('setup_supabase_url', data.supabaseUrl)
    localStorage.setItem('setup_supabase_key', data.supabaseKey)
    setStep(2)
  }

  function handleReload() {
    window.location.reload()
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-[#10293F] text-white px-4 py-2 rounded-xl mb-3">
            <span className="bg-[#45E5E5] text-[#10293F] font-bold text-sm px-2 py-0.5 rounded">
              ASSIST
            </span>
            <span className="font-medium text-sm">Helpdesk WhatsApp com IA</span>
          </div>
          <p className="text-sm text-gray-500">Open Source — configure com seus próprios dados</p>
        </div>

        {/* Indicador de passos */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all
                ${i < step ? 'bg-[#45E5E5] text-[#10293F]' : i === step ? 'bg-[#10293F] text-white' : 'bg-gray-200 text-gray-400'}`}>
                {i < step ? <CheckCircle size={16} /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-8 h-0.5 ${i < step ? 'bg-[#45E5E5]' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Card principal */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">

          {/* Passo 0 — Boas-vindas */}
          {step === 0 && (
            <div>
              <h1 className="text-xl font-bold text-[#10293F] mb-2">{STEPS[0].title}</h1>
              <p className="text-gray-500 text-sm mb-6">{STEPS[0].description}</p>

              <div className="space-y-3 mb-8">
                {[
                  { icon: '🗄️', title: 'Banco de dados próprio', desc: 'Seus dados ficam no seu Supabase, não em servidores da Sismais' },
                  { icon: '🤖', title: 'IA configurável', desc: 'Use sua própria chave do OpenRouter para os modelos de linguagem' },
                  { icon: '💬', title: 'WhatsApp via UAZAPI', desc: 'Conecte sua própria instância WhatsApp' },
                ].map(item => (
                  <div key={item.title} className="flex gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                    <span className="text-xl">{item.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-[#10293F]">{item.title}</p>
                      <p className="text-xs text-gray-500">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6 flex gap-2">
                <AlertCircle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-700">
                  <strong>Antes de começar:</strong> você vai precisar de uma conta gratuita no{' '}
                  <a href="https://supabase.com" target="_blank" rel="noopener noreferrer"
                    className="underline font-medium">Supabase</a>.
                  A criação leva menos de 2 minutos.
                </p>
              </div>

              <Button onClick={handleNext} className="w-full bg-[#45E5E5] hover:bg-[#2ecece] text-[#10293F] font-semibold">
                Começar configuração
                <ChevronRight size={16} className="ml-1" />
              </Button>
            </div>
          )}

          {/* Passo 1 — Supabase */}
          {step === 1 && (
            <div>
              <h1 className="text-xl font-bold text-[#10293F] mb-2">{STEPS[1].title}</h1>
              <p className="text-gray-500 text-sm mb-6">{STEPS[1].description}</p>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
                <p className="text-xs text-blue-700 font-medium mb-1">Como encontrar esses dados:</p>
                <ol className="text-xs text-blue-600 space-y-0.5 list-decimal list-inside">
                  <li>Acesse o seu projeto no Supabase</li>
                  <li>Clique em <strong>Project Settings</strong> (ícone de engrenagem)</li>
                  <li>Clique em <strong>API</strong> no menu lateral</li>
                  <li>Copie a <strong>Project URL</strong> e a chave <strong>anon public</strong></li>
                </ol>
                <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium mt-2 hover:underline">
                  Abrir Supabase Dashboard
                  <ExternalLink size={10} />
                </a>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <Label htmlFor="url" className="text-sm font-medium text-[#10293F]">
                    URL do Projeto
                  </Label>
                  <p className="text-xs text-gray-400 mb-1">Exemplo: https://abcdefgh.supabase.co</p>
                  <Input
                    id="url"
                    placeholder="https://seu-projeto.supabase.co"
                    value={data.supabaseUrl}
                    onChange={e => setData(d => ({ ...d, supabaseUrl: e.target.value }))}
                    className={errors.supabaseUrl ? 'border-red-400' : ''}
                  />
                  {errors.supabaseUrl && (
                    <p className="text-xs text-red-500 mt-1">{errors.supabaseUrl}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="key" className="text-sm font-medium text-[#10293F]">
                    Chave Pública (anon key)
                  </Label>
                  <p className="text-xs text-gray-400 mb-1">Começa com "eyJ..." — é seguro colocar aqui</p>
                  <Input
                    id="key"
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6Ikp..."
                    value={data.supabaseKey}
                    onChange={e => setData(d => ({ ...d, supabaseKey: e.target.value }))}
                    className={errors.supabaseKey ? 'border-red-400' : ''}
                  />
                  {errors.supabaseKey && (
                    <p className="text-xs text-red-500 mt-1">{errors.supabaseKey}</p>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(0)} className="flex-1">
                  Voltar
                </Button>
                <Button onClick={handleSave} className="flex-1 bg-[#10293F] hover:bg-[#1a3d5c] text-white font-semibold">
                  Salvar e continuar
                  <ChevronRight size={16} className="ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Passo 2 — Concluído */}
          {step === 2 && (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-[#E8F9F9] flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} className="text-[#45E5E5]" />
              </div>
              <h1 className="text-xl font-bold text-[#10293F] mb-2">Configuração salva!</h1>
              <p className="text-gray-500 text-sm mb-6">
                As credenciais foram salvas localmente. Para uso em produção, adicione-as ao arquivo <code className="bg-gray-100 px-1 rounded">.env</code>.
              </p>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6 text-left">
                <p className="text-xs text-amber-700 font-medium mb-1">⚠️ Para produção:</p>
                <p className="text-xs text-amber-600">
                  Copie o arquivo <code>.env.example</code> para <code>.env</code> e preencha com os valores que você acabou de inserir. Os dados no localStorage são apagados ao limpar o navegador.
                </p>
              </div>

              <Button onClick={handleReload} className="w-full bg-[#45E5E5] hover:bg-[#2ecece] text-[#10293F] font-semibold">
                Entrar no sistema
                <ChevronRight size={16} className="ml-1" />
              </Button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Sismais Assist Chat — Open Source •{' '}
          <a href="https://github.com/marciosaliver-dev/sismais-assist-chat-opensource"
            target="_blank" rel="noopener noreferrer" className="hover:underline">
            GitHub
          </a>
        </p>
      </div>
    </div>
  )
}
