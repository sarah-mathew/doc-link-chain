import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const BlockchainValidation = () => {
  const [blocks, setBlocks] = useState<any[]>([]);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBlockchain();
    
    // Set up realtime subscription
    const channel = supabase
      .channel('blockchain-validation')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'blockchain_renewed' },
        () => {
          loadBlockchain();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadBlockchain = async () => {
    try {
      const { data, error } = await supabase
        .from("blockchain_renewed")
        .select("*")
        .order("block_index", { ascending: true });

      if (error) throw error;

      setBlocks(data || []);
      setIsValid(validateChain(data || []));
    } catch (error: any) {
      console.error("Error loading blockchain:", error);
    } finally {
      setLoading(false);
    }
  };

  const validateChain = (chainData: any[]): boolean => {
    if (chainData.length === 0) return true;
    
    for (let i = 1; i < chainData.length; i++) {
      const currentBlock = chainData[i];
      const previousBlock = chainData[i - 1];

      if (currentBlock.previous_hash !== previousBlock.current_hash) {
        return false;
      }
    }
    
    return true;
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-sm text-muted-foreground mt-2">Validating blockchain...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Blockchain Validation
        </CardTitle>
        <CardDescription>
          Real-time integrity verification of the blockchain
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col items-center justify-center py-8 space-y-4">
          {isValid !== null && (
            <>
              {isValid ? (
                <>
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                    <CheckCircle className="w-12 h-12 text-primary" />
                  </div>
                  <Badge variant="default" className="text-lg px-6 py-2">
                    Valid
                  </Badge>
                  <p className="text-sm text-muted-foreground text-center max-w-md">
                    All blocks are properly linked. The blockchain integrity is intact.
                  </p>
                </>
              ) : (
                <>
                  <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
                    <AlertCircle className="w-12 h-12 text-destructive" />
                  </div>
                  <Badge variant="destructive" className="text-lg px-6 py-2">
                    Invalid
                  </Badge>
                  <p className="text-sm text-muted-foreground text-center max-w-md">
                    Chain integrity compromised. Hash mismatch detected between blocks.
                  </p>
                </>
              )}
            </>
          )}
        </div>

        <div className="border-t pt-4">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-3xl font-bold text-primary">{blocks.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Total Blocks</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-accent">
                {blocks.length > 0 ? "Active" : "Empty"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Chain Status</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default BlockchainValidation;
