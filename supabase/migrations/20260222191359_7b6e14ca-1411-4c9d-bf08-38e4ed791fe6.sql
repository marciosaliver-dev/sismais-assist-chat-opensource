
-- Add avatar cache fields to uazapi_chats
ALTER TABLE uazapi_chats ADD COLUMN IF NOT EXISTS avatar_fetched_at TIMESTAMPTZ;

-- Add avatar fields to customer_profiles
ALTER TABLE customer_profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE customer_profiles ADD COLUMN IF NOT EXISTS avatar_fetched_at TIMESTAMPTZ;
