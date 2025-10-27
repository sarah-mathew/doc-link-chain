-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table for doctor information
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  specialization TEXT,
  public_key_pem TEXT, -- RSA public key for encryption
  face_encoding_data TEXT, -- Store face recognition data
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create medical_records table
CREATE TABLE public.medical_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_name TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  encrypted_file_path TEXT NOT NULL, -- Storage path to encrypted file
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  shared_with_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  encrypted_aes_key TEXT NOT NULL, -- AES key encrypted with recipient's RSA public key
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create blockchain table
CREATE TABLE public.blockchain (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  block_index INTEGER NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  previous_hash TEXT NOT NULL,
  current_hash TEXT NOT NULL,
  data_json JSONB NOT NULL, -- Store block data as JSON
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(block_index)
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blockchain ENABLE ROW LEVEL SECURITY;

-- Profiles policies - doctors can view all profiles but only update their own
CREATE POLICY "Doctors can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Doctors can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Doctors can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Medical records policies - doctors can see their own records and records shared with them
CREATE POLICY "Doctors can view their own records"
  ON public.medical_records FOR SELECT
  TO authenticated
  USING (
    owner_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR shared_with_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Doctors can insert their own records"
  ON public.medical_records FOR INSERT
  TO authenticated
  WITH CHECK (owner_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Doctors can update their own records"
  ON public.medical_records FOR UPDATE
  TO authenticated
  USING (owner_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- Blockchain policies - doctors can view blocks they're involved in
CREATE POLICY "Doctors can view blockchain blocks they're involved in"
  ON public.blockchain FOR SELECT
  TO authenticated
  USING (
    sender_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR receiver_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Doctors can insert blockchain blocks"
  ON public.blockchain FOR INSERT
  TO authenticated
  WITH CHECK (sender_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_medical_records_updated_at
  BEFORE UPDATE ON public.medical_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Doctor')
  );
  RETURN NEW;
END;
$$;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create indexes for better performance
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_medical_records_owner_id ON public.medical_records(owner_id);
CREATE INDEX idx_medical_records_shared_with_id ON public.medical_records(shared_with_id);
CREATE INDEX idx_blockchain_sender_id ON public.blockchain(sender_id);
CREATE INDEX idx_blockchain_receiver_id ON public.blockchain(receiver_id);
CREATE INDEX idx_blockchain_block_index ON public.blockchain(block_index);