-- ============================================================================
-- Seed: 32 KB articles for ai_knowledge_base
-- Generated from: scripts/seed-kb-articles.ts
-- Usage: cat scripts/seed-kb-articles.sql | npx supabase db query --linked
-- ============================================================================

-- Note: no unique index on title (duplicates exist in production)

-- ═══════════════════════════════════════════════════════════════════════════
-- HOW-TO ARTICLES (5)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO ai_knowledge_base (
  title, content, content_type, article_template, product_id, group_id,
  category, tags, audience_tier, visibility, rag_chunks,
  estimated_time, is_active, feeds_ai, source
) VALUES (
  'HT-001: Como fazer login no sistema',
  $CONTENT$## Como fazer login no sistema

**Categoria:** Primeiros Passos | **Tier:** 1 — Cliente | **Tempo de leitura:** 2 min

### Visão geral

Aprenda a acessar o Mais Simples — Atendimento Inteligente usando seu e-mail e senha cadastrados. Em menos de um minuto você estará no Dashboard principal.

### Pré-requisitos

- Ter recebido o convite de acesso por e-mail
- Ter criado sua senha durante o cadastro
- Navegador atualizado (Chrome, Edge ou Firefox)

### Passo a passo

1. Abra o navegador e acesse **app.sismais.com**.

2. Digite seu **e-mail** no primeiro campo.

3. Digite sua **senha** no segundo campo.

   > **Dica:** A senha precisa ter no mínimo 6 caracteres.

4. Clique no botão **Entrar**.

5. Aguarde o carregamento. Você será direcionado ao **Dashboard** principal.

### Resultado esperado

Você verá o Dashboard com o resumo dos seus atendimentos, tickets abertos e métricas do dia.

### Solução de problemas

- **Se aparecer "E-mail ou senha incorretos":** Verifique se digitou o e-mail correto e tente novamente. Se persistir, clique em **Esqueci minha senha** para redefinir.
- **Se aparecer "Acesso pendente de aprovação":** Seu cadastro ainda não foi liberado pelo administrador. Entre em contato com o responsável da sua empresa.
- **Se a página não carregar:** Limpe o cache do navegador (Ctrl + Shift + Delete) e tente novamente.

### Artigos relacionados

- Como redefinir sua senha
- Entendendo o Dashboard principal
- FAQ: Meu acesso está pendente de aprovação, o que fazer?$CONTENT$,
  'markdown',
  'how-to',
  (SELECT id FROM knowledge_products WHERE slug = 'primeiros-passos'),
  (SELECT id FROM knowledge_groups WHERE name = 'Cadastro & Login' AND product_id = (SELECT id FROM knowledge_products WHERE slug = 'primeiros-passos')),
  'tutorial',
  ARRAY['login', 'acesso', 'senha', 'primeiros-passos'],
  'tier1',
  'public',
  true,
  '2 min',
  true,
  true,
  'kb_seed_v1'
) ;

INSERT INTO ai_knowledge_base (
  title, content, content_type, article_template, product_id, group_id,
  category, tags, audience_tier, visibility, rag_chunks,
  estimated_time, is_active, feeds_ai, source
) VALUES (
  'HT-002: Como configurar uma instância WhatsApp',
  $CONTENT$## Como configurar uma instância WhatsApp

**Categoria:** WhatsApp & Canais | **Tier:** 1 — Cliente | **Tempo de leitura:** 5 min

### Visão geral

Configure uma instância WhatsApp para começar a receber e enviar mensagens dos seus clientes diretamente pela plataforma Mais Simples.

### Pré-requisitos

- Acesso de administrador na plataforma
- Um número de telefone com WhatsApp ativo (de preferência WhatsApp Business)
- Celular em mãos para escanear o QR Code

### Passo a passo

1. No menu lateral, clique em **WhatsApp & Canais** > **Instâncias**.

2. Clique no botão **+ Nova Instância** no canto superior direito.

3. Preencha o **nome da instância** (ex.: "Atendimento Principal") e clique em **Criar**.

4. Aguarde a geração do **QR Code** na tela.

5. Abra o WhatsApp no celular, vá em **Configurações** > **Dispositivos conectados** > **Conectar dispositivo**.

6. Escaneie o **QR Code** exibido na plataforma com a câmera do celular.

7. Aguarde a sincronização. O status da instância mudará para **Conectada** (indicador verde).

8. Teste enviando uma mensagem pelo **Painel de Teste** clicando no ícone de teste ao lado da instância.

### Resultado esperado

A instância aparecerá com status **Conectada** na lista de instâncias. Mensagens recebidas nesse número aparecerão automaticamente na **Inbox** da plataforma.

### Solução de problemas

- **Se o QR Code expirar:** Clique em **Gerar novo QR Code** e escaneie novamente. O código expira em 60 segundos.
- **Se o status ficar "Desconectada":** Verifique se o celular está conectado à internet. Abra o WhatsApp no celular e confirme que o dispositivo vinculado ainda aparece na lista.
- **Se as mensagens não chegarem na Inbox:** Verifique se o webhook está configurado corretamente nas configurações da instância. Veja o guia de troubleshooting WhatsApp não conecta ou não envia mensagens.

### Artigos relacionados

- Troubleshooting: WhatsApp não conecta ou não envia mensagens
- Como usar o Kanban de atendimentos
- FAQ: Posso usar mais de um número de WhatsApp?$CONTENT$,
  'markdown',
  'how-to',
  (SELECT id FROM knowledge_products WHERE slug = 'whatsapp-canais'),
  (SELECT id FROM knowledge_groups WHERE name = 'Instancias WhatsApp' AND product_id = (SELECT id FROM knowledge_products WHERE slug = 'whatsapp-canais')),
  'tutorial',
  ARRAY['whatsapp', 'instancia', 'qr-code', 'configuracao'],
  'tier1',
  'public',
  true,
  '5 min',
  true,
  true,
  'kb_seed_v1'
) ;

INSERT INTO ai_knowledge_base (
  title, content, content_type, article_template, product_id, group_id,
  category, tags, audience_tier, visibility, rag_chunks,
  estimated_time, is_active, feeds_ai, source
) VALUES (
  'HT-003: Como criar um agente de IA',
  $CONTENT$## Como criar um agente de IA

**Categoria:** Agentes IA | **Tier:** 1 — Cliente | **Tempo de leitura:** 5 min

### Visão geral

Crie um agente de IA para responder automaticamente aos seus clientes. Você pode ter agentes especializados em suporte, vendas, financeiro e mais.

### Pré-requisitos

- Acesso de administrador na plataforma
- Pelo menos uma instância WhatsApp conectada
- Créditos de IA disponíveis no seu plano

### Passo a passo

1. No menu lateral, clique em **Agentes IA** > **Agentes**.

2. Clique no botão **+ Novo Agente**.

3. Escolha o **tipo do agente**:
   - **Triagem** — Identifica o assunto e direciona para o setor correto
   - **Suporte** — Responde dúvidas usando a base de conhecimento
   - **Financeiro** — Trata de cobranças, boletos e pagamentos
   - **Vendas** — Qualifica leads e apresenta produtos
   - **Copilot** — Auxilia o atendente humano com sugestões

4. Preencha o **nome** do agente (ex.: "Assistente de Suporte") e uma **descrição** breve do que ele faz.

5. Configure as **instruções do agente** no campo de prompt. Descreva o comportamento desejado em linguagem natural.

   > **Dica:** Seja específico. Em vez de "seja educado", escreva "sempre cumprimente o cliente pelo nome e ofereça ajuda de forma objetiva".

6. Na aba **Conhecimento**, vincule os documentos da base de conhecimento que o agente deve consultar para responder.

7. Na aba **Configurações**, defina:
   - **Temperatura** (0 = mais objetivo, 1 = mais criativo) — recomendamos 0.3 para suporte
   - **Máximo de tokens** por resposta
   - **Agente ativo** — ligue o toggle para ativar

8. Clique em **Salvar**.

9. Teste o agente no **Playground** clicando no botão **Testar no Playground**.

### Resultado esperado

O agente aparecerá na lista de agentes com status **Ativo**. Quando um cliente enviar mensagem pelo WhatsApp, o agente responderá automaticamente conforme as instruções configuradas.

### Solução de problemas

- **Se o agente não responder:** Verifique se o toggle "Agente ativo" está ligado e se há créditos de IA disponíveis em **Configurações** > **Consumo IA**.
- **Se as respostas estiverem genéricas:** Vincule documentos relevantes na aba Conhecimento e refine as instruções do prompt com mais detalhes.
- **Se o agente responder informações erradas:** Revise os documentos vinculados na base de conhecimento. O agente só sabe o que está nos documentos. Veja Troubleshooting: IA não responde ou responde errado.

### Artigos relacionados

- Troubleshooting: IA não responde ou responde errado
- Como adicionar um artigo à base de conhecimento
- Tutorial: Seu primeiro atendimento com IA$CONTENT$,
  'markdown',
  'how-to',
  (SELECT id FROM knowledge_products WHERE slug = 'agentes-ia'),
  (SELECT id FROM knowledge_groups WHERE name = 'Criacao de Agentes' AND product_id = (SELECT id FROM knowledge_products WHERE slug = 'agentes-ia')),
  'tutorial',
  ARRAY['agente-ia', 'criar', 'configurar', 'prompt', 'rag'],
  'tier1',
  'public',
  true,
  '5 min',
  true,
  true,
  'kb_seed_v1'
) ;

