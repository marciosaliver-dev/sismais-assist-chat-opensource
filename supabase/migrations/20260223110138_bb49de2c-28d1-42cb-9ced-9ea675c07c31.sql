
-- Add INSERT policy on storage for contact-avatars bucket
CREATE POLICY "Allow insert contact avatars" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'contact-avatars');

-- Add DELETE policy so we can overwrite files
CREATE POLICY "Allow delete contact avatars" ON storage.objects
  FOR DELETE USING (bucket_id = 'contact-avatars');
