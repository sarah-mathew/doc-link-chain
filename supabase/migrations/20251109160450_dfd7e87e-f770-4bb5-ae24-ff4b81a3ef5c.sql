-- Add receiver_id to encrypted_folders for tracking shared folders
ALTER TABLE public.encrypted_folders
ADD COLUMN receiver_id uuid REFERENCES public.profiles(id);

-- Update RLS policies to allow viewing shared folders
CREATE POLICY "Users can view folders shared with them"
ON public.encrypted_folders
FOR SELECT
USING (
  receiver_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
);