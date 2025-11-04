-- Create verified_doctors table
CREATE TABLE public.verified_doctors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  registration_number TEXT NOT NULL UNIQUE,
  email TEXT,
  specialization TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.verified_doctors ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read verified doctors for verification
CREATE POLICY "Anyone can view verified doctors"
ON public.verified_doctors
FOR SELECT
TO authenticated
USING (true);

-- Only allow service role to insert/update (admin functionality)
CREATE POLICY "Service role can manage verified doctors"
ON public.verified_doctors
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Create message status enum
CREATE TYPE public.message_status AS ENUM ('pending', 'resolved');

-- Create admin_messages table
CREATE TABLE public.admin_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  registration_number TEXT,
  message TEXT NOT NULL,
  status message_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_messages ENABLE ROW LEVEL SECURITY;

-- Users can insert their own messages
CREATE POLICY "Anyone can send messages"
ON public.admin_messages
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Users can view their own messages
CREATE POLICY "Users can view their own messages"
ON public.admin_messages
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR user_id IS NULL);

-- Add trigger for updated_at on verified_doctors
CREATE TRIGGER update_verified_doctors_updated_at
BEFORE UPDATE ON public.verified_doctors
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some sample verified doctors for testing
INSERT INTO public.verified_doctors (full_name, registration_number, email, specialization) VALUES
('Dr. John Smith', 'MED12345', 'john.smith@hospital.com', 'Cardiology'),
('Dr. Sarah Johnson', 'MED67890', 'sarah.johnson@hospital.com', 'Neurology'),
('Dr. Michael Chen', 'MED11223', 'michael.chen@hospital.com', 'Pediatrics');