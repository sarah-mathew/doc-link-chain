-- Create blockchain_renewed table
CREATE TABLE public.blockchain_renewed (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  block_index integer NOT NULL,
  timestamp timestamp with time zone NOT NULL DEFAULT now(),
  previous_hash text NOT NULL,
  current_hash text NOT NULL,
  data_json jsonb NOT NULL,
  sender_id uuid NOT NULL,
  receiver_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.blockchain_renewed ENABLE ROW LEVEL SECURITY;

-- Create policy for doctors to view blocks they're involved in
CREATE POLICY "Doctors can view blockchain blocks they're involved in" 
ON public.blockchain_renewed 
FOR SELECT 
USING (
  sender_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR receiver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- Create policy for doctors to insert blockchain blocks
CREATE POLICY "Doctors can insert blockchain blocks" 
ON public.blockchain_renewed 
FOR INSERT 
WITH CHECK (
  sender_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- Create index for better query performance
CREATE INDEX idx_blockchain_renewed_block_index ON public.blockchain_renewed(block_index);
CREATE INDEX idx_blockchain_renewed_sender_id ON public.blockchain_renewed(sender_id);
CREATE INDEX idx_blockchain_renewed_receiver_id ON public.blockchain_renewed(receiver_id);