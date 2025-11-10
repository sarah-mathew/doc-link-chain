-- Add receiver_encrypted_aes_key column to encrypted_files table
ALTER TABLE public.encrypted_files
ADD COLUMN receiver_encrypted_aes_key TEXT;

-- Add receiver_encrypted_aes_key column to encrypted_images table  
ALTER TABLE public.encrypted_images
ADD COLUMN receiver_encrypted_aes_key TEXT;

-- Update comment for clarity
COMMENT ON COLUMN public.encrypted_files.encrypted_aes_key IS 'AES key encrypted with owner''s RSA public key';
COMMENT ON COLUMN public.encrypted_files.receiver_encrypted_aes_key IS 'AES key encrypted with receiver''s RSA public key (for sharing)';
COMMENT ON COLUMN public.encrypted_images.encrypted_aes_key IS 'AES key encrypted with owner''s RSA public key';
COMMENT ON COLUMN public.encrypted_images.receiver_encrypted_aes_key IS 'AES key encrypted with receiver''s RSA public key (for sharing)';