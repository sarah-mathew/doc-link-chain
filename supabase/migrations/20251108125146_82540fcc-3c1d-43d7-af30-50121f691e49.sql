-- Create encrypted_files table for folder uploads
CREATE TABLE public.encrypted_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  folder_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  encrypted_path TEXT NOT NULL,
  owner_id UUID NOT NULL,
  receiver_id UUID NULL,
  encrypted_aes_key TEXT NOT NULL,
  metadata JSONB NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.encrypted_files ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can insert their own files"
ON public.encrypted_files
FOR INSERT
WITH CHECK (owner_id IN (
  SELECT id FROM profiles WHERE user_id = auth.uid()
));

CREATE POLICY "Users can view their own files or files shared with them"
ON public.encrypted_files
FOR SELECT
USING (
  owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR receiver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Users can update their own files"
ON public.encrypted_files
FOR UPDATE
USING (owner_id IN (
  SELECT id FROM profiles WHERE user_id = auth.uid()
));

-- Create trigger for updated_at
CREATE TRIGGER update_encrypted_files_updated_at
BEFORE UPDATE ON public.encrypted_files
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create folders table to track folder uploads
CREATE TABLE public.encrypted_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  folder_name TEXT NOT NULL,
  folder_hash TEXT NOT NULL,
  owner_id UUID NOT NULL,
  file_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.encrypted_folders ENABLE ROW LEVEL SECURITY;

-- Create policies for folders
CREATE POLICY "Users can insert their own folders"
ON public.encrypted_folders
FOR INSERT
WITH CHECK (owner_id IN (
  SELECT id FROM profiles WHERE user_id = auth.uid()
));

CREATE POLICY "Users can view their own folders"
ON public.encrypted_folders
FOR SELECT
USING (owner_id IN (
  SELECT id FROM profiles WHERE user_id = auth.uid()
));

-- Create trigger for updated_at
CREATE TRIGGER update_encrypted_folders_updated_at
BEFORE UPDATE ON public.encrypted_folders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();