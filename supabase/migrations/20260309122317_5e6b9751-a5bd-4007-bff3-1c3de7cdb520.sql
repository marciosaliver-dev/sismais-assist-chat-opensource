
CREATE TABLE public.transfer_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  ticket_number integer,
  customer_name text,
  customer_phone text,
  from_agent_id uuid,
  from_agent_name text,
  to_agent_id uuid NOT NULL,
  to_agent_name text,
  from_board_id uuid,
  from_board_name text,
  to_board_id uuid,
  to_board_name text,
  from_stage_id uuid,
  to_stage_id uuid,
  whatsapp_instance_changed boolean DEFAULT false,
  new_instance_id uuid,
  note text,
  transferred_by uuid,
  transferred_at timestamptz DEFAULT now()
);

ALTER TABLE public.transfer_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read transfer logs"
  ON public.transfer_audit_logs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert transfer logs"
  ON public.transfer_audit_logs FOR INSERT TO authenticated WITH CHECK (true);
