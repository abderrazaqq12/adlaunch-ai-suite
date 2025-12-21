-- Create storage bucket for assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('assets', 'assets', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Users can upload their own assets
CREATE POLICY "Users can upload assets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'assets' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can view their own assets
CREATE POLICY "Users can view their own assets"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'assets' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Anyone can view public assets (for sharing)
CREATE POLICY "Public can view assets"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'assets');

-- Policy: Users can delete their own assets
CREATE POLICY "Users can delete their own assets"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'assets' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can update their own assets
CREATE POLICY "Users can update their own assets"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'assets' AND
  auth.uid()::text = (storage.foldername(name))[1]
);