import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { encryptKeyWithRSA } from "@/lib/encryption";
import { Blockchain, BlockData } from "@/lib/blockchain";

interface ShareRecordDialogProps {
  record: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const ShareRecordDialog = ({ record, open, onOpenChange, onSuccess }: ShareRecordDialogProps) => {
  const [doctors, setDoctors] = useState<any[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (open) {
      loadDoctors();
    }
  }, [open]);

  const loadDoctors = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, specialization")
        .neq("id", record?.owner_id);

      if (error) throw error;
      setDoctors(data || []);
    } catch (error: any) {
      console.error("Error loading doctors:", error);
      toast.error("Error loading doctors list");
    }
  };

  const handleShare = async () => {
    if (!selectedDoctorId) {
      toast.error("Please select a doctor to share with");
      return;
    }

    setSharing(true);

    try {
      // Get receiver's public key
      const { data: receiverProfile } = await supabase
        .from("profiles")
        .select("public_key_pem, full_name")
        .eq("id", selectedDoctorId)
        .single();

      // Get sender's profile
      const { data: senderProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", record.owner_id)
        .single();

      // Encrypt the AES key with receiver's public key (simplified for demo)
      const encryptedKey = receiverProfile?.public_key_pem 
        ? encryptKeyWithRSA(record.encrypted_aes_key, receiverProfile.public_key_pem)
        : record.encrypted_aes_key;

      // Update the record with sharing information
      const { error: updateError } = await supabase
        .from("medical_records")
        .update({
          shared_with_id: selectedDoctorId,
          encrypted_aes_key: encryptedKey,
        })
        .eq("id", record.id);

      if (updateError) throw updateError;

      // Add blockchain entry for the sharing event
      const blockData: BlockData = {
        fileName: record.file_name,
        fileHash: record.file_hash,
        senderId: record.owner_id,
        senderName: senderProfile?.full_name || "Doctor",
        receiverId: selectedDoctorId,
        receiverName: receiverProfile?.full_name || "Doctor",
        timestamp: new Date().toISOString()
      };

      // Get the latest block index
      const { data: latestBlock } = await supabase
        .from("blockchain_renewed")
        .select("block_index")
        .order("block_index", { ascending: false })
        .limit(1)
        .single();

      const newBlockIndex = latestBlock ? latestBlock.block_index + 1 : 0;

      // Get previous hash
      const { data: previousBlock } = await supabase
        .from("blockchain_renewed")
        .select("current_hash")
        .eq("block_index", newBlockIndex - 1)
        .single();

      const previousHash = previousBlock?.current_hash || "0";

      // Calculate new hash using blockchain.ts
      const blockchain = new Blockchain();
      const timestamp = new Date().toISOString();
      const calculatedHash = blockchain.calculateHash(
        newBlockIndex,
        timestamp,
        blockData,
        previousHash
      );

      // Insert blockchain record with all calculated values
      await supabase.from("blockchain_renewed").insert([{
        block_index: newBlockIndex,
        timestamp: timestamp,
        previous_hash: previousHash,
        current_hash: calculatedHash,
        data_json: blockData as any,
        sender_id: record.owner_id,
        receiver_id: selectedDoctorId,
      }]);

      toast.success("Medical record shared securely!");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Share error:", error);
      toast.error(error.message || "Error sharing record");
    } finally {
      setSharing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share Medical Record</DialogTitle>
          <DialogDescription>
            Select a doctor to securely share "{record?.file_name}" with using encryption
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="doctor-select">Select Doctor</Label>
            <Select value={selectedDoctorId} onValueChange={setSelectedDoctorId}>
              <SelectTrigger id="doctor-select">
                <SelectValue placeholder="Choose a doctor" />
              </SelectTrigger>
              <SelectContent>
                {doctors.map((doctor) => (
                  <SelectItem key={doctor.id} value={doctor.id}>
                    {doctor.full_name} {doctor.specialization && `- ${doctor.specialization}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
            <p className="font-semibold mb-1">Secure Sharing Process:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>AES key encrypted with receiver's RSA public key</li>
              <li>Only receiver can decrypt with their private key</li>
              <li>Sharing event recorded on blockchain</li>
              <li>Complete audit trail maintained</li>
            </ol>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleShare} disabled={!selectedDoctorId || sharing}>
            {sharing ? "Sharing..." : "Share Securely"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ShareRecordDialog;