INSERT INTO ai_knowledge_base (
  title, content, content_type, article_template, product_id, group_id,
  category, tags, audience_tier, visibility, rag_chunks,
  estimated_time, is_active, feeds_ai, source
) VALUES (
  'HT-004: Como adicionar um artigo à base de conhecimento',
  $CONTENT$## Como adicionar um artigo à base de conhecimento

**Categoria:** Base de Conhecimento | **Tier:** 1 — Cliente | **Tempo de leitura:** 4 min

### Visão geral

Adicione artigos à base de conhecimento para que os agentes de IA possam usar essas informações nas respostas aos clientes. Quanto mais completa a base, melhores as respostas.

### Pré-requisitos

- Acesso de administrador na plataforma
- O conteúdo do artigo já redigido (pode ser um texto simples)

### Passo a passo

1. No menu lateral, clique em **Base de Conhecimento** > **Documentos**.

2. Clique no botão **+ Novo Documento**.

3. Selecione a **categoria** do documento (ex.: "Produtos", "Políticas", "Procedimentos").

   > **Dica:** Use categorias que façam sentido para o seu negócio. Exemplo: uma padaria pode ter "Encomendas", "Horários", "Cardápio".

4. Preencha o **título** do artigo de forma clara e objetiva (ex.: "Política de trocas e devoluções").

5. Escreva o **conteúdo** no editor de texto. Use parágrafos curtos e linguagem simples.

   > **Dica para IA:** Inclua perguntas e respostas no texto. Ex.: "Qual o prazo para troca? O prazo é de 7 dias." Isso ajuda a IA a encontrar a informação mais rápido.

6. Se desejar, adicione **anexos** (PDF, imagens) clicando em **Anexar arquivo**.

7. Clique em **Salvar e Publicar**.

8. Aguarde a mensagem de confirmação. O sistema processará o artigo automaticamente para uso pela IA (geração de embeddings).

### Resultado esperado

O artigo aparecerá na lista de documentos com status **Publicado**. Os agentes de IA passarão a usar esse conteúdo nas respostas em até 5 minutos após a publicação.

### Solução de problemas

- **Se o artigo não aparecer nas respostas da IA:** Aguarde até 5 minutos para o processamento. Se persistir, edite o artigo e salve novamente para forçar o reprocessamento.
- **Se a IA usar informações desatualizadas:** Edite o artigo com as informações corretas e salve. O conteúdo será reprocessado automaticamente.
- **Se o upload de anexo falhar:** Verifique se o arquivo tem menos de 10 MB e está em formato suportado (PDF, PNG, JPG).

### Artigos relacionados

- Como criar um agente de IA
- FAQ: Quais formatos de arquivo posso usar na base de conhecimento?
- FAQ: Quanto tempo leva para a IA usar um novo artigo?$CONTENT$,
  'markdown',
  'how-to',
  (SELECT id FROM knowledge_products WHERE slug = 'base-conhecimento'),
  (SELECT id FROM knowledge_groups WHERE name = 'Documentos & Artigos' AND product_id = (SELECT id FROM knowledge_products WHERE slug = 'base-conhecimento')),
  'tutorial',
  ARRAY['base-conhecimento', 'artigo', 'documento', 'embeddings'],
  'tier1',
  'public',
  true,
  '4 min',
  true,
  true,
  'kb_seed_v1'
) ;

INSERT INTO ai_knowledge_base (
  title, content, content_type, article_template, product_id, group_id,
  category, tags, audience_tier, visibility, rag_chunks,
  estimated_time, is_active, feeds_ai, source
) VALUES (
  'HT-005: Como usar o Kanban de atendimentos',
  $CONTENT$## Como usar o Kanban de atendimentos

**Categoria:** Atendimento & Tickets | **Tier:** 1 — Cliente | **Tempo de leitura:** 4 min

### Visão geral

Use o Kanban para visualizar e organizar todos os atendimentos da sua equipe em colunas, movendo tickets entre etapas como "Novo", "Em andamento" e "Resolvido".

### Pré-requisitos

- Acesso à plataforma (qualquer nível)
- Pelo menos um atendimento/ticket criado no sistema

### Passo a passo

1. No menu lateral, clique em **Atendimento** > **Kanban**.

2. Visualize as colunas do Kanban. Por padrão, você verá:
   - **Novo** — Tickets que acabaram de chegar
   - **Em andamento** — Tickets sendo atendidos
   - **Aguardando cliente** — Esperando resposta do cliente
   - **Resolvido** — Tickets finalizados

3. Para **mover um ticket**, clique e arraste o card de uma coluna para outra.

4. Para **ver os detalhes** de um ticket, clique sobre o card. Um painel lateral abrirá com o histórico completo da conversa.

5. Para **filtrar tickets**, use os filtros no topo da página:
   - Por **atendente** — veja apenas seus tickets
   - Por **prioridade** — filtre por urgência
   - Por **canal** — WhatsApp, e-mail, etc.

6. Para **atribuir um ticket** a outro atendente, abra o card e selecione o atendente no campo **Responsável**.

7. Para **adicionar uma nota interna** (visível só para a equipe), clique na aba **Notas** dentro do ticket e escreva sua observação.

### Resultado esperado

Você terá uma visão clara de todos os atendimentos organizados por etapa. Cada membro da equipe saberá exatamente quais tickets estão sob sua responsabilidade e em qual status.

### Solução de problemas

- **Se um ticket não aparecer no Kanban:** Verifique os filtros ativos no topo da página. Limpe todos os filtros clicando em **Limpar filtros**.
- **Se não conseguir arrastar o card:** Certifique-se de clicar e segurar no corpo do card (não no título). Em celulares, use toque longo para arrastar.
- **Se os tickets estiverem desatualizados:** Clique no ícone de **atualizar** no canto superior direito ou pressione F5 para recarregar a página.

### Artigos relacionados

- Tutorial: Seu primeiro atendimento com IA
- FAQ: Posso personalizar as colunas do Kanban?
- Como criar um agente de IA$CONTENT$,
  'markdown',
  'how-to',
  (SELECT id FROM knowledge_products WHERE slug = 'atendimento'),
  (SELECT id FROM knowledge_groups WHERE name = 'Kanban' AND product_id = (SELECT id FROM knowledge_products WHERE slug = 'atendimento')),
  'tutorial',
  ARRAY['kanban', 'tickets', 'atendimento', 'drag-and-drop'],
  'tier1',
  'public',
  true,
  '4 min',
  true,
  true,
  'kb_seed_v1'
) ;

-- ═══════════════════════════════════════════════════════════════════════════
-- FAQs — Primeiros Passos (4)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO ai_knowledge_base (
  title, content, content_type, article_template, product_id, group_id,
  category, tags, audience_tier, visibility, rag_chunks,
  estimated_time, is_active, feeds_ai, source
) VALUES (
  'FAQ-PP-01: Como faço para criar minha conta no Mais Simples?',
  $CONTENT$## Como faço para criar minha conta no Mais Simples?

Para criar sua conta, acesse **app.sismais.com/register** e preencha o formulário com seu nome, e-mail e senha (mínimo 6 caracteres). Após o cadastro, seu acesso passará por uma aprovação do administrador da sua empresa. Você receberá um e-mail de confirmação quando o acesso for liberado. O processo de aprovação costuma levar até 24 horas em dias úteis.$CONTENT$,
  'markdown',
  'faq',
  (SELECT id FROM knowledge_products WHERE slug = 'primeiros-passos'),
  (SELECT id FROM knowledge_groups WHERE name = 'Cadastro & Login' AND product_id = (SELECT id FROM knowledge_products WHERE slug = 'primeiros-passos')),
  'tutorial',
  ARRAY['conta', 'cadastro', 'registro', 'primeiros-passos'],
  'tier1',
  'public',
  true,
  '1 min',
  true,
  true,
  'kb_seed_v1'
) ;

INSERT INTO ai_knowledge_base (
  title, content, content_type, article_template, product_id, group_id,
  category, tags, audience_tier, visibility, rag_chunks,
  estimated_time, is_active, feeds_ai, source
) VALUES (
  'FAQ-PP-02: Qual navegador devo usar para acessar a plataforma?',
  $CONTENT$## Qual navegador devo usar para acessar a plataforma?

Recomendamos o Google Chrome, Microsoft Edge ou Mozilla Firefox em suas versões mais recentes. A plataforma funciona em qualquer navegador moderno, mas o Chrome oferece a melhor experiência. Evite o Internet Explorer, que não é suportado. No celular, você também pode acessar pelo navegador — a plataforma se adapta a telas menores.$CONTENT$,
  'markdown',
  'faq',
  (SELECT id FROM knowledge_products WHERE slug = 'primeiros-passos'),
  (SELECT id FROM knowledge_groups WHERE name = 'Cadastro & Login' AND product_id = (SELECT id FROM knowledge_products WHERE slug = 'primeiros-passos')),
  'tutorial',
  ARRAY['navegador', 'browser', 'compatibilidade', 'primeiros-passos'],
  'tier1',
  'public',
  true,
  '1 min',
  true,
  true,
  'kb_seed_v1'
) ;

INSERT INTO ai_knowledge_base (
  title, content, content_type, article_template, product_id, group_id,
  category, tags, audience_tier, visibility, rag_chunks,
  estimated_time, is_active, feeds_ai, source
) VALUES (
  'FAQ-PP-03: Meu acesso está pendente de aprovação, o que fazer?',
  $CONTENT$## Meu acesso está pendente de aprovação, o que fazer?

Seu cadastro precisa ser aprovado pelo administrador da sua empresa antes de você conseguir acessar o sistema. Isso é uma medida de segurança. Entre em contato com o responsável pela plataforma na sua empresa e peça que acesse **Configurações** > **Equipe** para aprovar seu acesso. Se você é o administrador e está com acesso pendente, entre em contato com o suporte Sismais pelo WhatsApp.$CONTENT$,
  'markdown',
  'faq',
  (SELECT id FROM knowledge_products WHERE slug = 'primeiros-passos'),
  (SELECT id FROM knowledge_groups WHERE name = 'Aprovacao de Acesso' AND product_id = (SELECT id FROM knowledge_products WHERE slug = 'primeiros-passos')),
  'tutorial',
  ARRAY['acesso', 'aprovacao', 'pendente', 'primeiros-passos'],
  'tier1',
  'public',
  true,
  '1 min',
  true,
  true,
  'kb_seed_v1'
) ;

