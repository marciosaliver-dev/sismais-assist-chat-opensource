
-- ============================================================
-- UAZAPI Instances
-- ============================================================
CREATE TABLE public.uazapi_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_name TEXT UNIQUE NOT NULL,
  api_url TEXT NOT NULL,
  api_token TEXT NOT NULL,
  qr_code TEXT,
  status TEXT DEFAULT 'disconnected',
  phone_number TEXT,
  profile_name TEXT,
  profile_picture_url TEXT,
  webhook_url TEXT,
  webhook_events TEXT[] DEFAULT ARRAY['message', 'message_status'],
  is_active BOOLEAN DEFAULT true,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.uazapi_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated access uazapi_instances"
  ON public.uazapi_instances FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access uazapi_instances"
  ON public.uazapi_instances FOR ALL
  USING (true) WITH CHECK (true);

-- ============================================================
-- UAZAPI Chats
-- ============================================================
CREATE TABLE public.uazapi_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID REFERENCES public.uazapi_instances(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL,
  contact_name TEXT,
  contact_phone TEXT,
  contact_picture_url TEXT,
  is_group BOOLEAN DEFAULT false,
  is_pinned BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  is_muted BOOLEAN DEFAULT false,
  unread_count INTEGER DEFAULT 0,
  last_message_preview TEXT,
  last_message_time TIMESTAMPTZ,
  last_message_from_me BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(instance_id, chat_id)
);

ALTER TABLE public.uazapi_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated access uazapi_chats"
  ON public.uazapi_chats FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access uazapi_chats"
  ON public.uazapi_chats FOR ALL
  USING (true) WITH CHECK (true);

CREATE INDEX idx_uazapi_chats_instance ON public.uazapi_chats(instance_id);
CREATE INDEX idx_uazapi_chats_last_message ON public.uazapi_chats(last_message_time DESC);

-- ============================================================
-- UAZAPI Messages
-- ============================================================
CREATE TABLE public.uazapi_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID REFERENCES public.uazapi_instances(id) ON DELETE CASCADE,
  chat_id UUID REFERENCES public.uazapi_chats(id) ON DELETE CASCADE,
  message_id TEXT UNIQUE NOT NULL,
  from_me BOOLEAN DEFAULT false,
  sender_phone TEXT,
  sender_name TEXT,
  type TEXT NOT NULL,
  text_body TEXT,
  caption TEXT,
  media_url TEXT,
  media_mimetype TEXT,
  media_size BIGINT,
  media_filename TEXT,
  thumbnail_url TEXT,
  quoted_message_id TEXT,
  buttons JSONB,
  list_data JSONB,
  location JSONB,
  contacts JSONB,
  status TEXT DEFAULT 'pending',
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.uazapi_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated access uazapi_messages"
  ON public.uazapi_messages FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access uazapi_messages"
  ON public.uazapi_messages FOR ALL
  USING (true) WITH CHECK (true);

CREATE INDEX idx_uazapi_messages_chat ON public.uazapi_messages(chat_id, timestamp DESC);
CREATE INDEX idx_uazapi_messages_instance ON public.uazapi_messages(instance_id);

-- ============================================================
-- Realtime for chats and messages
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.uazapi_chats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.uazapi_messages;
