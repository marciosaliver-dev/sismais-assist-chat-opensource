-- ============================================================
-- Migration: Taxonomia KB — 7 categorias L1 + subcategorias L2
-- Ref: KB Report v1 — step-06-kb-report.md, secao 4
-- ============================================================

-- 1. Inserir 7 categorias L1 como knowledge_products
INSERT INTO knowledge_products (name, slug, description, icon, color, sort_order, is_active) VALUES
  ('Primeiros Passos',             'primeiros-passos',   'Cadastro, login, aprovacao e primeiros passos na plataforma',   'RocketLaunch',   '#10b981', 10, true),
  ('Atendimento & Tickets',        'atendimento',        'Dashboard, inbox, kanban, avaliacoes e macros',                 'Headset',         '#3b82f6', 20, true),
  ('Agentes IA & Automacoes',      'agentes-ia',         'Criacao de agentes, AI Builder, copilot, flows e campanhas',    'Bot',             '#8b5cf6', 30, true),
  ('Base de Conhecimento & Manuais','base-conhecimento', 'Documentos, artigos, manuais e help center publico',           'BookOpen',        '#f59e0b', 40, true),
  ('WhatsApp & Canais',            'whatsapp-canais',    'Instancias WhatsApp, mensagens, contatos e Instagram DM',       'MessageCircle',   '#22c55e', 50, true),
  ('CRM & Clientes',               'crm-clientes',       'Lista de clientes, Customer 360, sincronizacao GL',            'Users',           '#ec4899', 60, true),
  ('Configuracoes & Sistema',      'configuracoes',      'Configuracoes gerais, equipe, relatorios, integracoes',         'Settings',        '#64748b', 70, true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  sort_order = EXCLUDED.sort_order;

-- 2. Inserir subcategorias L2 como knowledge_groups

-- L1: Primeiros Passos (4 L2s)
INSERT INTO knowledge_groups (product_id, name, description, icon, sort_order) VALUES
  ((SELECT id FROM knowledge_products WHERE slug = 'primeiros-passos'), 'Cadastro & Login',     'Criar conta, fazer login, recuperar senha',       'LogIn',        1),
  ((SELECT id FROM knowledge_products WHERE slug = 'primeiros-passos'), 'Aprovacao de Acesso',  'Fluxo de aprovacao e ativacao da conta',          'ShieldCheck',  2),
  ((SELECT id FROM knowledge_products WHERE slug = 'primeiros-passos'), 'Tour Inicial',         'Guia de primeiros passos apos ativacao',          'Map',          3),
  ((SELECT id FROM knowledge_products WHERE slug = 'primeiros-passos'), 'Planos & Creditos',    'Planos disponiveis, creditos IA, faturamento',    'CreditCard',   4);

-- L1: Atendimento & Tickets (5 L2s)
INSERT INTO knowledge_groups (product_id, name, description, icon, sort_order) VALUES
  ((SELECT id FROM knowledge_products WHERE slug = 'atendimento'), 'Dashboard',            'Visao geral de metricas e KPIs',                  'LayoutDashboard', 1),
  ((SELECT id FROM knowledge_products WHERE slug = 'atendimento'), 'Inbox & Fila',         'Caixa de entrada e fila de atendimento',          'Inbox',            2),
  ((SELECT id FROM knowledge_products WHERE slug = 'atendimento'), 'Kanban',               'Quadro kanban de tickets',                        'Columns',          3),
  ((SELECT id FROM knowledge_products WHERE slug = 'atendimento'), 'Avaliacoes & CSAT',    'Pesquisas de satisfacao e avaliacoes',             'Star',             4),
  ((SELECT id FROM knowledge_products WHERE slug = 'atendimento'), 'Macros',               'Templates de respostas rapidas',                  'Zap',              5);

-- L1: Agentes IA & Automacoes (5 L2s)
INSERT INTO knowledge_groups (product_id, name, description, icon, sort_order) VALUES
  ((SELECT id FROM knowledge_products WHERE slug = 'agentes-ia'), 'Criacao de Agentes',      'Criar e configurar agentes IA',                 'UserPlus',      1),
  ((SELECT id FROM knowledge_products WHERE slug = 'agentes-ia'), 'AI Builder & Skills',     'Construtor visual e skills dos agentes',         'Puzzle',        2),
  ((SELECT id FROM knowledge_products WHERE slug = 'agentes-ia'), 'Supervisao & Copilot',    'Monitorar agentes e modo copiloto',              'Eye',           3),
  ((SELECT id FROM knowledge_products WHERE slug = 'agentes-ia'), 'Automacoes & Flows',      'Automacoes de fluxo e Flow Builder',             'GitBranch',     4),
  ((SELECT id FROM knowledge_products WHERE slug = 'agentes-ia'), 'Campanhas',               'Campanhas de mensagens automatizadas',           'Megaphone',     5);

-- L1: Base de Conhecimento & Manuais (4 L2s)
INSERT INTO knowledge_groups (product_id, name, description, icon, sort_order) VALUES
  ((SELECT id FROM knowledge_products WHERE slug = 'base-conhecimento'), 'Documentos & Artigos',  'Upload e gestao de documentos',            'FileText',      1),
  ((SELECT id FROM knowledge_products WHERE slug = 'base-conhecimento'), 'Manuais',               'Manuais do sistema (editor interno)',      'BookOpen',      2),
  ((SELECT id FROM knowledge_products WHERE slug = 'base-conhecimento'), 'Help Center Publico',   'Portal publico de autoatendimento',        'Globe',         3),
  ((SELECT id FROM knowledge_products WHERE slug = 'base-conhecimento'), 'Importacao',            'Importar KB de fontes externas (Zoho, etc)', 'Upload',     4);

-- L1: WhatsApp & Canais (4 L2s)
INSERT INTO knowledge_groups (product_id, name, description, icon, sort_order) VALUES
  ((SELECT id FROM knowledge_products WHERE slug = 'whatsapp-canais'), 'Instancias WhatsApp',  'Configurar e gerenciar instancias UAZAPI',    'Smartphone',    1),
  ((SELECT id FROM knowledge_products WHERE slug = 'whatsapp-canais'), 'Mensagens & Contatos', 'Enviar mensagens e gerenciar contatos',       'MessageSquare', 2),
  ((SELECT id FROM knowledge_products WHERE slug = 'whatsapp-canais'), 'Instagram DM',         'Integrar e gerenciar Instagram Direct',       'Instagram',     3),
  ((SELECT id FROM knowledge_products WHERE slug = 'whatsapp-canais'), 'Painel de Teste',      'Testar envio e recebimento de mensagens',     'TestTube',      4);

-- L1: CRM & Clientes (4 L2s)
INSERT INTO knowledge_groups (product_id, name, description, icon, sort_order) VALUES
  ((SELECT id FROM knowledge_products WHERE slug = 'crm-clientes'), 'Lista & Cadastro',       'Listar e cadastrar clientes',                 'List',          1),
  ((SELECT id FROM knowledge_products WHERE slug = 'crm-clientes'), 'Customer 360',           'Visao completa do cliente',                   'CircleUser',    2),
  ((SELECT id FROM knowledge_products WHERE slug = 'crm-clientes'), 'Sincronizacao GL',       'Sincronizar dados com Sismais GL',            'RefreshCw',     3),
  ((SELECT id FROM knowledge_products WHERE slug = 'crm-clientes'), 'Contatos & Segmentacao', 'Gerenciar contatos e segmentar base',         'Filter',        4);

-- L1: Configuracoes & Sistema (5 L2s)
INSERT INTO knowledge_groups (product_id, name, description, icon, sort_order) VALUES
  ((SELECT id FROM knowledge_products WHERE slug = 'configuracoes'), 'Gerais',                'Configuracoes gerais da plataforma',           'Sliders',       1),
  ((SELECT id FROM knowledge_products WHERE slug = 'configuracoes'), 'Equipe & Permissoes',   'Gerenciar usuarios, papeis e permissoes',     'Shield',        2),
  ((SELECT id FROM knowledge_products WHERE slug = 'configuracoes'), 'Relatorios',            'Relatorios e exportacoes de dados',           'BarChart3',     3),
  ((SELECT id FROM knowledge_products WHERE slug = 'configuracoes'), 'Integracoes',           'Integracoes com sistemas externos',           'Plug',          4),
  ((SELECT id FROM knowledge_products WHERE slug = 'configuracoes'), 'Sistema & Atualizacoes','Versoes, changelog e atualizacoes',           'RefreshCcw',    5);

-- 3. Adicionar coluna slug em knowledge_groups para URLs amigaveis
ALTER TABLE knowledge_groups ADD COLUMN IF NOT EXISTS slug TEXT;

UPDATE knowledge_groups SET slug = lower(replace(replace(replace(replace(name, ' & ', '-'), ' ', '-'), '&', ''), '''', ''))
  WHERE slug IS NULL;

CREATE INDEX IF NOT EXISTS idx_knowledge_groups_slug ON knowledge_groups(slug);