INSERT INTO ai_knowledge_base (
  title, content, content_type, article_template, product_id, group_id,
  category, tags, audience_tier, visibility, rag_chunks,
  estimated_time, is_active, feeds_ai, source
) VALUES (
  'FAQ-PP-04: Esqueci minha senha, como recuperar?',
  $CONTENT$## Esqueci minha senha, como recuperar?

Na tela de login, clique em **Esqueci minha senha**, digite seu e-mail cadastrado e clique em **Enviar**. Você receberá um e-mail com um link para criar uma nova senha. O link expira em 1 hora. Se não receber o e-mail, verifique a pasta de spam. Lembre-se: a nova senha precisa ter no mínimo 6 caracteres.$CONTENT$,
  'markdown',
  'faq',
  (SELECT id FROM knowledge_products WHERE slug = 'primeiros-passos'),
  (SELECT id FROM knowledge_groups WHERE name = 'Cadastro & Login' AND product_id = (SELECT id FROM knowledge_products WHERE slug = 'primeiros-passos')),
  'tutorial',
  ARRAY['senha', 'recuperar', 'esqueci', 'redefinir'],
  'tier1',
  'public',
  true,
  '1 min',
  true,
  true,
  'kb_seed_v1'
) ;

-- ═══════════════════════════════════════════════════════════════════════════
-- FAQs — Atendimento (4)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO ai_knowledge_base (
  title, content, content_type, article_template, product_id, group_id,
  category, tags, audience_tier, visibility, rag_chunks,
  estimated_time, is_active, feeds_ai, source
) VALUES (
  'FAQ-AT-01: Como vejo os atendimentos que estão na fila esperando?',
  $CONTENT$## Como vejo os atendimentos que estão na fila esperando?

Acesse **Atendimento** > **Fila** no menu lateral para ver todos os atendimentos aguardando um atendente. Os itens na fila são organizados por ordem de chegada, com os mais antigos no topo. Você pode clicar em **Assumir** para pegar um atendimento para si. Se sua equipe usa distribuição automática, os tickets serão direcionados conforme as regras configuradas pelo administrador.$CONTENT$,
  'markdown',
  'faq',
  (SELECT id FROM knowledge_products WHERE slug = 'atendimento'),
  (SELECT id FROM knowledge_groups WHERE name = 'Inbox & Fila' AND product_id = (SELECT id FROM knowledge_products WHERE slug = 'atendimento')),
  'tutorial',
  ARRAY['fila', 'atendimento', 'inbox', 'aguardando'],
  'tier1',
  'public',
  true,
  '1 min',
  true,
  true,
  'kb_seed_v1'
) ;

INSERT INTO ai_knowledge_base (
  title, content, content_type, article_template, product_id, group_id,
  category, tags, audience_tier, visibility, rag_chunks,
  estimated_time, is_active, feeds_ai, source
) VALUES (
  'FAQ-AT-02: Como envio uma mensagem para o cliente durante o atendimento?',
  $CONTENT$## Como envio uma mensagem para o cliente durante o atendimento?

Abra o ticket do cliente pela **Inbox** ou pelo **Kanban** e digite sua mensagem no campo de texto na parte inferior da conversa. Pressione **Enter** ou clique no botão de enviar. A mensagem será enviada pelo mesmo canal que o cliente usou (WhatsApp, por exemplo). Você também pode enviar imagens, documentos e áudios usando o ícone de anexo ao lado do campo de texto.$CONTENT$,
  'markdown',
  'faq',
  (SELECT id FROM knowledge_products WHERE slug = 'atendimento'),
  (SELECT id FROM knowledge_groups WHERE name = 'Inbox & Fila' AND product_id = (SELECT id FROM knowledge_products WHERE slug = 'atendimento')),
  'tutorial',
  ARRAY['mensagem', 'enviar', 'atendimento', 'inbox'],
  'tier1',
  'public',
  true,
  '1 min',
  true,
  true,
  'kb_seed_v1'
) ;

INSERT INTO ai_knowledge_base (
  title, content, content_type, article_template, product_id, group_id,
  category, tags, audience_tier, visibility, rag_chunks,
  estimated_time, is_active, feeds_ai, source
) VALUES (
  'FAQ-AT-03: Como finalizo um atendimento?',
  $CONTENT$## Como finalizo um atendimento?

Para resolver um ticket, abra o atendimento e clique no botão **Resolver** no topo da conversa. Você pode adicionar uma nota de resolução antes de fechar. O cliente receberá uma pesquisa de satisfação (CSAT) automaticamente, se essa função estiver ativada. Tickets resolvidos vão para a coluna "Resolvido" no Kanban e ficam acessíveis no histórico.$CONTENT$,
  'markdown',
  'faq',
  (SELECT id FROM knowledge_products WHERE slug = 'atendimento'),
  (SELECT id FROM knowledge_groups WHERE name = 'Kanban' AND product_id = (SELECT id FROM knowledge_products WHERE slug = 'atendimento')),
  'tutorial',
  ARRAY['finalizar', 'resolver', 'ticket', 'atendimento'],
  'tier1',
  'public',
  true,
  '1 min',
  true,
  true,
  'kb_seed_v1'
) ;

INSERT INTO ai_knowledge_base (
  title, content, content_type, article_template, product_id, group_id,
  category, tags, audience_tier, visibility, rag_chunks,
  estimated_time, is_active, feeds_ai, source
) VALUES (
  'FAQ-AT-04: Posso personalizar as colunas do Kanban?',
  $CONTENT$## Posso personalizar as colunas do Kanban?

Sim, o administrador pode personalizar as colunas do Kanban. Acesse **Configurações** > **Categorias** para criar, renomear ou reordenar as etapas do fluxo de atendimento. Cada coluna representa uma etapa e você pode criar quantas precisar para o fluxo da sua empresa (ex.: "Aguardando peça", "Em análise técnica").$CONTENT$,
  'markdown',
  'faq',
  (SELECT id FROM knowledge_products WHERE slug = 'atendimento'),
  (SELECT id FROM knowledge_groups WHERE name = 'Kanban' AND product_id = (SELECT id FROM knowledge_products WHERE slug = 'atendimento')),
  'tutorial',
  ARRAY['kanban', 'colunas', 'personalizar', 'configurar'],
  'tier1',
  'public',
  true,
  '1 min',
  true,
  true,
  'kb_seed_v1'
) ;

-- ═══════════════════════════════════════════════════════════════════════════
-- FAQs — Agentes IA (4)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO ai_knowledge_base (
  title, content, content_type, article_template, product_id, group_id,
  category, tags, audience_tier, visibility, rag_chunks,
  estimated_time, is_active, feeds_ai, source
) VALUES (
  'FAQ-IA-01: Quantos agentes de IA posso criar?',
  $CONTENT$## Quantos agentes de IA posso criar?

A quantidade de agentes depende do seu plano. No plano **Gratuito (GMS)**, você pode criar 1 agente. No plano **PRO (GMS)**, até 5 agentes. No plano **Enterprise (Maxpró)**, agentes ilimitados. Cada agente pode ter uma especialidade diferente (suporte, vendas, financeiro), permitindo que você automatize vários setores do atendimento.$CONTENT$,
  'markdown',
  'faq',
  (SELECT id FROM knowledge_products WHERE slug = 'agentes-ia'),
  (SELECT id FROM knowledge_groups WHERE name = 'Criacao de Agentes' AND product_id = (SELECT id FROM knowledge_products WHERE slug = 'agentes-ia')),
  'tutorial',
  ARRAY['agente-ia', 'limite', 'plano', 'quantidade'],
  'tier1',
  'public',
  true,
  '1 min',
  true,
  true,
  'kb_seed_v1'
) ;

INSERT INTO ai_knowledge_base (
  title, content, content_type, article_template, product_id, group_id,
  category, tags, audience_tier, visibility, rag_chunks,
  estimated_time, is_active, feeds_ai, source
) VALUES (
  'FAQ-IA-02: O que são créditos de IA e como funcionam?',
  $CONTENT$## O que são créditos de IA e como funcionam?

Créditos de IA são a moeda que a plataforma usa para processar as respostas dos agentes. Cada resposta gerada pelo agente consome uma quantidade de créditos que varia conforme o tamanho da conversa. Você pode acompanhar seu consumo em **Configurações** > **Consumo IA**. Quando os créditos acabam, o agente para de responder e o atendimento é direcionado para um humano. Créditos são renovados mensalmente conforme seu plano.$CONTENT$,
  'markdown',
  'faq',
  (SELECT id FROM knowledge_products WHERE slug = 'agentes-ia'),
  (SELECT id FROM knowledge_groups WHERE name = 'Criacao de Agentes' AND product_id = (SELECT id FROM knowledge_products WHERE slug = 'agentes-ia')),
  'tutorial',
  ARRAY['creditos-ia', 'tokens', 'consumo', 'plano'],
  'tier1',
  'public',
  true,
  '1 min',
  true,
  true,
  'kb_seed_v1'
) ;

INSERT INTO ai_knowledge_base (
  title, content, content_type, article_template, product_id, group_id,
  category, tags, audience_tier, visibility, rag_chunks,
  estimated_time, is_active, feeds_ai, source
) VALUES (
  'FAQ-IA-03: Posso testar meu agente antes de colocá-lo para atender clientes?',
  $CONTENT$## Posso testar meu agente antes de colocá-lo para atender clientes?

Sim, use o **Playground** para testar qualquer agente. Acesse **Agentes IA** > **Agentes**, clique no agente desejado e depois em **Testar no Playground**. Ali você pode simular conversas reais e ajustar as instruções até ficar satisfeito com as respostas. As conversas do Playground não afetam seus atendimentos reais nem consomem créditos do plano.$CONTENT$,
  'markdown',
  'faq',
  (SELECT id FROM knowledge_products WHERE slug = 'agentes-ia'),
  (SELECT id FROM knowledge_groups WHERE name = 'Criacao de Agentes' AND product_id = (SELECT id FROM knowledge_products WHERE slug = 'agentes-ia')),
  'tutorial',
  ARRAY['playground', 'testar', 'agente-ia', 'simulacao'],
  'tier1',
  'public',
  true,
  '1 min',
  true,
  true,
  'kb_seed_v1'
) ;

