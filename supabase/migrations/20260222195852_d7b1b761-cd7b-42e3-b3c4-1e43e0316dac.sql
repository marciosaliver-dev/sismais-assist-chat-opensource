
INSERT INTO storage.buckets (id, name, public) VALUES ('contact-avatars', 'contact-avatars', true);

CREATE POLICY "Public read contact avatars" ON storage.objects FOR SELECT USING (bucket_id = 'contact-avatars');
CREATE POLICY "Service write contact avatars" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'contact-avatars');
CREATE POLICY "Service update contact avatars" ON storage.objects FOR UPDATE USING (bucket_id = 'contact-avatars');
