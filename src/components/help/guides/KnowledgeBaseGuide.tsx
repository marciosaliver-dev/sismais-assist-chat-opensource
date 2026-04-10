import { WarningBox } from '../shared/WarningBox'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'

interface KnowledgeBaseGuideProps {
  subsection?: string
}

export function KnowledgeBaseGuide({ subsection }: KnowledgeBaseGuideProps) {
  if (subsection === 'best-practices') return <KBBestPractices />
  if (subsection === 'verify') return <KBVerify />
  return <KBHowRAGWorks />
}

function KBHowRAGWorks() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Como a IA usa os seus artigos</h1>
        <p className="text-muted-foreground">Entenda a "busca inteligente" (RAG) que conecta seus artigos às respostas da IA.</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="font-semibold text-foreground">A analogia da biblioteca</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Imagine que a Base de Conhecimento é uma biblioteca. Quando o cliente faz uma pergunta,
          a IA não lê todos os livros — ela vai direto à estante certa, pega os livros mais
          relevantes para aquele assunto, e usa essas informações para responder.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          O processo técnico é: cada artigo recebe uma "impressão digital digital" chamada
          <strong> embedding</strong>. Quando uma pergunta chega, o sistema compara a impressão
          digital da pergunta com a dos artigos e encontra os mais similares.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="font-semibold text-foreground mb-4">O que significa o Limite de Similaridade?</h2>
        <p className="text-sm text-muted-foreground mb-4">
          O Limite de Similaridade (padrão: 75%) define o quão "parecido" um artigo precisa ser
          com a pergunta para ser usado.
        </p>
        <div className="space-y-2">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 border border-red-200">
            <div className="w-16 text-right">
              <span className="font-mono font-bold text-red-600 text-sm">95%+</span>
            </div>
            <div className="flex-1 h-2 rounded-full bg-red-200">
              <div className="h-2 rounded-full bg-red-500 w-[5%]" />
            </div>
            <p className="text-xs text-red-600 w-36">Muito alto — quase nenhum artigo será usado</p>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
            <div className="w-16 text-right">
              <span className="font-mono font-bold text-green-600 text-sm">70-80%</span>
            </div>
            <div className="flex-1 h-2 rounded-full bg-green-200">
              <div className="h-2 rounded-full bg-green-500 w-[60%]" />
            </div>
            <p className="text-xs text-green-600 w-36">Recomendado — bom equilíbrio</p>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <div className="w-16 text-right">
              <span className="font-mono font-bold text-amber-600 text-sm">{'< 60%'}</span>
            </div>
            <div className="flex-1 h-2 rounded-full bg-amber-200">
              <div className="h-2 rounded-full bg-amber-500 w-[90%]" />
            </div>
            <p className="text-xs text-amber-600 w-36">Baixo — artigos irrelevantes podem ser usados</p>
          </div>
        </div>
      </div>

      <WarningBox type="warning" title="Armadilha silenciosa">
        Se o Limite de Similaridade estiver muito alto (acima de 90%), o sistema simplesmente
        não encontrará artigos e a IA responderá sem consultar a base de conhecimento —
        <strong> sem nenhuma mensagem de erro</strong>. Você não saberá que o RAG não está funcionando
        a menos que verifique nas métricas do agente.
      </WarningBox>

      <div className="flex justify-end">
        <Link to="/help/knowledge/best-practices">
          <Button size="sm" className="gap-2">
            Boas práticas para artigos <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  )
}

function KBBestPractices() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Boas Práticas para Escrever Artigos</h1>
        <p className="text-muted-foreground">Como escrever artigos que a IA consegue usar bem.</p>
      </div>

      <div className="space-y-4">
        {[
          {
            title: '1. Use o mesmo vocabulário dos clientes',
            desc: 'Se os clientes perguntam "nota fiscal rejeitada", o artigo deve usar esta expressão, não apenas "rejeição NF-e pela SEFAZ". A busca por similaridade funciona melhor quando o artigo usa as mesmas palavras da pergunta.',
          },
          {
            title: '2. Um artigo, um assunto',
            desc: 'Evite artigos gigantes que cobrem muitos temas. Um artigo sobre "Erros de NF-e" funcionará melhor do que um artigo sobre "Todos os erros do sistema". A busca é mais precisa com artigos focados.',
          },
          {
            title: '3. Comece com a resposta',
            desc: 'Coloque a informação mais importante no início do artigo. A IA usa os primeiros parágrafos com mais peso na geração da resposta.',
          },
          {
            title: '4. Inclua exemplos concretos',
            desc: 'Ex: "Erro 225: Certificado digital inválido. Solução: atualize o certificado em Configurações → Certificados → Importar novo certificado." Exemplos práticos ajudam a IA a dar respostas mais úteis.',
          },
          {
            title: '5. Mantenha artigos atualizados',
            desc: 'Se o sistema mudou e o artigo ainda descreve o processo antigo, a IA dará informações erradas. Revise artigos sempre que houver atualização no sistema.',
          },
        ].map((item, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4">
            <p className="font-semibold text-sm text-foreground mb-1">{item.title}</p>
            <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>

      <Link to="/knowledge">
        <Button className="gap-2">
          Gerenciar Base de Conhecimento <ArrowRight className="w-4 h-4" />
        </Button>
      </Link>
    </div>
  )
}

function KBVerify() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Verificando se a Base de Conhecimento está Funcionando</h1>
        <p className="text-muted-foreground">Como saber se a IA está usando seus artigos.</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="font-semibold text-foreground">Sinais de que o RAG está funcionando</h2>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex gap-2">
            <span className="text-green-500 font-bold">✓</span>
            A IA menciona informações específicas do seu sistema (não genéricas)
          </li>
          <li className="flex gap-2">
            <span className="text-green-500 font-bold">✓</span>
            As respostas incluem números de versão, nomes de menus ou passos específicos do seu produto
          </li>
          <li className="flex gap-2">
            <span className="text-green-500 font-bold">✓</span>
            A pontuação de confiança das respostas está acima de 80%
          </li>
        </ul>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 space-y-4">
        <h2 className="font-semibold text-amber-800">Sinais de que o RAG NÃO está funcionando</h2>
        <ul className="space-y-2 text-sm text-amber-700">
          <li className="flex gap-2">
            <span className="font-bold">⚠️</span>
            As respostas são genéricas, não mencionam nada específico do seu produto
          </li>
          <li className="flex gap-2">
            <span className="font-bold">⚠️</span>
            A IA diz "não tenho essa informação" mesmo com artigos na base
          </li>
          <li className="flex gap-2">
            <span className="font-bold">⚠️</span>
            A pontuação de confiança está consistentemente abaixo de 60%
          </li>
        </ul>
        <p className="text-sm text-amber-700 mt-3">
          Se estes sinais aparecerem, verifique: o agente tem RAG ativo? O Limite de Similaridade
          não está muito alto? Existem artigos na base de conhecimento?
        </p>
      </div>

      <Link to="/help/diagnostic">
        <Button variant="outline" className="gap-2">
          Ver diagnóstico automático <ArrowRight className="w-4 h-4" />
        </Button>
      </Link>
    </div>
  )
}