INSERT INTO ai_knowledge_base (
  title, content, content_type, article_template, product_id, group_id,
  category, tags, audience_tier, visibility, rag_chunks,
  estimated_time, is_active, feeds_ai, source
) VALUES (
  'FAQ-IA-04: Como faço para o agente de IA transferir o atendimento para um humano?',
  $CONTENT$## Como faço para o agente de IA transferir o atendimento para um humano?

O agente transfere automaticamente quando não consegue resolver o problema ou quando o cliente pede para falar com um atendente. Você também pode configurar regras de transferência nas instruções do agente, por exemplo: "Se o cliente mencionar cancelamento, transfira para um atendente humano." Na aba **Configurações** do agente, há a opção **Escalar para humano** que define o comportamento padrão de transferência.$CONTENT$,
  'markdown',
  'faq',
  (SELECT id FROM knowledge_products WHERE slug = 'agentes-ia'),
  (SELECT id FROM knowledge_groups WHERE name = 'Supervisao & Copilot' AND product_id = (SELECT id FROM knowledge_products WHERE slug = 'agentes-ia')),
  'tutorial',
  ARRAY['transferir', 'humano', 'escalar', 'agente-ia'],
  'tier1',
  'public',
  true,
  '1 min',
  true,
  true,
  'kb_seed_v1'
) ;

-- ═══════════════════════════════════════════════════════════════════════════
-- FAQs — Base de Conhecimento (3)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO ai_knowledge_base (
  title, content, content_type, article_template, product_id, group_id,
  category, tags, audience_tier, visibility, rag_chunks,
  estimated_time, is_active, feeds_ai, source
) VALUES (
  'FAQ-BC-01: Para que serve a base de conhecimento?',
  $CONTENT$## Para que serve a base de conhecimento?

A base de conhecimento é o "cérebro" dos seus agentes de IA. Nela você cadastra informações sobre sua empresa, produtos, serviços, políticas e procedimentos. Quando um cliente faz uma pergunta, o agente consulta essa base para dar uma resposta precisa. Quanto mais completa e atualizada a base, melhores serão as respostas da IA. Seus clientes também podem acessar artigos diretamente pela Central do Cliente.$CONTENT$,
  'markdown',
  'faq',
  (SELECT id FROM knowledge_products WHERE slug = 'base-conhecimento'),
  (SELECT id FROM knowledge_groups WHERE name = 'Documentos & Artigos' AND product_id = (SELECT id FROM knowledge_products WHERE slug = 'base-conhecimento')),
  'tutorial',
  ARRAY['base-conhecimento', 'rag', 'IA', 'documentos'],
  'tier1',
  'public',
  true,
  '1 min',
  true,
  true,
  'kb_seed_v1'
) ;

INSERT INTO ai_knowledge_base (
  title, content, content_type, article_template, product_id, group_id,
  category, tags, audience_tier, visibility, rag_chunks,
  estimated_time, is_active, feeds_ai, source
) VALUES (
  'FAQ-BC-02: Quais formatos de arquivo posso usar na base de conhecimento?',
  $CONTENT$## Quais formatos de arquivo posso usar na base de conhecimento?

Você pode adicionar artigos em texto diretamente no editor da plataforma e anexar arquivos em PDF, PNG e JPG. O sistema processa automaticamente o conteúdo dos PDFs para que a IA consiga ler e usar as informações. Recomendamos usar textos diretos no editor sempre que possível, pois o processamento é mais preciso do que em arquivos anexados. O tamanho máximo por arquivo é 10 MB.$CONTENT$,
  'markdown',
  'faq',
  (SELECT id FROM knowledge_products WHERE slug = 'base-conhecimento'),
  (SELECT id FROM knowledge_groups WHERE name = 'Documentos & Artigos' AND product_id = (SELECT id FROM knowledge_products WHERE slug = 'base-conhecimento')),
  'tutorial',
  ARRAY['formato', 'arquivo', 'pdf', 'upload', 'base-conhecimento'],
  'tier1',
  'public',
  true,
  '1 min',
  true,
  true,
  'kb_seed_v1'
) ;

INSERT INTO ai_knowledge_base (
  title, content, content_type, article_template, product_id, group_id,
  category, tags, audience_tier, visibility, rag_chunks,
  estimated_time, is_active, feeds_ai, source
) VALUES (
  'FAQ-BC-03: Quanto tempo leva para a IA usar um novo artigo?',
  $CONTENT$## Quanto tempo leva para a IA usar um novo artigo?

Após salvar e publicar um artigo, o sistema leva até 5 minutos para processar o conteúdo e disponibilizá-lo para os agentes de IA. Esse processamento envolve a geração de embeddings (representações do texto que a IA usa para buscar informações). Você não precisa fazer nada além de salvar — o processo é automático.$CONTENT$,
  'markdown',
  'faq',
  (SELECT id FROM knowledge_products WHERE slug = 'base-conhecimento'),
  (SELECT id FROM knowledge_groups WHERE name = 'Documentos & Artigos' AND product_id = (SELECT id FROM knowledge_products WHERE slug = 'base-conhecimento')),
  'tutorial',
  ARRAY['embeddings', 'processamento', 'tempo', 'base-conhecimento'],
  'tier1',
  'public',
  true,
  '1 min',
  true,
  true,
  'kb_seed_v1'
) ;

-- ═══════════════════════════════════════════════════════════════════════════
-- FAQs — WhatsApp (3)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO ai_knowledge_base (
  title, content, content_type, article_template, product_id, group_id,
  category, tags, audience_tier, visibility, rag_chunks,
  estimated_time, is_active, feeds_ai, source
) VALUES (
  'FAQ-WPP-01: Posso usar mais de um número de WhatsApp?',
  $CONTENT$## Posso usar mais de um número de WhatsApp?

Sim, você pode conectar múltiplas instâncias WhatsApp na plataforma. Cada instância representa um número diferente. Isso é útil se você tem setores separados (ex.: um número para vendas, outro para suporte). Acesse **WhatsApp & Canais** > **Instâncias** para gerenciar todas as suas conexões. A quantidade de instâncias disponíveis depende do seu plano.$CONTENT$,
  'markdown',
  'faq',
  (SELECT id FROM knowledge_products WHERE slug = 'whatsapp-canais'),
  (SELECT id FROM knowledge_groups WHERE name = 'Instancias WhatsApp' AND product_id = (SELECT id FROM knowledge_products WHERE slug = 'whatsapp-canais')),
  'tutorial',
  ARRAY['whatsapp', 'multiplos-numeros', 'instancias'],
  'tier1',
  'public',
  true,
  '1 min',
  true,
  true,
  'kb_seed_v1'
) ;

INSERT INTO ai_knowledge_base (
  title, content, content_type, article_template, product_id, group_id,
  category, tags, audience_tier, visibility, rag_chunks,
  estimated_time, is_active, feeds_ai, source
) VALUES (
  'FAQ-WPP-02: O WhatsApp do meu celular vai parar de funcionar se eu conectar à plataforma?',
  $CONTENT$## O WhatsApp do meu celular vai parar de funcionar se eu conectar à plataforma?

Não, seu WhatsApp continua funcionando normalmente no celular. A plataforma se conecta como um dispositivo adicional, igual ao WhatsApp Web. Você pode usar o celular e a plataforma ao mesmo tempo. Porém, mensagens enviadas pela plataforma aparecerão no seu celular e vice-versa. Recomendamos responder apenas pela plataforma para manter o histórico organizado.$CONTENT$,
  'markdown',
  'faq',
  (SELECT id FROM knowledge_products WHERE slug = 'whatsapp-canais'),
  (SELECT id FROM knowledge_groups WHERE name = 'Instancias WhatsApp' AND product_id = (SELECT id FROM knowledge_products WHERE slug = 'whatsapp-canais')),
  'tutorial',
  ARRAY['whatsapp', 'celular', 'dispositivo', 'funcionamento'],
  'tier1',
  'public',
  true,
  '1 min',
  true,
  true,
  'kb_seed_v1'
) ;

INSERT INTO ai_knowledge_base (
  title, content, content_type, article_template, product_id, group_id,
  category, tags, audience_tier, visibility, rag_chunks,
  estimated_time, is_active, feeds_ai, source
) VALUES (
  'FAQ-WPP-03: As mensagens antigas do WhatsApp vão aparecer na plataforma?',
  $CONTENT$## As mensagens antigas do WhatsApp vão aparecer na plataforma?

Não, a plataforma só recebe mensagens novas a partir do momento em que a instância é conectada. Mensagens anteriores à conexão não são importadas. Se precisar do histórico anterior, ele continua disponível no WhatsApp do celular normalmente.$CONTENT$,
  'markdown',
  'faq',
  (SELECT id FROM knowledge_products WHERE slug = 'whatsapp-canais'),
  (SELECT id FROM knowledge_groups WHERE name = 'Mensagens & Contatos' AND product_id = (SELECT id FROM knowledge_products WHERE slug = 'whatsapp-canais')),
  'tutorial',
  ARRAY['whatsapp', 'historico', 'mensagens-antigas'],
  'tier1',
  'public',
  true,
  '1 min',
  true,
  true,
  'kb_seed_v1'
) ;

