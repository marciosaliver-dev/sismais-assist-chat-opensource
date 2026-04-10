ALTER TABLE uazapi_instances ADD COLUMN IF NOT EXISTS test_mode boolean DEFAULT false;
ALTER TABLE uazapi_instances ADD COLUMN IF NOT EXISTS test_phone_number text;