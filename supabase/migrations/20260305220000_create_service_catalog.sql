-- Catálogo de serviços extras (fora do escopo do suporte padrão)
create table public.service_catalog (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  description    text,
  category       text not null default 'Geral',
  price          numeric(10,2) not null default 0,
  estimated_time text,
  notes          text,
  is_active      boolean not null default true,
  sort_order     integer,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

alter table public.service_catalog enable row level security;

create policy "Authenticated users can read service_catalog"
  on public.service_catalog for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can manage service_catalog"
  on public.service_catalog for all
  using (auth.role() = 'authenticated');

-- Seed: catálogo oficial de serviços extras da Sismais (fora do escopo do suporte mensal)
-- Fonte: Catálogo de Serviços e Serviços Adicionais (Confluence, fev/2026)
insert into public.service_catalog (name, category, price, estimated_time, description, notes, sort_order) values

  -- ── Infraestrutura de TI ──────────────────────────────────────────────────
  (
    'Configuração de Rede',
    'Infraestrutura de TI',
    30.00,
    'Por computador',
    'Configuração de IP e comunicação de computador em rede interna: alterar IP no sistema operacional Windows e fazer os computadores se comunicarem na rede local.',
    'Valor cobrado por computador configurado. Não cobre cabeamento físico — cabos devem estar crimpados e funcionando.',
    10
  ),
  (
    'Acesso Remoto via TS — Instalação',
    'Infraestrutura de TI',
    300.00,
    'Por instalação',
    'Liberação de portas no roteador para acesso externo + configuração de Conexão Remota via Terminal Service (TS) do Windows.',
    'Válido para primeira instalação ou troca de roteador/provedor. Necessário usuário e senha de acesso ao roteador. Clientes com VPN Sismais têm 50% de desconto.',
    11
  ),
  (
    'Acesso Remoto via TS — Manutenção',
    'Infraestrutura de TI',
    100.00,
    'Por ocorrência',
    'Manutenção de acesso remoto via Terminal Service (TS) do Windows quando o serviço para de funcionar.',
    'Clientes com VPN Sismais têm 50% de desconto.',
    12
  ),
  (
    'Atualizações do Windows',
    'Infraestrutura de TI',
    100.00,
    'Por máquina',
    'Atualização do sistema operacional Windows quando necessário para o funcionamento correto do Maxpró.',
    'Cobre apenas a execução de updates do Windows. Formatação ou reinstalação do SO não está inclusa — nesses casos o cliente é orientado a procurar um técnico local e não haverá cobrança.',
    13
  ),
  (
    'Configuração de Backup em Nuvem',
    'Infraestrutura de TI',
    50.00,
    'Por configuração',
    'Configuração inicial do backup automático do Maxpró no Google Drive (requer e-mail/senha Gmail) ou OneDrive (Microsoft).',
    'Cobre apenas a instalação e orientação inicial. O monitoramento contínuo do backup é responsabilidade do cliente. Tutorial disponível na base de conhecimento para quem preferir fazer sozinho.',
    14
  ),

  -- ── Impressoras ───────────────────────────────────────────────────────────
  (
    'Instalação de Impressora Térmica',
    'Impressoras',
    70.00,
    'Por impressora',
    'Instalação de driver e teste de impressão de impressora térmica (cupom fiscal, não fiscal, etc.).',
    'Cobre apenas software (instalação de driver + teste). Problemas físicos: o suporte solicitará técnico local. Não fazemos instalação de impressoras matriciais.',
    20
  ),
  (
    'Instalação de Impressora Laser / Tinta',
    'Impressoras',
    70.00,
    'Por impressora',
    'Instalação de driver e teste de impressão de impressora laser ou jato de tinta.',
    'Cobre apenas software (instalação de driver + teste). Problemas físicos: o suporte solicitará técnico local.',
    21
  ),
  (
    'Instalação de Impressora de Etiquetas',
    'Impressoras',
    150.00,
    'Por impressora',
    'Instalação de driver e configuração de impressora de etiquetas.',
    'Cobre apenas software (instalação de driver + teste). Problemas físicos: o suporte solicitará técnico local. Outras impressoras não listadas: consultar.',
    22
  ),
  (
    'Compartilhamento de Impressora em Rede',
    'Impressoras',
    50.00,
    'Para até 3 computadores',
    'Compartilhamento da impressora em rede para que seja reconhecida em outros computadores da rede local.',
    'Gratuito se contratado junto com a instalação da impressora (solicitar no mesmo chamado). Em contratações avulsas: R$ 50,00 para até 3 computadores.',
    23
  ),

  -- ── Hardware Fiscal ───────────────────────────────────────────────────────
  (
    'Instalação e Configuração do SAT-CFe',
    'Hardware Fiscal',
    100.00,
    'Por equipamento',
    'Instalação e configuração do hardware SAT para autorização e armazenamento de CF-e (Cupom Fiscal Eletrônico). O hardware SAT é um dispositivo lacrado que permite a comunicação do sistema para emissão de documentos fiscais.',
    'Recomendamos que seja feito por um técnico de TI local. A Sismais pode executar remotamente mediante cobrança da taxa.',
    30
  ),

  -- ── Certificados Digitais ─────────────────────────────────────────────────
  (
    'Instalação de Certificado Digital A1',
    'Certificados Digitais',
    30.00,
    'Até 3 PCs em 4 dias',
    'Instalação do certificado A1 (arquivo) no navegador para uso em sites como Portal da NFe (download de XML) e outros. Inclui teste de funcionamento.',
    'O arquivo do certificado deve estar baixado na máquina e o cliente deve ter o PIN em mãos. Inclui instalação do mesmo certificado em até 3 computadores diferentes, desde que feitos no prazo máximo de 4 dias. Recomendamos o uso do A1 — mais simples e com menos problemas do que o A3. Cobrado somente se necessário configurar fora do Maxpró (ex: navegadores web).',
    40
  ),

  -- ── Banco de Dados ────────────────────────────────────────────────────────
  (
    'Consulta no Banco de Dados (SELECT)',
    'Banco de Dados',
    200.00,
    'Por execução',
    'Execução de consulta SQL diretamente no banco de dados para extrair dados específicos conforme necessidade solicitada.',
    'Valor mínimo por execução — pode variar conforme complexidade. Cobrado a cada execução, mesmo que a mesma consulta já tenha sido solicitada anteriormente. Executado somente em último caso, se não houver como obter os dados pelo sistema.',
    50
  ),
  (
    'Modificação no Banco de Dados (INSERT / UPDATE / DELETE)',
    'Banco de Dados',
    200.00,
    'Por execução',
    'Execução de procedimentos que inserem, modificam ou excluem dados diretamente no banco de dados.',
    'Valor mínimo por execução — pode variar conforme complexidade. Executado somente em último caso. Nossa equipe avalia a viabilidade antes de executar.',
    51
  ),

  -- ── Servidores ────────────────────────────────────────────────────────────
  (
    'Restauração de Backup',
    'Servidores',
    200.00,
    'Por execução',
    'Restauração do backup do banco de dados quando houver problema no servidor ou banco de dados.',
    'Primeira vez no mês: gratuito. Da segunda vez em diante no mesmo mês: R$ 200,00 por restauração.',
    60
  ),
  (
    'Mudança / Troca de Servidor',
    'Servidores',
    100.00,
    'Por troca',
    'Migração do sistema para outro servidor, realizada em casos de detecção de problemas, formatação ou atualização de hardware.',
    'Primeira e segunda vez no mês: gratuito. Da terceira vez em diante: R$ 100,00 por troca. Exemplo: mover para servidor temporário + retornar ao oficial = 2 trocas (gratuitas). Se precisar de mais 2 trocas no mesmo mês, cobrança de R$ 200,00 (2 x R$100).',
    61
  );