-- ═══════════════════════════════════════════════════════════════════════════
-- FAQs — Configuracoes (2)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO ai_knowledge_base (
  title, content, content_type, article_template, product_id, group_id,
  category, tags, audience_tier, visibility, rag_chunks,
  estimated_time, is_active, feeds_ai, source
) VALUES (
  'FAQ-CF-01: Como adiciono novos membros à minha equipe?',
  $CONTENT$## Como adiciono novos membros à minha equipe?

Acesse **Configurações** > **Equipe** e clique em **+ Convidar membro**. Digite o e-mail da pessoa e selecione o perfil de acesso (Administrador, Atendente ou Visualizador). A pessoa receberá um convite por e-mail para criar a conta. Após o cadastro, você precisa aprovar o acesso na mesma tela de Equipe.$CONTENT$,
  'markdown',
  'faq',
  (SELECT id FROM knowledge_products WHERE slug = 'configuracoes'),
  (SELECT id FROM knowledge_groups WHERE name = 'Equipe & Permissoes' AND product_id = (SELECT id FROM knowledge_products WHERE slug = 'configuracoes')),
  'tutorial',
  ARRAY['equipe', 'convidar', 'membro', 'permissoes'],
  'tier1',
  'public',
  true,
  '1 min',
  true,
  true,
  'kb_seed_v1'
) ;

INSERT INTO ai_knowledge_base (
  title, content, content_type, article_template, product_id, group_id,
  category, tags, audience_tier, visibility, rag_chunks,
  estimated_time, is_active, feeds_ai, source
) VALUES (
  'FAQ-CF-02: Como altero o horário de funcionamento do atendimento?',
  $CONTENT$## Como altero o horário de funcionamento do atendimento?

Acesse **Configurações** > **Geral** > **Horário de atendimento**. Defina os dias e horários em que sua equipe está disponível. Fora desse horário, o sistema pode responder automaticamente com uma mensagem de ausência ou continuar com atendimento apenas por IA. Você também pode configurar **feriados** em **Configurações** > **Feriados** para que a plataforma considere esses dias como não-úteis.$CONTENT$,
  'markdown',
  'faq',
  (SELECT id FROM knowledge_products WHERE slug = 'configuracoes'),
  (SELECT id FROM knowledge_groups WHERE name = 'Gerais' AND product_id = (SELECT id FROM knowledge_products WHERE slug = 'configuracoes')),
  'tutorial',
  ARRAY['horario', 'funcionamento', 'configuracoes', 'ausencia'],
  'tier1',
  'public',
  true,
  '1 min',
  true,
  true,
  'kb_seed_v1'
) ;

-- ═══════════════════════════════════════════════════════════════════════════
-- TROUBLESHOOTING GUIDES (3)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO ai_knowledge_base (
  title, content, content_type, article_template, product_id, group_id,
  category, tags, audience_tier, visibility, rag_chunks,
  estimated_time, is_active, feeds_ai, source
) VALUES (
  'TS-001: IA não responde ou responde errado',
  $CONTENT$## TS-001: IA não responde ou responde errado

**Categoria:** Agentes IA | **Tiers:** 1 e 2 | **Severidade:** Alta

### Sintomas

- O agente de IA não envia nenhuma resposta quando o cliente manda mensagem
- O agente responde com informações incorretas ou genéricas
- O agente responde "Não tenho informações sobre isso" mesmo quando o conteúdo existe na base
- Mensagem de erro "Créditos de IA esgotados" no painel

### Árvore de diagnóstico

```
Cliente reporta problema com IA
│
├─ IA não responde nada?
│  ├─ SIM → Verificar créditos de IA
│  │         ├─ Créditos zerados → CAUSA A (créditos esgotados)
│  │         └─ Créditos disponíveis → Verificar status do agente
│  │              ├─ Agente desativado → CAUSA B (agente inativo)
│  │              └─ Agente ativo → Verificar instância WhatsApp
│  │                   ├─ Instância offline → Ver TS-002
│  │                   └─ Instância online → ESCALAR para Tier 2
│  │
│  └─ NÃO (IA responde, mas errado) → Verificar base de conhecimento
│       ├─ Base vazia ou sem conteúdo relevante → CAUSA C (RAG sem conteúdo)
│       ├─ Conteúdo existe mas IA ignora → CAUSA D (configuração do agente)
│       └─ Conteúdo existe e IA acha mas distorce → CAUSA E (prompt inadequado)
```

### Soluções por causa raiz

#### CAUSA A: Créditos de IA esgotados

1. Acesse **Configurações** > **Consumo IA**.
2. Verifique o saldo de créditos restante.
3. Se zerado, os agentes param de responder automaticamente e os atendimentos são encaminhados para humanos.
4. **Para resolver:** Faça upgrade do plano ou aguarde a renovação mensal.
5. **Paliativo imediato:** Ative o atendimento humano para cobrir enquanto os créditos não são renovados.

#### CAUSA B: Agente inativo ou mal configurado

1. Acesse **Agentes IA** > **Agentes**.
2. Verifique se o toggle **Agente ativo** está ligado (verde).
3. Verifique se o agente está vinculado à instância WhatsApp correta.
4. Se o agente aparece ativo mas não responde, clique em **Editar** e verifique se o campo de **instruções** não está vazio.
5. Salve novamente para forçar a atualização.

#### CAUSA C: RAG sem conteúdo relevante

1. Acesse **Base de Conhecimento** > **Documentos**.
2. Verifique se existem artigos publicados sobre o tema que o cliente perguntou.
3. Se não existem, crie o artigo seguindo o guia Como adicionar um artigo à base de conhecimento.
4. Se existem, edite o artigo e verifique se o conteúdo responde diretamente à pergunta do cliente.
5. Salve novamente para reprocessar os embeddings.
6. Aguarde 5 minutos e teste no Playground.

#### CAUSA D: Configuração do agente inadequada

1. Acesse **Agentes IA** > **Agentes** > clique no agente com problema.
2. Na aba **Conhecimento**, verifique se os documentos corretos estão vinculados.
3. Se nenhum documento estiver vinculado, o agente não terá informações para consultar.
4. Vincule os documentos relevantes e salve.

#### CAUSA E: Prompt inadequado

1. Edite as **instruções** do agente.
2. Seja mais específico sobre o comportamento desejado.
3. Adicione exemplos de perguntas e respostas esperadas.
4. Reduza a **temperatura** para 0.2-0.3 (respostas mais precisas e menos criativas).
5. Teste no Playground até as respostas ficarem satisfatórias.

### Caminho de escalação

- **Tier 1 → Tier 2:** Se após verificar créditos, status do agente e base de conhecimento, o problema persistir.
- **Tier 2 → Desenvolvimento:** Se há indício de erro no processamento de embeddings (artigo existe, está vinculado, mas a IA consistentemente não encontra).
- **Informações para escalar:** ID do agente, ID do ticket, print da conversa com a resposta errada, conteúdo esperado vs. recebido.

### Prevenção

- Revise os créditos de IA semanalmente em **Configurações** > **Consumo IA**
- Teste os agentes no Playground após qualquer alteração na base de conhecimento
- Mantenha a base de conhecimento atualizada — informações desatualizadas geram respostas erradas
- Configure alertas de créditos baixos (quando disponível no plano)$CONTENT$,
  'markdown',
  'troubleshooting',
  (SELECT id FROM knowledge_products WHERE slug = 'agentes-ia'),
  (SELECT id FROM knowledge_groups WHERE name = 'Criacao de Agentes' AND product_id = (SELECT id FROM knowledge_products WHERE slug = 'agentes-ia')),
  'tutorial',
  ARRAY['ia', 'erro', 'nao-responde', 'resposta-errada', 'troubleshooting'],
  'tier1',
  'public',
  true,
  '5 min',
  true,
  true,
  'kb_seed_v1'
) ;

INSERT INTO ai_knowledge_base (
  title, content, content_type, article_template, product_id, group_id,
  category, tags, audience_tier, visibility, rag_chunks,
  estimated_time, is_active, feeds_ai, source
) VALUES (
  'TS-002: WhatsApp não conecta ou não envia mensagens',
  $CONTENT$## TS-002: WhatsApp não conecta ou não envia mensagens

**Categoria:** WhatsApp & Canais | **Tiers:** 1 e 2 | **Severidade:** Crítica

### Sintomas

- Instância WhatsApp com status "Desconectada" (bolinha vermelha)
- QR Code não aparece ou aparece e expira repetidamente
- Mensagens enviadas pela plataforma não chegam ao cliente
- Mensagens do cliente não aparecem na Inbox
- Erro "Token inválido" ou "Instância não encontrada" nos logs

### Árvore de diagnóstico

```
Problema com WhatsApp reportado
│
├─ Instância mostra "Desconectada"?
│  ├─ SIM → Verificar WhatsApp no celular
│  │         ├─ Celular sem internet → Conectar celular à internet
│  │         ├─ WhatsApp pede login novamente → Reconectar via QR Code
│  │         └─ Celular OK → Tentar reconectar pela plataforma
│  │              ├─ QR Code funciona → RESOLVIDO (reconexão simples)
│  │              └─ QR Code não aparece → CAUSA A (instância corrompida)
│  │
│  └─ NÃO (Instância mostra "Conectada")
│       ├─ Mensagens não saem → CAUSA B (token ou webhook)
│       └─ Mensagens não chegam → CAUSA C (webhook não configurado)
│
├─ Erro "Token inválido"? → CAUSA B (token expirado/inválido)
│
└─ Erro "Instância não encontrada"? → CAUSA A (instância precisa ser recriada)
```

### Soluções por causa raiz

#### CAUSA A: Instância offline ou corrompida

1. Acesse **WhatsApp & Canais** > **Instâncias**.
2. Clique no botão **Reconectar** ao lado da instância com problema.
3. Se aparecer o QR Code, escaneie com o celular.
4. Se não aparecer o QR Code:
   - Clique em **Excluir instância**.
   - Crie uma nova instância seguindo o guia Como configurar uma instância WhatsApp.
   - Escaneie o QR Code com o mesmo número.
5. Verifique se o status mudou para **Conectada** (bolinha verde).

#### CAUSA B: Token inválido ou expirado

1. Acesse **WhatsApp & Canais** > **Instâncias** > clique na instância com problema.
2. Vá na aba **Configurações da Instância**.
3. Verifique o campo **Token UAZAPI**.
4. Se o token estiver vazio ou marcado como inválido:
   - Acesse o painel UAZAPI (**Tier 2 apenas**).
   - Gere um novo token para essa instância.
   - Cole o novo token na plataforma e salve.
5. Teste enviando uma mensagem pelo Painel de Teste.

#### CAUSA C: Webhook não configurado

1. Acesse **WhatsApp & Canais** > **Instâncias** > clique na instância.
2. Vá na aba **Webhook**.
3. Verifique se a URL de webhook está preenchida e correta.
4. O formato correto é: `https://[seu-projeto].supabase.co/functions/v1/whatsapp-webhook`
5. Verifique se o webhook está **ativo** (toggle ligado).
6. Clique em **Testar webhook** para validar a conexão.
7. Se o teste falhar, verifique se não há firewall ou proxy bloqueando a conexão.

### Caminho de escalação

- **Tier 1 → Tier 2:** Se a reconexão via QR Code e reinicialização da instância não resolverem.
- **Tier 2 → DevOps:** Se o problema for no webhook, token UAZAPI ou infraestrutura.
- **Informações para escalar:** ID da instância, número de telefone, screenshots do status, logs de webhook (se disponíveis em **Sistema** > **Webhook Logs**).

### Prevenção

- Mantenha o WhatsApp do celular sempre atualizado e com internet estável
- Não desconecte o dispositivo vinculado pelo celular — isso derruba a instância na plataforma
- Verifique o status das instâncias diariamente no Dashboard
- Configure alertas de desconexão (quando disponível)$CONTENT$,
  'markdown',
  'troubleshooting',
  (SELECT id FROM knowledge_products WHERE slug = 'whatsapp-canais'),
  (SELECT id FROM knowledge_groups WHERE name = 'Instancias WhatsApp' AND product_id = (SELECT id FROM knowledge_products WHERE slug = 'whatsapp-canais')),
  'tutorial',
  ARRAY['whatsapp', 'desconectado', 'nao-envia', 'webhook', 'troubleshooting'],
  'tier1',
  'public',
  true,
  '5 min',
  true,
  true,
  'kb_seed_v1'
) ;

