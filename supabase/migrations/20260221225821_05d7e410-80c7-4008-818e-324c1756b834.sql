INSERT INTO platform_ai_config (feature, model, enabled, extra_config)
VALUES
  ('sla_alerts', 'none', true, '{"notify_agent_80_pct": true, "notify_supervisor_exceeded": true, "notify_resolution_80_pct": true, "notify_targets": ["agent"]}'::jsonb),
  ('csat_survey', 'none', true, '{"auto_send_on_close": false, "message_template": "Seu atendimento foi concluído! Como você avalia nosso suporte de 1 a 5?", "accept_within_hours": 24, "delay_hours": 0, "enabled_time_limit": true}'::jsonb)
ON CONFLICT (feature) DO NOTHING;