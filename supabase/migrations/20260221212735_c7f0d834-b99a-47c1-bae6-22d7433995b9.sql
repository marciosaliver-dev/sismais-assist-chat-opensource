UPDATE ai_conversations SET status = 'em_andamento' WHERE status = 'active';
UPDATE ai_conversations SET status = 'resolvido' WHERE status = 'resolved';
UPDATE ai_conversations SET status = 'aguardando_cliente' WHERE status = 'awaiting_csat';
UPDATE ai_conversations SET status = 'escalado' WHERE status = 'escalated';