INSERT INTO ai_knowledge_base (
  title, content, content_type, article_template, product_id, group_id,
  category, tags, audience_tier, visibility, rag_chunks,
  estimated_time, is_active, feeds_ai, source
) VALUES (
  'TS-003: Sincronização GL falha',
  $CONTENT$## TS-003: Sincronização GL falha

**Categoria:** CRM & Clientes | **Tiers:** 1 e 2 | **Severidade:** Alta

### Sintomas

- Mensagem de erro "Falha na sincronização" ao tentar sincronizar com o Sismais GL (ERP)
- Dados de clientes diferentes entre a plataforma e o GL
- Sincronização inicia mas não conclui (timeout)
- Clientes duplicados após tentativa de sincronização
- Erro "Credenciais inválidas" ao configurar a integração

### Árvore de diagnóstico

```
Problema de sincronização GL reportado
│
├─ Erro "Credenciais inválidas"?
│  └─ SIM → CAUSA A (credenciais incorretas ou expiradas)
│
├─ Sincronização inicia mas trava/timeout?
│  └─ SIM → Verificar volume de dados
│       ├─ Muitos registros (>5.000) → CAUSA B (timeout por volume)
│       └─ Poucos registros → CAUSA C (erro de conexão)
│
├─ Dados divergentes entre plataforma e GL?
│  └─ SIM → CAUSA D (dados divergentes / conflito)
│
└─ Clientes duplicados?
   └─ SIM → CAUSA D (dados divergentes / conflito)
```

### Soluções por causa raiz

#### CAUSA A: Credenciais incorretas ou expiradas

1. Acesse **CRM & Clientes** > **GL Sync** (ou **Configurações** > **Integrações**).
2. Verifique se as credenciais do Sismais GL estão preenchidas (usuário e chave de API).
3. Se estiverem vazias ou com erro:
   - Acesse o Sismais GL com suas credenciais de administrador.
   - Gere uma nova chave de API em **Configurações** > **API**.
   - Cole a nova chave na plataforma e salve.
4. Clique em **Testar conexão** para validar.

#### CAUSA B: Timeout por volume de dados

1. Ao sincronizar pela primeira vez com muitos clientes, o processo pode demorar.
2. **Para resolver:** Sincronize em lotes menores.
   - Filtre por data de cadastro ou grupo de clientes.
   - Sincronize um grupo de cada vez.
3. Se o timeout persistir, tente em horário de menor uso (manhã cedo ou noite).
4. **Tier 2:** Verifique os logs em **Sistema** > **Auditoria** para identificar em qual ponto a sincronização parou.

#### CAUSA C: Erro de conexão

1. Verifique se o servidor do Sismais GL está online.
2. Tente acessar o GL pelo navegador — se não carregar, o problema é no servidor GL.
3. Se o GL está online mas a sincronização falha:
   - Verifique se há bloqueio de firewall entre os servidores.
   - **Escale para Tier 2/DevOps.**

#### CAUSA D: Dados divergentes ou duplicatas

1. Acesse **CRM & Clientes** > **Duplicatas** para ver clientes em conflito.
2. Revise e mescle as duplicatas manualmente:
   - Clique em cada par de duplicatas.
   - Escolha qual registro manter como principal.
   - Clique em **Mesclar**.
3. Após resolver as duplicatas, execute a sincronização novamente.
4. **Para prevenir:** Defina um campo-chave para identificar clientes (CPF/CNPJ é o mais confiável).

### Caminho de escalação

- **Tier 1 → Tier 2:** Se o cliente não conseguir resolver com reconexão de credenciais.
- **Tier 2 → Desenvolvimento:** Se houver erro persistente nos logs, timeout recorrente ou corrupção de dados.
- **Informações para escalar:** ID da empresa, data/hora da tentativa de sync, mensagem de erro exata, número aproximado de clientes a sincronizar.

### Prevenção

- Mantenha as credenciais do GL atualizadas — renove a chave de API a cada 6 meses
- Sincronize regularmente (semanalmente) para evitar acúmulo de dados
- Use CPF/CNPJ como campo-chave de identificação para evitar duplicatas
- Monitore os logs de sincronização em **Sistema** > **Auditoria** após cada sincronização$CONTENT$,
  'markdown',
  'troubleshooting',
  (SELECT id FROM knowledge_products WHERE slug = 'crm-clientes'),
  (SELECT id FROM knowledge_groups WHERE name = 'Sincronizacao GL' AND product_id = (SELECT id FROM knowledge_products WHERE slug = 'crm-clientes')),
  'tutorial',
  ARRAY['sincronizacao', 'gl', 'erp', 'falha', 'troubleshooting'],
  'tier1',
  'public',
  true,
  '5 min',
  true,
  true,
  'kb_seed_v1'
) ;

