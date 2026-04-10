import { Copy, CheckCircle } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

const BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-v1`

function CodeBlock({ code, language = "bash" }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(code)
    setCopied(true)
    toast.success("Copiado!")
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative group">
      <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto font-mono leading-relaxed">
        <code>{code}</code>
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 rounded-md bg-background/80 border border-border opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {copied ? <CheckCircle className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">{title}</h3>
      {children}
    </div>
  )
}

function EndpointCard({ method, path, description, params, example, response }: {
  method: string
  path: string
  description: string
  params?: { name: string; type: string; desc: string }[]
  example: string
  response?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-500/10 text-green-500 border border-green-500/30">
          {method}
        </span>
        <code className="text-sm font-mono">{path}</code>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
      {params && params.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Parametros:</p>
          <div className="grid gap-1">
            {params.map(p => (
              <div key={p.name} className="flex items-center gap-2 text-xs">
                <code className="bg-muted px-1.5 py-0.5 rounded">{p.name}</code>
                <span className="text-muted-foreground">{p.type}</span>
                <span className="text-muted-foreground">— {p.desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Requisicao:</p>
        <CodeBlock code={example} />
      </div>
      {response && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Resposta:</p>
          <CodeBlock code={response} language="json" />
        </div>
      )}
    </div>
  )
}

export function ApiDocs() {
  return (
    <div className="space-y-8 max-w-4xl">
      {/* Intro */}
      <Section title="Autenticacao">
        <p className="text-sm text-muted-foreground">
          Todas as requisicoes (exceto <code className="bg-muted px-1 rounded">/health</code>) exigem uma API Key no header:
        </p>
        <CodeBlock code={`curl -H "X-API-Key: sk_live_sua_chave" \\\n  "${BASE_URL}/health"`} />
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3 text-sm text-muted-foreground">
          A chave e fornecida pelo administrador. Guarde em local seguro — nao pode ser recuperada apos a criacao.
        </div>
      </Section>

      {/* Rate Limits */}
      <Section title="Rate Limits">
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left p-3 font-medium">Plano</th>
                <th className="text-right p-3 font-medium">Req/min</th>
                <th className="text-right p-3 font-medium">Req/dia</th>
              </tr>
            </thead>
            <tbody>
              {[
                { plan: "Free", rpm: "30", rpd: "1.000" },
                { plan: "Starter", rpm: "60", rpd: "10.000" },
                { plan: "Pro", rpm: "120", rpd: "50.000" },
                { plan: "Enterprise", rpm: "300", rpd: "200.000" },
              ].map(r => (
                <tr key={r.plan} className="border-t border-border">
                  <td className="p-3">{r.plan}</td>
                  <td className="p-3 text-right font-mono">{r.rpm}</td>
                  <td className="p-3 text-right font-mono">{r.rpd}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          Headers de resposta: <code className="bg-muted px-1 rounded">X-RateLimit-Limit</code>, <code className="bg-muted px-1 rounded">X-RateLimit-Remaining</code>, <code className="bg-muted px-1 rounded">X-RateLimit-Reset</code>
        </p>
      </Section>

      {/* Endpoints */}
      <Section title="Endpoints">
        <div className="space-y-4">
          <EndpointCard
            method="GET"
            path="/health"
            description="Verifica se a API esta disponivel. Nao requer autenticacao."
            example={`curl ${BASE_URL}/health`}
            response={`{
  "data": {
    "status": "ok",
    "version": "v1",
    "timestamp": "2026-03-19T15:30:00.000Z"
  }
}`}
          />

          <EndpointCard
            method="GET"
            path="/conversations"
            description="Lista conversas de atendimento com paginacao e filtros."
            params={[
              { name: "status", type: "string", desc: "open, in_progress, resolved, closed" },
              { name: "date_from", type: "ISO date", desc: "Data inicio (ex: 2026-03-01)" },
              { name: "date_to", type: "ISO date", desc: "Data fim (ex: 2026-03-25)" },
              { name: "handler_type", type: "string", desc: "ai, human" },
              { name: "priority", type: "string", desc: "critical, high, medium, low" },
              { name: "customer_phone", type: "string", desc: "Telefone exato do cliente" },
              { name: "agent_id", type: "uuid", desc: "ID do agente IA" },
              { name: "page", type: "number", desc: "Pagina (padrao: 1)" },
              { name: "per_page", type: "number", desc: "Itens por pagina (max: 100)" },
            ]}
            example={`curl -H "X-API-Key: sk_live_..." \\\n  "${BASE_URL}/conversations?date_from=2026-03-01&date_to=2026-03-25&handler_type=ai&page=1&per_page=10"`}
            response={`{
  "data": [
    {
      "id": "a1b2c3d4-...",
      "customer_phone": "5511999999999",
      "status": "open",
      "handler_type": "ai",
      "agent_id": "uuid",
      "priority": "medium",
      "created_at": "2026-03-19T10:00:00Z",
      "updated_at": "2026-03-19T12:00:00Z"
    }
  ],
  "pagination": {
    "total": 42,
    "page": 1,
    "per_page": 10,
    "total_pages": 5
  }
}`}
          />

          <EndpointCard
            method="GET"
            path="/conversations/:id"
            description="Retorna detalhe de uma conversa com mensagens."
            params={[
              { name: "messages_limit", type: "number", desc: "Limite de mensagens (padrao: 100, max: 500)" },
              { name: "messages_after", type: "ISO datetime", desc: "Retornar apenas mensagens apos este timestamp" },
            ]}
            example={`curl -H "X-API-Key: sk_live_..." \\\n  "${BASE_URL}/conversations/UUID_DA_CONVERSA?messages_limit=50&messages_after=2026-03-20T00:00:00Z"`}
            response={`{
  "data": {
    "id": "a1b2c3d4-...",
    "customer_phone": "5511999999999",
    "status": "open",
    "handler_type": "ai",
    "agent_id": "uuid",
    "priority": "medium",
    "summary": "Cliente com duvida sobre NF-e",
    "created_at": "2026-03-19T10:00:00Z",
    "updated_at": "2026-03-19T12:00:00Z",
    "messages": [
      {
        "id": "uuid",
        "role": "user",
        "content": "Preciso de ajuda com uma NF-e",
        "confidence": null,
        "created_at": "2026-03-19T10:00:00Z"
      },
      {
        "id": "uuid",
        "role": "assistant",
        "content": "Claro! Qual o numero da nota?",
        "confidence": 0.92,
        "created_at": "2026-03-19T10:00:15Z"
      }
    ]
  }
}`}
          />

          <EndpointCard
            method="GET"
            path="/tickets"
            description="Lista tickets do Kanban com filtros."
            params={[
              { name: "status", type: "string", desc: "Filtrar por status" },
              { name: "priority", type: "string", desc: "low, medium, high, urgent" },
              { name: "date_from", type: "ISO date", desc: "Data inicio (ex: 2026-03-01)" },
              { name: "date_to", type: "ISO date", desc: "Data fim (ex: 2026-03-25)" },
              { name: "page", type: "number", desc: "Pagina" },
              { name: "per_page", type: "number", desc: "Itens por pagina" },
            ]}
            example={`curl -H "X-API-Key: sk_live_..." \\\n  "${BASE_URL}/tickets?priority=high&status=open&date_from=2026-03-01"`}
            response={`{
  "data": [
    {
      "id": "uuid",
      "status": "open",
      "priority": "high",
      "summary": "Erro ao emitir NF-e",
      "handler_type": "human",
      "kanban_board_id": "uuid",
      "kanban_stage_id": "uuid",
      "helpdesk_client_id": "uuid",
      "created_at": "2026-03-19T10:00:00Z",
      "updated_at": "2026-03-19T14:00:00Z"
    }
  ],
  "pagination": {
    "total": 15,
    "page": 1,
    "per_page": 20,
    "total_pages": 1
  }
}`}
          />

          <EndpointCard
            method="GET"
            path="/clients"
            description="Lista clientes do helpdesk com busca por nome."
            params={[
              { name: "search", type: "string", desc: "Busca parcial por nome" },
              { name: "page", type: "number", desc: "Pagina" },
              { name: "per_page", type: "number", desc: "Itens por pagina" },
            ]}
            example={`curl -H "X-API-Key: sk_live_..." \\\n  "${BASE_URL}/clients?search=empresa"`}
            response={`{
  "data": [
    {
      "id": "uuid",
      "name": "Empresa ABC Ltda",
      "documento": "12.345.678/0001-90",
      "email": "contato@empresaabc.com",
      "phone": "5511888888888",
      "status": "active",
      "health_score": 85,
      "created_at": "2026-01-15T08:00:00Z"
    }
  ],
  "pagination": {
    "total": 3,
    "page": 1,
    "per_page": 20,
    "total_pages": 1
  }
}`}
          />
        </div>
      </Section>

      {/* Formato de resposta */}
      <Section title="Formato de Resposta">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Sucesso com paginacao</p>
            <CodeBlock language="json" code={`{
  "data": [ ... ],
  "pagination": {
    "total": 150,
    "page": 1,
    "per_page": 20,
    "total_pages": 8
  }
}`} />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Erro</p>
            <CodeBlock language="json" code={`{
  "error": {
    "message": "Descricao do erro",
    "code": "error_code",
    "status": 400
  }
}`} />
          </div>
        </div>
      </Section>

      {/* Codigos de erro */}
      <Section title="Codigos de Erro">
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left p-3 font-medium">HTTP</th>
                <th className="text-left p-3 font-medium">Codigo</th>
                <th className="text-left p-3 font-medium">Descricao</th>
              </tr>
            </thead>
            <tbody>
              {[
                { http: "400", code: "bad_request", desc: "Parametros invalidos" },
                { http: "401", code: "unauthorized", desc: "API key ausente ou invalida" },
                { http: "403", code: "forbidden", desc: "Chave desativada, expirada ou sem permissao" },
                { http: "404", code: "not_found", desc: "Recurso nao encontrado" },
                { http: "429", code: "rate_limit_exceeded", desc: "Limite de requisicoes excedido" },
                { http: "500", code: "internal_error", desc: "Erro interno do servidor" },
              ].map(e => (
                <tr key={e.code} className="border-t border-border">
                  <td className="p-3 font-mono">{e.http}</td>
                  <td className="p-3"><code className="bg-muted px-1.5 py-0.5 rounded text-xs">{e.code}</code></td>
                  <td className="p-3 text-muted-foreground">{e.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Exemplos */}
      <Section title="Exemplo em JavaScript">
        <CodeBlock code={`const API_URL = '${BASE_URL}'
const API_KEY = 'sk_live_sua_chave'

async function getTickets(status, priority) {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (priority) params.set('priority', priority)

  const response = await fetch(\`\${API_URL}/tickets?\${params}\`, {
    headers: { 'X-API-Key': API_KEY },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error.message)
  }

  return response.json()
}

const result = await getTickets('open', 'high')
console.log(\`Total: \${result.pagination.total} tickets\`)`} />
      </Section>

      <Section title="Exemplo em Python">
        <CodeBlock code={`import requests

API_URL = '${BASE_URL}'
API_KEY = 'sk_live_sua_chave'
headers = {'X-API-Key': API_KEY}

response = requests.get(f'{API_URL}/tickets', headers=headers, params={
    'status': 'open',
    'page': 1,
    'per_page': 50,
})

data = response.json()
print(f"Total: {data['pagination']['total']} tickets")

for ticket in data['data']:
    print(f"  [{ticket['priority']}] {ticket['summary']}")`} />
      </Section>
    </div>
  )
}
