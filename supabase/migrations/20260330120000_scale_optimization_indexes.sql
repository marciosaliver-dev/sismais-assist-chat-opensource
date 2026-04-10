-- Scale optimization: 10 compound indexes for high-volume tables
-- Safe to run in production: all indexes created CONCURRENTLY

-- 1. ai_conversations: client lookup filtered by status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_conv_client_status_date
  ON ai_conversations(helpdesk_client_id, status, started_at DESC);

-- 2. ai_conversations: human agent queue (partial)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_conv_handler_active
  ON ai_conversations(handler_type, status)
  WHERE status IN ('active', 'waiting', 'aguardando');

-- 3. ai_messages: agent performance dashboard
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_msg_agent_created
  ON ai_messages(agent_id, created_at DESC);

-- 4. ai_messages: general feed
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_msg_created
  ON ai_messages(created_at DESC);

-- 5. helpdesk_clients: CRM segmentation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_hc_lifecycle_health
  ON helpdesk_clients(lifecycle_stage, health_score DESC);

-- 6. helpdesk_clients: recent clients list
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_hc_created
  ON helpdesk_clients(created_at DESC);

-- 7. campaign_contacts: campaign progress
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cc_campaign_status_date
  ON campaign_contacts(campaign_id, status, created_at DESC);

-- 8. crm_duplicate_candidates: review queue
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_crm_dup_status_score
  ON crm_duplicate_candidates(status, match_score DESC);

-- 9. crm_score_history: score trending
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_crm_score_client_type_date
  ON crm_score_history(client_id, score_type, calculated_at DESC);

-- 10. whatsapp_messages: thread history
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wa_msg_conv_created
  ON whatsapp_messages(conversation_id, created_at DESC);
