-- Add private_key_pem column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS private_key_pem text;

COMMENT ON COLUMN public.profiles.private_key_pem IS 'User private RSA key for decrypting medical records';
