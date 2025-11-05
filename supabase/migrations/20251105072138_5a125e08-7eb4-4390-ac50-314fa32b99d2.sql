-- Create registered_doctors table
CREATE TABLE public.registered_doctors (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name text NOT NULL,
  registration_number text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.registered_doctors ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to view registered doctors (needed for signup verification)
CREATE POLICY "Anyone can view registered doctors" 
ON public.registered_doctors 
FOR SELECT 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_registered_doctors_updated_at
BEFORE UPDATE ON public.registered_doctors
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();