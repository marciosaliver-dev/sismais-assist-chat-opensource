export interface IssueBodyParams {
  edge_function: string;
  event_type: string;
  error_message: string;
  severity: string;
  squad_name: string;
  request_id: string | null;
  latency_ms: number | null;
  occurrence_count: number;
}

export function buildIssueTitle(edgeFunction: string, errorMessage: string): string {
  const prefix = `[ERROR-AUTO] ${edgeFunction}: `;
  const maxMsgLen = 120 - prefix.length;
  const msg = errorMessage.length > maxMsgLen
    ? errorMessage.slice(0, maxMsgLen - 3) + "..."
    : errorMessage;
  return `${prefix}${msg}`;
}

export function buildIssueBody(params: IssueBodyParams): string {
  return `## Erro Detectado Automaticamente

- **Funcao:** ${params.edge_function}
- **Tipo:** ${params.event_type}
- **Ocorrencias:** ${params.occurrence_count}
- **Severidade:** ${params.severity}

## Detalhes
${params.error_message}

## Contexto
- **Request ID:** ${params.request_id || "N/A"}
- **Latencia:** ${params.latency_ms ? params.latency_ms + "ms" : "N/A"}

## Squad Atribuido
${params.squad_name}

## Acao Esperada
1. Investigar e corrigir
2. Abrir PR com fix
3. Aguardar aprovacao de @marciosaliver-dev

---
🤖 Issue criada automaticamente por error-watcher`;
}

const REPO_OWNER = "marciosaliver-dev";
const REPO_NAME = "sismais-assist-chat";

export async function createGitHubIssue(
  token: string,
  title: string,
  body: string,
  labels: string[],
  assignee: string | null
): Promise<{ number: number; html_url: string }> {
  const payload: Record<string, unknown> = { title, body, labels };
  if (assignee) payload.assignees = [assignee];

  const res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return { number: data.number, html_url: data.html_url };
}

export async function addGitHubIssueComment(
  token: string,
  issueNumber: number,
  comment: string
): Promise<void> {
  const res = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/issues/${issueNumber}/comments`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body: comment }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub API error ${res.status}: ${err}`);
  }
}
