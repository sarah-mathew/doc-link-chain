import { Button } from "@/components/ui/button";
import { Shield, LogOut, User } from "lucide-react";

interface DashboardHeaderProps {
  profile: any;
  onSignOut: () => void;
}

const DashboardHeader = ({ profile, onSignOut }: DashboardHeaderProps) => {
  return (
    <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                MediChain
              </h1>
              <p className="text-xs text-muted-foreground">Blockchain Medical Records</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="font-semibold">{profile?.full_name || "Doctor"}</p>
              <p className="text-sm text-muted-foreground">{profile?.specialization || "Medical Professional"}</p>
            </div>
            <Button variant="outline" size="icon" onClick={onSignOut}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;
