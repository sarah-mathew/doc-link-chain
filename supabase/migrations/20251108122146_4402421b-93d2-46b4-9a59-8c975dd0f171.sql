-- Create storage bucket for encrypted images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('encrypted-images', 'encrypted-images', false);

-- Create encrypted_images table
CREATE TABLE public.encrypted_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  encrypted_path TEXT NOT NULL,
  owner_id UUID NOT NULL,
  receiver_id UUID,
  encrypted_aes_key TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.encrypted_images ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can insert their own images"
ON public.encrypted_images
FOR INSERT
WITH CHECK (owner_id IN (
  SELECT id FROM profiles WHERE user_id = auth.uid()
));

CREATE POLICY "Users can view their own images or images shared with them"
ON public.encrypted_images
FOR SELECT
USING (
  owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR receiver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Users can update their own images"
ON public.encrypted_images
FOR UPDATE
USING (owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Storage policies for encrypted-images bucket
CREATE POLICY "Users can upload their own encrypted images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'encrypted-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own encrypted images"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'encrypted-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own encrypted images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'encrypted-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Trigger for updated_at
CREATE TRIGGER update_encrypted_images_updated_at
BEFORE UPDATE ON public.encrypted_images
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();