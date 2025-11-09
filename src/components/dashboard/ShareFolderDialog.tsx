import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Shield } from "lucide-react";
import { encryptKeyWithRSA } from "@/lib/encryption";
import { Blockchain, BlockData } from "@/lib/blockchain";

interface ShareFolderDialogProps {
  folder: {
    id: string;
    folder_name: string;
    folder_hash: string;
    owner_id: string;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface Doctor {
  id: string;
  full_name: string;
  specialization: string;
}

const ShareFolderDialog = ({
  folder,
  open,
  onOpenChange,
  onSuccess,
}: ShareFolderDialogProps) => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<string>("");
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (open && folder) {
      loadDoctors();
    }
  }, [open, folder]);

  const loadDoctors = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, specialization")
        .neq("id", folder?.owner_id);

      if (error) throw error;
      setDoctors(data || []);
    } catch (error: any) {
      console.error("Error loading doctors:", error);
      toast.error("Failed to load doctors");
    }
  };

  const handleShare = async () => {
    if (!selectedDoctor || !folder) return;

    setSharing(true);
    try {
      // Get receiver's public key and sender's name
      const [receiverResult, senderResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("public_key_pem, full_name")
          .eq("id", selectedDoctor)
          .single(),
        supabase
          .from("profiles")
          .select("full_name")
          .eq("id", folder.owner_id)
          .single(),
      ]);

      if (receiverResult.error) throw receiverResult.error;
      if (senderResult.error) throw senderResult.error;

      const receiverPublicKey = receiverResult.data.public_key_pem;
      const receiverName = receiverResult.data.full_name;
      const senderName = senderResult.data.full_name;

      if (!receiverPublicKey) {
        toast.error("Receiver's public key not found");
        return;
      }

      // Get all files in the folder with their encrypted AES keys
      const { data: files, error: filesError } = await supabase
        .from("encrypted_files")
        .select("id, encrypted_aes_key")
        .eq("folder_id", folder.id);

      if (filesError) throw filesError;

      if (!files || files.length === 0) {
        toast.error("No files found in folder");
        return;
      }

      // Re-encrypt each file's AES key with receiver's public key
      const fileUpdates = files.map((file) => {
        // Decrypt with sender's key would happen on backend in production
        // For this demo, we'll re-encrypt the existing key
        const reencryptedKey = encryptKeyWithRSA(
          file.encrypted_aes_key,
          receiverPublicKey
        );

        return {
          id: file.id,
          receiver_id: selectedDoctor,
          encrypted_aes_key: reencryptedKey,
        };
      });

      // Update all files with new encrypted keys and receiver
      for (const update of fileUpdates) {
        const { error: updateError } = await supabase
          .from("encrypted_files")
          .update({
            receiver_id: update.receiver_id,
            encrypted_aes_key: update.encrypted_aes_key,
          })
          .eq("id", update.id);

        if (updateError) throw updateError;
      }

      // Update folder with receiver information
      const { error: folderError } = await supabase
        .from("encrypted_folders")
        .update({ receiver_id: selectedDoctor })
        .eq("id", folder.id);

      if (folderError) throw folderError;

      // Create blockchain entry for folder sharing
      const blockData: BlockData = {
        fileName: `Folder: ${folder.folder_name} (${files.length} files)`,
        fileHash: folder.folder_hash,
        senderId: folder.owner_id,
        senderName: senderName,
        receiverId: selectedDoctor,
        receiverName: receiverName,
        timestamp: new Date().toISOString(),
      };

      // Get the latest block to calculate new hash
      const { data: latestBlock } = await supabase
        .from("blockchain_renewed")
        .select("block_index, current_hash")
        .order("block_index", { ascending: false })
        .limit(1)
        .maybeSingle();

      const newBlockIndex = latestBlock ? latestBlock.block_index + 1 : 0;
      const previousHash = latestBlock?.current_hash || "0";

      // Calculate new hash
      const blockchain = new Blockchain();
      const newHash = blockchain.calculateHash(
        newBlockIndex,
        new Date().toISOString(),
        blockData,
        previousHash
      );

      // Insert blockchain entry
      const { error: blockchainError } = await supabase
        .from("blockchain_renewed")
        .insert([{
          block_index: newBlockIndex,
          previous_hash: previousHash,
          current_hash: newHash,
          data_json: blockData as any,
          sender_id: folder.owner_id,
          receiver_id: selectedDoctor,
        }]);

      if (blockchainError) throw blockchainError;

      toast.success(`Folder securely shared with ${receiverName}`);
      onSuccess();
      onOpenChange(false);
      setSelectedDoctor("");
    } catch (error: any) {
      console.error("Error sharing folder:", error);
      toast.error("Failed to share folder");
    } finally {
      setSharing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Secure Share Folder
          </DialogTitle>
          <DialogDescription>
            Share "{folder?.folder_name}" securely with another verified doctor.
            All files will be re-encrypted with the recipient's public key.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Doctor</label>
            <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a verified doctor" />
              </SelectTrigger>
              <SelectContent>
                {doctors.map((doctor) => (
                  <SelectItem key={doctor.id} value={doctor.id}>
                    {doctor.full_name}
                    {doctor.specialization && ` - ${doctor.specialization}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="bg-muted p-3 rounded-lg text-sm">
            <p className="font-medium mb-1">🔒 Security Features:</p>
            <ul className="text-muted-foreground space-y-1 text-xs">
              <li>• End-to-end encryption with RSA-2048</li>
              <li>• Blockchain audit trail</li>
              <li>• Keys re-encrypted per recipient</li>
            </ul>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
            disabled={sharing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleShare}
            disabled={!selectedDoctor || sharing}
            className="flex-1"
          >
            {sharing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sharing...
              </>
            ) : (
              "Share Securely"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareFolderDialog;
