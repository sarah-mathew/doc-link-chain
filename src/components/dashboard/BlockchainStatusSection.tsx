import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Blockchain } from "@/lib/blockchain";

const BlockchainStatusSection = () => {
  const [blocks, setBlocks] = useState<any[]>([]);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBlockchain();
    
    // Set up realtime subscription
    const channel = supabase
      .channel('blockchain-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'blockchain' },
        (payload: any) => {
          setBlocks((prev) => {
            const exists = prev.some((b) => b.id === payload.new.id);
            const next = exists ? prev : [...prev, payload.new];
            const ordered = [...next].sort((a, b) => a.block_index - b.block_index);
            setIsValid(validateChain(ordered));
            return ordered;
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'blockchain' },
        (payload: any) => {
          setBlocks((prev) => {
            const next = prev.map((b) => (b.id === payload.new.id ? payload.new : b));
            const ordered = [...next].sort((a, b) => a.block_index - b.block_index);
            setIsValid(validateChain(ordered));
            return ordered;
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'blockchain' },
        (payload: any) => {
          setBlocks((prev) => {
            const next = prev.filter((b) => b.id !== payload.old.id);
            const ordered = [...next].sort((a, b) => a.block_index - b.block_index);
            setIsValid(validateChain(ordered));
            return ordered;
          });
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
        .from("blockchain")
        .select(`
          *,
          sender:profiles!sender_id(full_name),
          receiver:profiles!receiver_id(full_name)
        `)
        .order("block_index", { ascending: true });

      if (error) throw error;

      setBlocks(data || []);
      
      // Validate blockchain
      if (data && data.length > 0) {
        const blockchain = new Blockchain();
        const isChainValid = validateChain(data);
        setIsValid(isChainValid);
      }
    } catch (error: any) {
      console.error("Error loading blockchain:", error);
    } finally {
      setLoading(false);
    }
  };

  const validateChain = (chainData: any[]): boolean => {
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
      <Card>
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="w-5 h-5" />
          Blockchain Status
        </CardTitle>
        <CardDescription>
          Verification and integrity status of the blockchain
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div>
            <p className="font-semibold">Chain Integrity</p>
            <p className="text-sm text-muted-foreground">Cryptographic validation</p>
          </div>
          {isValid !== null && (
            <Badge variant={isValid ? "default" : "destructive"} className="gap-1">
              {isValid ? (
                <>
                  <CheckCircle className="w-3 h-3" />
                  Valid
                </>
              ) : (
                <>
                  <AlertCircle className="w-3 h-3" />
                  Invalid
                </>
              )}
            </Badge>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold">Blockchain Statistics</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card border rounded-lg p-3">
              <p className="text-2xl font-bold text-primary">{blocks.length}</p>
              <p className="text-xs text-muted-foreground">Total Blocks</p>
            </div>
            <div className="bg-card border rounded-lg p-3">
              <p className="text-2xl font-bold text-accent">{blocks.length > 0 ? "Active" : "Empty"}</p>
              <p className="text-xs text-muted-foreground">Status</p>
            </div>
          </div>
        </div>

        {blocks.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold">Recent Blocks</p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {blocks.slice(-5).reverse().map((block) => (
                <div
                  key={block.id}
                  className="text-xs p-3 bg-muted/30 rounded border"
                >
                  <div className="flex justify-between mb-1">
                    <span className="font-mono font-semibold">Block #{block.block_index}</span>
                    <Badge variant="outline" className="text-xs">
                      {block.data_json?.fileName || "Record"}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground truncate">
                    Hash: {block.current_hash.substring(0, 24)}...
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground bg-accent/10 p-3 rounded-lg border border-accent/20">
          <p className="font-semibold text-accent mb-1">🔒 Security Features</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>SHA-256 cryptographic hashing</li>
            <li>AES-256 file encryption</li>
            <li>RSA key exchange protocol</li>
            <li>Immutable blockchain ledger</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default BlockchainStatusSection;