-- ═══════════════════════════════════════════════════════════════════════════
-- TUTORIALS (2)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO ai_knowledge_base (
  title, content, content_type, article_template, product_id, group_id,
  category, tags, audience_tier, visibility, rag_chunks,
  estimated_time, is_active, feeds_ai, source
) VALUES (
  'TUT-001: Seu primeiro atendimento com IA — do zero ao ticket resolvido',
  $CONTENT$## TUT-001: Seu primeiro atendimento com IA — do zero ao ticket resolvido

**Categoria:** Primeiros Passos | **Tier:** 1 — Cliente | **Tempo estimado:** 20 minutos | **Dificuldade:** Iniciante

### O que você vai aprender

- Conectar seu WhatsApp à plataforma
- Criar e configurar um agente de IA básico
- Adicionar conteúdo para a IA responder
- Receber um atendimento real e acompanhar pelo Kanban
- Resolver o ticket e ver a avaliação do cliente

### Pré-requisitos

- Conta ativa na plataforma Mais Simples (já aprovada)
- Um número de WhatsApp disponível
- Celular em mãos
- Um segundo celular ou número para simular o cliente (recomendado)

### Passo 1: Conecte seu WhatsApp

Primeiro, vamos conectar seu WhatsApp para que os clientes possam entrar em contato.

1. Acesse **WhatsApp & Canais** > **Instâncias**.
2. Clique em **+ Nova Instância**.
3. Dê o nome "Meu Primeiro Canal" e clique em **Criar**.
4. Escaneie o QR Code com o WhatsApp do seu celular.
5. Aguarde o status mudar para **Conectada**.

> **Dica:** Se o QR Code expirar, clique em "Gerar novo QR Code". Ele dura 60 segundos.

### Passo 2: Crie conteúdo na base de conhecimento

Antes de criar o agente, vamos dar a ele algo para responder.

1. Acesse **Base de Conhecimento** > **Documentos**.
2. Clique em **+ Novo Documento**.
3. Título: "Informações da empresa".
4. No conteúdo, escreva informações básicas:

```
Horário de funcionamento: segunda a sexta, das 8h às 18h. Sábado das 8h às 12h.
Endereço: [seu endereço aqui].
Telefone de contato: [seu telefone].
Formas de pagamento: dinheiro, PIX, cartão de débito e crédito.

Pergunta: Vocês aceitam PIX?
Resposta: Sim! Aceitamos PIX. É só pedir a chave para o atendente.

Pergunta: Qual o horário de funcionamento?
Resposta: Funcionamos de segunda a sexta das 8h às 18h e sábado das 8h às 12h.
```

5. Clique em **Salvar e Publicar**.

> **Dica:** Incluir perguntas e respostas no texto ajuda muito a IA a entender como responder.

### Passo 3: Crie seu agente de IA

Agora vamos criar o agente que usará esse conteúdo para responder.

1. Acesse **Agentes IA** > **Agentes**.
2. Clique em **+ Novo Agente**.
3. Tipo: **Suporte**.
4. Nome: "Assistente da Loja".
5. Nas instruções, escreva:

```
Você é o assistente virtual da [nome da sua empresa].
Seja educado, objetivo e sempre cumprimente o cliente.
Responda com base nas informações da base de conhecimento.
Se não souber a resposta, diga que vai transferir para um atendente humano.
```

6. Na aba **Conhecimento**, vincule o documento "Informações da empresa" que você acabou de criar.
7. Em **Configurações**, defina temperatura como **0.3** e ative o agente.
8. Clique em **Salvar**.

### Passo 4: Teste no Playground

Antes de colocar o agente para atender de verdade, vamos testar.

1. Na lista de agentes, clique no seu agente e depois em **Testar no Playground**.
2. Envie: "Oi, vocês aceitam PIX?"
3. Verifique se a resposta está coerente com o que você escreveu na base.
4. Envie mais algumas perguntas de teste.

> **Dica:** Se a resposta não estiver boa, volte e ajuste as instruções ou o conteúdo da base.

### Passo 5: Receba seu primeiro atendimento

Agora vamos simular um atendimento real.

1. Com um segundo celular (ou peça para um colega), envie uma mensagem para o número conectado: "Olá, qual o horário de vocês?"
2. Volte à plataforma e acesse **Atendimento** > **Inbox**.
3. Você verá a conversa aparecendo em tempo real.
4. O agente de IA responderá automaticamente.

> **Dica:** Na Inbox, você pode ver tanto as mensagens do cliente quanto as respostas da IA, além de intervir a qualquer momento.

### Passo 6: Acompanhe pelo Kanban

1. Acesse **Atendimento** > **Kanban**.
2. Veja o ticket criado na coluna **Novo** ou **Em andamento**.
3. Clique no card para ver os detalhes completos.
4. Se quiser, arraste para **Aguardando cliente** ou outra etapa.

### Passo 7: Resolva o ticket

1. Abra o ticket pelo Kanban ou pela Inbox.
2. Se o cliente ficou satisfeito, clique em **Resolver**.
3. Adicione uma nota de resolução: "Primeiro atendimento — informações de horário fornecidas pela IA."
4. Clique em **Confirmar resolução**.
5. O cliente receberá uma pesquisa de satisfação automática (se ativada).

### Verifique sua configuração

Confirme que tudo está funcionando:

- [ ] Instância WhatsApp com status **Conectada** (bolinha verde)
- [ ] Pelo menos 1 documento publicado na base de conhecimento
- [ ] Agente de IA **ativo** e vinculado ao documento
- [ ] Teste no Playground com resposta satisfatória
- [ ] Primeiro atendimento real recebido e visualizado na Inbox
- [ ] Ticket resolvido no Kanban

### Próximos passos

- Adicione mais conteúdo à base de conhecimento sobre seus produtos e serviços
- Crie agentes especializados (vendas, financeiro) para diferentes setores
- Explore o **Flow Builder** para criar automações
- Configure sua equipe em **Configurações** > **Equipe**
- Acompanhe as métricas no **Dashboard** e em **Relatórios**$CONTENT$,
  'markdown',
  'tutorial',
  (SELECT id FROM knowledge_products WHERE slug = 'atendimento'),
  (SELECT id FROM knowledge_groups WHERE name = 'Inbox & Fila' AND product_id = (SELECT id FROM knowledge_products WHERE slug = 'atendimento')),
  'tutorial',
  ARRAY['tutorial', 'primeiro-atendimento', 'ia', 'passo-a-passo', 'onboarding'],
  'tier1',
  'public',
  true,
  '20 min',
  true,
  true,
  'kb_seed_v1'
) ;

INSERT INTO ai_knowledge_base (
  title, content, content_type, article_template, product_id, group_id,
  category, tags, audience_tier, visibility, rag_chunks,
  estimated_time, is_active, feeds_ai, source
) VALUES (
  'TUT-002: Criando seu primeiro fluxo de automação',
  $CONTENT$## TUT-002: Criando seu primeiro fluxo de automação

**Categoria:** Automações | **Tier:** 1 — Cliente | **Tempo estimado:** 15 minutos | **Dificuldade:** Intermediário

### O que você vai aprender

- Entender o que é o Flow Builder e para que serve
- Criar um fluxo simples de boas-vindas para novos contatos
- Configurar condições e ações no fluxo
- Testar e ativar o fluxo

### Pré-requisitos

- Conta ativa na plataforma com acesso de administrador
- Pelo menos uma instância WhatsApp conectada
- Ter completado o tutorial Seu primeiro atendimento com IA (recomendado)

### O que é o Flow Builder?

O Flow Builder é uma ferramenta visual que permite criar automações sem precisar programar. Você monta o fluxo arrastando blocos e conectando-os, como um fluxograma. Exemplos do que é possível:

- Enviar mensagem de boas-vindas para novos contatos
- Perguntar o motivo do contato e direcionar para o setor correto
- Enviar lembretes automáticos para clientes inativos
- Coletar dados do cliente antes de transferir para um atendente

### Passo 1: Acesse o Flow Builder

1. No menu lateral, clique em **Automações** > **Flow Builder**.
2. Clique em **+ Novo Fluxo**.
3. Dê o nome "Boas-Vindas" e clique em **Criar**.

### Passo 2: Configure o gatilho (trigger)

O gatilho define **quando** o fluxo será executado.

1. O bloco **Início** já está na tela. Clique nele.
2. Em **Tipo de gatilho**, selecione **Novo contato** — o fluxo será executado quando alguém enviar mensagem pela primeira vez.
3. Clique em **Salvar bloco**.

> **Dica:** Outros gatilhos disponíveis incluem "Palavra-chave recebida", "Horário agendado" e "Ticket criado".

### Passo 3: Adicione uma mensagem de boas-vindas

1. Clique no botão **+** que aparece abaixo do bloco Início.
2. Selecione o bloco **Enviar mensagem**.
3. No campo de texto, escreva:

```
Olá! Bem-vindo(a) ao [nome da sua empresa]!
Sou o assistente virtual e posso te ajudar com:

1 Informações sobre produtos
2 Horário de funcionamento
3 Falar com um atendente

Digite o número da opção desejada.
```

4. Clique em **Salvar bloco**.

### Passo 4: Adicione uma condição

Agora vamos direcionar o cliente conforme a resposta.

1. Clique no **+** abaixo do bloco de mensagem.
2. Selecione o bloco **Condição**.
3. Configure as condições:
   - **Se a resposta contém "1"** → caminho esquerdo
   - **Se a resposta contém "2"** → caminho central
   - **Se a resposta contém "3"** → caminho direito
   - **Senão** → repetir a pergunta

### Passo 5: Adicione ações para cada caminho

**Caminho 1 — Produtos:**
1. Clique no **+** do caminho "1".
2. Adicione um bloco **Enviar mensagem**: "Ótimo! Vou te passar para nosso assistente de produtos. Um momento!"
3. Adicione um bloco **Transferir para agente IA** e selecione o agente de suporte.

**Caminho 2 — Horário:**
1. Adicione um bloco **Enviar mensagem**: "Nosso horário de funcionamento é de segunda a sexta, das 8h às 18h, e sábado das 8h às 12h. Posso ajudar com mais alguma coisa?"

**Caminho 3 — Atendente:**
1. Adicione um bloco **Enviar mensagem**: "Vou transferir você para um de nossos atendentes. Aguarde um momento!"
2. Adicione um bloco **Transferir para humano**.

### Passo 6: Teste o fluxo

1. Clique no botão **Testar** no canto superior direito do Flow Builder.
2. Selecione um **número de teste** (pode ser o seu próprio celular).
3. Simule uma conversa como se fosse um novo contato.
4. Verifique se cada caminho funciona corretamente.

> **Dica:** Se algo não funcionar, clique nos blocos para revisar as configurações. Erros comuns: condição com texto diferente do esperado, bloco sem conexão.

### Passo 7: Ative o fluxo

1. Após testar com sucesso, clique em **Ativar fluxo** no canto superior direito.
2. O status mudará para **Ativo** (badge verde).
3. A partir de agora, todo novo contato que enviar mensagem receberá esse fluxo automaticamente.

### Verifique sua configuração

Confirme que tudo está funcionando:

- [ ] Fluxo "Boas-Vindas" criado com gatilho **Novo contato**
- [ ] Mensagem de boas-vindas configurada com opções
- [ ] Condição com 3 caminhos (produtos, horário, atendente)
- [ ] Cada caminho tem a ação correta (IA, mensagem, humano)
- [ ] Teste realizado com sucesso
- [ ] Fluxo com status **Ativo**

### Próximos passos

- Crie fluxos para outros cenários: pós-venda, pesquisa de satisfação, lembrete de pagamento
- Explore blocos avançados: **Aguardar resposta**, **Atribuir tag**, **Atualizar CRM**
- Combine fluxos com agentes de IA para atendimentos mais inteligentes
- Acompanhe o desempenho dos fluxos em **Relatórios** > **Automações**$CONTENT$,
  'markdown',
  'tutorial',
  (SELECT id FROM knowledge_products WHERE slug = 'agentes-ia'),
  (SELECT id FROM knowledge_groups WHERE name = 'Automacoes & Flows' AND product_id = (SELECT id FROM knowledge_products WHERE slug = 'agentes-ia')),
  'tutorial',
  ARRAY['tutorial', 'flow-builder', 'automacao', 'boas-vindas', 'fluxo'],
  'tier1',
  'public',
  true,
  '15 min',
  true,
  true,
  'kb_seed_v1'
) ;

