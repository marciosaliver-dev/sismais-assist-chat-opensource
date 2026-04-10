-- Migration: Permite leitura anônima de manuais publicados na Central do Cliente
-- As páginas públicas /help/manuals e /help/manuals/:id não requerem login.
-- Esta policy libera SELECT para usuários anônimos apenas em registros
-- com source_type='manual', is_active=true e metadata.status='published'.

CREATE POLICY "kb_anon_manual_published_read"
  ON public.ai_knowledge_base
  FOR SELECT
  TO anon
  USING (
    is_active = true
    AND source_type = 'manual'
    AND (metadata->>'status') = 'published'
  );
