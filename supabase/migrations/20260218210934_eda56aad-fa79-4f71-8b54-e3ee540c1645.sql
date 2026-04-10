
-- Add support_config JSONB column to ai_agents
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS support_config jsonb DEFAULT '{}'::jsonb;

-- Add sdr_config JSONB column to ai_agents (also referenced in code)
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS sdr_config jsonb DEFAULT '{}'::jsonb;

-- Add delivery_status column to ai_messages (from the approved plan)
ALTER TABLE public.ai_messages ADD COLUMN IF NOT EXISTS delivery_status text DEFAULT NULL;
