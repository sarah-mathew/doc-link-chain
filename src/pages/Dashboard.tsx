import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Shield, LogOut, Upload, Share2, FileText, CheckCircle } from "lucide-react";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import UploadRecordSection from "@/components/dashboard/UploadRecordSection";
import RecordsListSection from "@/components/dashboard/RecordsListSection";
import BlockchainStatusSection from "@/components/dashboard/BlockchainStatusSection";

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user?.id)
        .single();

      if (error) throw error;

      // Generate RSA keys if they don't exist
      if (data && !data.public_key_pem && user) {
        const { generateRSAKeyPair } = await import("@/lib/encryption");
        const { publicKey, privateKey } = await generateRSAKeyPair();
        
        // Store user ID for key retrieval
        localStorage.setItem('userId', user.id);
        
        // Store private key in localStorage (client-side only)
        localStorage.setItem(`rsa_private_key_${user.id}`, privateKey);
        
        // Update profile with public key
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ public_key_pem: publicKey })
          .eq("id", data.id);
        
        if (updateError) throw updateError;
        
        data.public_key_pem = publicKey;
        toast.success("Security keys generated successfully");
      }

      setProfile(data);
    } catch (error: any) {
      console.error("Error loading profile:", error);
      toast.error("Error loading profile");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success("Signed out successfully");
      navigate("/auth");
    } catch (error: any) {
      toast.error(error.message || "Error signing out");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader 
        profile={profile} 
        onSignOut={handleSignOut}
      />

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
          <div className="bg-card p-6 rounded-lg border shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Upload className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold">Upload Records</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Securely upload and encrypt medical files
            </p>
          </div>

          <div className="bg-card p-6 rounded-lg border shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-accent/10 rounded-lg">
                <Share2 className="w-5 h-5 text-accent" />
              </div>
              <h3 className="font-semibold">Share Securely</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Share records with other doctors using encryption
            </p>
          </div>

          <div className="bg-card p-6 rounded-lg border shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <CheckCircle className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold">Blockchain Verified</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              All records verified on the blockchain
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <UploadRecordSection profileId={profile?.id} />
          <BlockchainStatusSection />
        </div>

        <div className="mt-6">
          <RecordsListSection profileId={profile?.id} />
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
