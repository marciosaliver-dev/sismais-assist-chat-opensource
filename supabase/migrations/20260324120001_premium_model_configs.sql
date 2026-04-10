-- Configurações de modelo premium para funcionalidades AI-First
-- Usa Claude Sonnet 4 (Anthropic) via OpenRouter para geração de alta qualidade

-- Verificar se ai_model_catalog tem Claude Sonnet 4
INSERT INTO ai_model_catalog (model_id, display_name, provider, tier, description, input_cost_per_1m, output_cost_per_1m, max_context_window, max_output_tokens, capabilities, recommended_for, is_active)
VALUES (
  'anthropic/claude-sonnet-4',
  'Claude Sonnet 4',
  'anthropic',
  'premium',
  'Modelo premium da Anthropic com raciocínio avançado, segurança e excelente qualidade de geração de texto.',
  3.00,
  15.00,
  200000,
  8192,
  '{text,vision,function_calling}',
  '{support,copilot,sales,financial}',
  true
)
ON CONFLICT (model_id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  tier = 'premium',
  description = EXCLUDED.description,
  input_cost_per_1m = EXCLUDED.input_cost_per_1m,
  output_cost_per_1m = EXCLUDED.output_cost_per_1m,
  max_context_window = EXCLUDED.max_context_window,
  is_active = true;

-- Inserir configs de modelo para features AI-First
INSERT INTO platform_ai_config (feature, model, enabled, extra_config)
VALUES
  ('ai_field_generator', 'anthropic/claude-sonnet-4', true, '{"temperature": 0.4, "max_tokens": 2000}'::jsonb),
  ('ai_agent_audit', 'anthropic/claude-sonnet-4', true, '{"temperature": 0.2, "max_tokens": 4000}'::jsonb),
  ('agent_config_copilot', 'anthropic/claude-sonnet-4', true, '{"temperature": 0.3, "max_tokens": 3000}'::jsonb),
  ('generate_agent_prompt', 'anthropic/claude-sonnet-4', true, '{"temperature": 0.3, "max_tokens": 1200}'::jsonb)
ON CONFLICT (feature) DO UPDATE SET
  model = EXCLUDED.model,
  enabled = true,
  extra_config = EXCLUDED.extra_config;
