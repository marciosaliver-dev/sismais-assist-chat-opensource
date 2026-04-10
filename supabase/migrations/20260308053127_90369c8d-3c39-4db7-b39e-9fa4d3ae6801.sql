INSERT INTO storage.buckets (id, name, public) VALUES ('manual-images', 'manual-images', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can read manual images" ON storage.objects FOR SELECT TO public USING (bucket_id = 'manual-images');
CREATE POLICY "Authenticated users can upload manual images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'manual-images');
CREATE POLICY "Authenticated users can update manual images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'manual-images');
CREATE POLICY "Authenticated users can delete manual images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'manual-images');