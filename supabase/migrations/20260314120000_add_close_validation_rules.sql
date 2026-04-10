-- Add new close requirement rows for ticket validation
INSERT INTO ticket_close_requirements (field_name, is_required)
VALUES
  ('ticket_subject', false),
  ('ai_name_validation', false),
  ('ai_close_review', false)
ON CONFLICT (field_name) DO NOTHING;