-- ═══════════════════════════════════════════════════════════════════════════
-- INTERNAL PROCEDURES (2)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO ai_knowledge_base (
  title, content, content_type, article_template, product_id, group_id,
  category, tags, audience_tier, visibility, rag_chunks,
  estimated_time, is_active, feeds_ai, source
) VALUES (
  'PROC-001: Procedimento — Escalar atendimento de IA para humano',
  $CONTENT$## PROC-001: Procedimento — Escalar atendimento de IA para humano

**Categoria:** Suporte Interno | **Tier:** 2 — Agente | **Última atualização:** 2026-03-30

### Quando usar este procedimento

- O agente de IA não conseguiu resolver a solicitação do cliente após 3 tentativas
- O cliente pediu explicitamente para falar com um humano
- O assunto envolve reclamação, cancelamento ou situação emocional
- O tema não está coberto pela base de conhecimento
- A IA deu uma resposta incorreta que precisa ser corrigida imediatamente

### Informações necessárias antes de escalar

- **ID do ticket** (visível no topo do atendimento)
- **Resumo do que a IA tentou responder** (histórico da conversa)
- **Motivo da escalação** (IA não soube, cliente pediu, erro da IA, tema sensível)
- **Sentimento do cliente** (neutro, frustrado, urgente)
- **Dados do cliente** (nome, empresa, plano — visíveis no painel lateral)

### Passos

1. **Identifique a necessidade de escalação.** Na **Inbox** ou no painel de **Supervisão**, monitore os atendimentos com IA. Fique atento a:
   - Mensagens do tipo "quero falar com alguém"
   - Respostas da IA marcadas como "baixa confiança"
   - Conversas com mais de 5 interações sem resolução

2. **Assuma o atendimento.** Clique no ticket e depois em **Assumir atendimento**. Isso desativa a IA para esse ticket e transfere para você.

3. **Envie mensagem de transição ao cliente** usando o template abaixo.

4. **Leia o histórico completo** da conversa (incluindo o que a IA respondeu) para não pedir ao cliente que repita informações.

5. **Registre uma nota interna** no ticket com:
   - Motivo da escalação
   - O que a IA respondeu (certo ou errado)
   - Ação tomada por você

6. **Resolva o atendimento** normalmente, como qualquer ticket humano.

7. **Se a IA deu informação errada:** Após resolver, abra uma tarefa para atualizar a base de conhecimento. Veja PROC-002: Atualizar base de conhecimento após resolver ticket.

### Templates de comunicação com o cliente

**Mensagem de transição (IA → Humano):**

> Olá, [nome do cliente]! Meu nome é [seu nome], sou do time de atendimento. Vou continuar te ajudando a partir de agora. Vi que você estava conversando com nosso assistente virtual — já li toda a conversa e estou por dentro do seu caso. Como posso te ajudar?

**Mensagem quando a IA errou:**

> Olá, [nome do cliente]! Peço desculpas pela informação incorreta que você recebeu. Meu nome é [seu nome] e vou corrigir isso agora. [informação correta]. Qualquer outra dúvida, estou aqui!

**Mensagem para temas sensíveis (cancelamento, reclamação):**

> Olá, [nome do cliente]! Meu nome é [seu nome] e vou te atender pessoalmente. Entendo sua situação e quero encontrar a melhor solução para você. Pode me contar mais detalhes sobre o que aconteceu?

### Notas internas

- **Tempo máximo para assumir:** Escale o atendimento em até **5 minutos** após identificar a necessidade. Clientes frustrados não devem esperar.
- **Quando a IA tem baixa confiança:** O sistema marca com ícone amarelo. Priorize esses atendimentos.
- **Registro obrigatório:** Toda escalação deve ter nota interna. Isso alimenta relatórios de melhoria da IA.
- **Feedback para IA:** Se a IA errou por falta de conteúdo, registre qual informação faltou — isso prioriza a criação de novos artigos.$CONTENT$,
  'markdown',
  'internal-procedure',
  (SELECT id FROM knowledge_products WHERE slug = 'atendimento'),
  (SELECT id FROM knowledge_groups WHERE name = 'Inbox & Fila' AND product_id = (SELECT id FROM knowledge_products WHERE slug = 'atendimento')),
  'tutorial',
  ARRAY['procedimento', 'escalacao', 'ia-para-humano', 'interno'],
  'tier2',
  'internal',
  false,
  '5 min',
  true,
  true,
  'kb_seed_v1'
) ;

INSERT INTO ai_knowledge_base (
  title, content, content_type, article_template, product_id, group_id,
  category, tags, audience_tier, visibility, rag_chunks,
  estimated_time, is_active, feeds_ai, source
) VALUES (
  'PROC-002: Procedimento — Atualizar base de conhecimento após resolver ticket',
  $CONTENT$## PROC-002: Procedimento — Atualizar base de conhecimento após resolver ticket

**Categoria:** Suporte Interno (KCS Solve Loop) | **Tier:** 2 — Agente | **Última atualização:** 2026-03-30

### Quando usar este procedimento

- Você resolveu um ticket onde a IA não tinha a resposta
- Você resolveu um ticket onde a IA deu informação errada ou desatualizada
- Um cliente trouxe uma pergunta nova que não estava na base
- Você descobriu que um artigo existente precisa de atualização
- Mudança de política, preço, horário ou procedimento da empresa

### Informações necessárias

- **ID do ticket** resolvido
- **Pergunta exata do cliente** (copie da conversa)
- **Resposta correta** que você deu ao cliente
- **Categoria do conteúdo** (produto, política, procedimento, etc.)
- **Artigo existente** que precisa de atualização (se houver)

### Passos

1. **Identifique a lacuna de conhecimento.** Após resolver o ticket, pergunte-se:
   - A IA teria conseguido responder com a informação certa? Se não, há uma lacuna.
   - A informação existe na base mas está errada/desatualizada? Precisa de atualização.
   - É uma pergunta completamente nova? Precisa de artigo novo.

2. **Busque na base de conhecimento.** Acesse **Base de Conhecimento** > **Documentos** e use a busca para verificar se já existe conteúdo sobre o tema.

3. **Se o artigo existe mas precisa de atualização:**
   - Clique no artigo para editar.
   - Atualize a informação incorreta ou adicione a informação que faltava.
   - No final do artigo, adicione: `Atualizado em [data] — Ticket #[ID]`.
   - Clique em **Salvar e Publicar**.

4. **Se o artigo não existe (conteúdo novo):**
   - Clique em **+ Novo Documento**.
   - Selecione a categoria mais adequada.
   - Título: Use a **pergunta do cliente** como referência (ex.: "Política de troca de produtos").
   - Conteúdo: Escreva usando o formato pergunta-e-resposta:
     ```
     Pergunta: [pergunta exata do cliente]
     Resposta: [sua resposta correta]

     Detalhes adicionais: [informações complementares]
     ```
   - Clique em **Salvar e Publicar**.

5. **Vincule o novo conteúdo ao agente de IA.**
   - Acesse **Agentes IA** > **Agentes** > selecione o agente relevante.
   - Na aba **Conhecimento**, verifique se o novo documento aparece.
   - Se não aparecer automaticamente, vincule manualmente.

6. **Teste a resposta no Playground.**
   - Abra o **Playground** do agente.
   - Faça a mesma pergunta que o cliente fez.
   - Confirme que a IA agora responde corretamente.

7. **Registre a atualização no ticket.**
   - Volte ao ticket resolvido.
   - Adicione uma nota interna: "Base de conhecimento atualizada — [artigo criado/editado]: [título do artigo]."

### Templates de comunicação com o cliente

**Não é necessário comunicar o cliente** sobre atualizações na base de conhecimento. A melhoria é transparente — na próxima vez que alguém perguntar, a IA responderá corretamente.

**Opcional — Se o cliente relatou o erro da IA explicitamente:**

> Obrigado por nos avisar sobre a informação incorreta, [nome do cliente]! Já corrigimos no nosso sistema e isso não vai acontecer novamente. Agradecemos muito o seu feedback!

### Notas internas

- **Frequência:** Este procedimento deve ser executado **imediatamente** após resolver qualquer ticket onde a IA falhou. Não acumule para fazer depois.
- **Regra de ouro do KCS:** Se você respondeu ao cliente, a informação deve estar na base. Sem exceções.
- **Qualidade do conteúdo:**
  - Use linguagem simples (o cliente é MEI/PME).
  - Inclua perguntas no formato natural ("Vocês fazem entrega?" em vez de "Política de entregas").
  - Seja específico — inclua valores, prazos, horários concretos.
- **Tempo de processamento:** Após salvar, aguarde até 5 minutos para a IA usar o novo conteúdo.
- **Métricas:** O número de atualizações por agente é acompanhado nos relatórios. Manter a base atualizada é parte da avaliação de desempenho.
- **Prioridade de criação:**
  1. Perguntas frequentes (aparecem em múltiplos tickets)
  2. Informações que geraram erro da IA
  3. Informações complementares que enriquecem respostas existentes$CONTENT$,
  'markdown',
  'internal-procedure',
  (SELECT id FROM knowledge_products WHERE slug = 'base-conhecimento'),
  (SELECT id FROM knowledge_groups WHERE name = 'Documentos & Artigos' AND product_id = (SELECT id FROM knowledge_products WHERE slug = 'base-conhecimento')),
  'tutorial',
  ARRAY['procedimento', 'kcs', 'base-conhecimento', 'atualizar', 'interno'],
  'tier2',
  'internal',
  false,
  '5 min',
  true,
  true,
  'kb_seed_v1'
) ;

-- ═══════════════════════════════════════════════════════════════════════════
-- Verification query
-- ═══════════════════════════════════════════════════════════════════════════

SELECT
  count(*) AS total_seeded,
  count(*) FILTER (WHERE source = 'kb_seed_v1') AS from_seed_v1,
  count(*) FILTER (WHERE article_template = 'how-to') AS how_to,
  count(*) FILTER (WHERE article_template = 'faq') AS faq,
  count(*) FILTER (WHERE article_template = 'troubleshooting') AS troubleshooting,
  count(*) FILTER (WHERE article_template = 'tutorial') AS tutorial,
  count(*) FILTER (WHERE article_template = 'internal-procedure') AS internal_procedure
FROM ai_knowledge_base
WHERE source = 'kb_seed_v1';
