import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, Lock, Share2, CheckCircle, FileText, Blocks } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-background">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-6 animate-pulse">
            <Shield className="w-10 h-10 text-primary" />
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
            MediChain
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground mb-4">
            Secure Medical Records Blockchain Platform
          </p>
          
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Share medical records securely using blockchain technology, AES-256 encryption, and RSA key exchange. 
            Designed for healthcare professionals who prioritize patient data security.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              onClick={() => navigate("/auth")}
              className="text-lg px-8"
            >
              <Shield className="w-5 h-5 mr-2" />
              Get Started
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              onClick={() => navigate("/auth")}
              className="text-lg px-8"
            >
              <Lock className="w-5 h-5 mr-2" />
              Doctor Sign In
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">
          Enterprise-Grade Security Features
        </h2>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          <FeatureCard
            icon={<Lock className="w-6 h-6" />}
            title="AES-256 Encryption"
            description="Military-grade encryption for all medical files before blockchain storage"
          />
          
          <FeatureCard
            icon={<Shield className="w-6 h-6" />}
            title="RSA Key Exchange"
            description="Secure key exchange protocol ensures only authorized doctors can decrypt records"
          />
          
          <FeatureCard
            icon={<Blocks className="w-6 h-6" />}
            title="Blockchain Verified"
            description="Immutable blockchain ledger with SHA-256 hashing for complete audit trail"
          />
          
          <FeatureCard
            icon={<Share2 className="w-6 h-6" />}
            title="Secure Sharing"
            description="Share records between doctors with end-to-end encryption and access control"
          />
          
          <FeatureCard
            icon={<FileText className="w-6 h-6" />}
            title="Record Management"
            description="Upload, view, and manage medical files with complete encryption transparency"
          />
          
          <FeatureCard
            icon={<CheckCircle className="w-6 h-6" />}
            title="Chain Validation"
            description="Real-time blockchain integrity checks ensure data hasn't been tampered with"
          />
        </div>
      </section>

      {/* How It Works Section */}
      <section className="container mx-auto px-4 py-16 bg-card/30 rounded-3xl my-16">
        <h2 className="text-3xl font-bold text-center mb-12">
          How MediChain Works
        </h2>
        
        <div className="max-w-4xl mx-auto space-y-8">
          <ProcessStep
            number={1}
            title="Upload & Encrypt"
            description="Medical files are encrypted with AES-256 before storage. Each file gets a unique cryptographic hash."
          />
          
          <ProcessStep
            number={2}
            title="Blockchain Recording"
            description="File metadata and hash are recorded on the blockchain, creating an immutable audit trail with timestamp and doctor information."
          />
          
          <ProcessStep
            number={3}
            title="Secure Sharing"
            description="Share records with other doctors. The AES key is encrypted with the recipient's RSA public key, ensuring only they can decrypt."
          />
          
          <ProcessStep
            number={4}
            title="Access & Verify"
            description="Recipients decrypt records using their private key. Blockchain verification ensures data integrity and authenticity."
          />
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Secure Your Medical Records?
          </h2>
          <p className="text-muted-foreground mb-8">
            Join healthcare professionals using blockchain technology for secure medical record management
          </p>
          <Button 
            size="lg"
            onClick={() => navigate("/auth")}
            className="text-lg px-8"
          >
            <Shield className="w-5 h-5 mr-2" />
            Start Using MediChain
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t mt-16">
        <div className="container mx-auto px-4 py-8 text-center text-sm text-muted-foreground">
          <p>MediChain - Secure Medical Records Blockchain Platform</p>
          <p className="mt-2">Protected by AES-256, RSA encryption, and blockchain technology</p>
        </div>
      </footer>
    </div>
  );
};

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) => (
  <div className="bg-card p-6 rounded-xl border hover:shadow-lg transition-shadow">
    <div className="p-3 bg-primary/10 rounded-lg w-fit mb-4">
      {icon}
    </div>
    <h3 className="font-semibold text-lg mb-2">{title}</h3>
    <p className="text-sm text-muted-foreground">{description}</p>
  </div>
);

const ProcessStep = ({ number, title, description }: { number: number; title: string; description: string }) => (
  <div className="flex gap-4">
    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
      {number}
    </div>
    <div>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  </div>
);

export default Index;
