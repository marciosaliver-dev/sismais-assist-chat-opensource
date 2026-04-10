-- Artigo KB: Contatos comerciais oficiais da Sismais
-- Motivo: O agente Lino estava inventando números de telefone e emails quando
-- o cliente pedia contatos comerciais (KB sem match). Este artigo garante que
-- a informação correta seja retornada via RAG.

INSERT INTO public.ai_knowledge_base (
  title,
  description,
  content_type,
  content,
  category,
  source,
  is_public,
  feeds_ai,
  is_active,
  sort_order
) VALUES (
  'Contatos Comerciais Oficiais da Sismais',
  'Números de telefone, WhatsApp e canais oficiais para contato comercial, vendas e parcerias da Sismais Tecnologia.',
  'article',
  E'## Contatos Comerciais da Sismais Tecnologia\n\n'
  '### Comercial / Vendas\n'
  '- **WhatsApp Comercial:** (77) 8107-9247\n'
  '- **Número Comercial:** (77) 8107-9247\n\n'
  '### Orientações para o atendente IA\n'
  '- Quando o cliente quiser falar com o comercial, informe o número acima.\n'
  '- Quando o cliente quiser indicar alguém, passe o WhatsApp comercial acima.\n'
  '- NUNCA invente números de telefone ou emails. Use APENAS os contatos listados aqui.\n'
  '- Se o cliente pedir um contato que não está listado aqui, encaminhe para um atendente humano.',
  'contatos',
  'manual',
  false,
  true,
  true,
  0
);
