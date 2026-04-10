-- Make whatsapp-media bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'whatsapp-media';

-- Drop existing public read policy if it exists
DROP POLICY IF EXISTS "Public read whatsapp media" ON storage.objects;
DROP POLICY IF EXISTS "Public read whatsapp-media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated read whatsapp media" ON storage.objects;

-- Add authenticated-only read policy
CREATE POLICY "Authenticated read whatsapp media"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'whatsapp-media');

-- Keep existing upload/update policies or create if missing
DROP POLICY IF EXISTS "Authenticated upload whatsapp media" ON storage.objects;
CREATE POLICY "Authenticated upload whatsapp media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'whatsapp-media');

DROP POLICY IF EXISTS "Authenticated update whatsapp media" ON storage.objects;
CREATE POLICY "Authenticated update whatsapp media"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'whatsapp-media');

-- Service role needs full access for edge functions
DROP POLICY IF EXISTS "Service role whatsapp media" ON storage.objects;
CREATE POLICY "Service role whatsapp media"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'whatsapp-media')
WITH CHECK (bucket_id = 'whatsapp-media');