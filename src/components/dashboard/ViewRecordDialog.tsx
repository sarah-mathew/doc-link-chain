import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Eye, Download, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { decryptKeyWithRSA, decryptWithAES } from "@/lib/encryption";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ViewRecordDialogProps {
  record: any;
  profile: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ViewRecordDialog = ({ record, profile, open, onOpenChange }: ViewRecordDialogProps) => {
  const profileId = profile?.id;
  const [decryptedContent, setDecryptedContent] = useState<string | null>(null);
  const [decrypting, setDecrypting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDecrypt = async () => {
    if (!record) return;
    
    setDecrypting(true);
    setError(null);
    
    try {
      let aesKey: string;
      
      // Determine if user is owner or receiver
      const isOwner = record.owner_id === profileId;
      const isReceiver = record.shared_with_id === profileId;
      
      if (!isOwner && !isReceiver) {
        throw new Error("You don't have permission to view this record");
      }
      
      if (isOwner) {
        // Owner can directly access the AES key (it's stored unencrypted for owned records)
        aesKey = record.encrypted_aes_key;
      } else {
        // Receiver needs to decrypt the AES key with their private key
        const privateKey = profile?.private_key_pem;
        if (!privateKey) {
          throw new Error("Private key not found. Please sign out and sign in again to generate keys.");
        }
        
        // Decrypt the AES key using RSA private key
        aesKey = decryptKeyWithRSA(record.encrypted_aes_key, privateKey);
        
        if (!aesKey) {
          throw new Error("Failed to decrypt AES key. The record may have been shared with an incompatible key.");
        }
      }
      
      // Decrypt the file content with the AES key
      const decrypted = decryptWithAES(record.encrypted_file_path, aesKey);
      
      if (!decrypted) {
        throw new Error("Failed to decrypt file content");
      }
      
      setDecryptedContent(decrypted);
      toast.success("Record decrypted successfully!");
      
    } catch (error: any) {
      console.error("Decryption error:", error);
      setError(error.message || "Failed to decrypt record");
      toast.error(error.message || "Failed to decrypt record");
    } finally {
      setDecrypting(false);
    }
  };

  const handleDownload = () => {
    if (!decryptedContent || !record) return;
    
    try {
      // Create a download link
      const link = document.createElement('a');
      link.href = decryptedContent;
      link.download = record.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success("File downloaded successfully!");
    } catch (error) {
      toast.error("Failed to download file");
    }
  };

  const handleClose = () => {
    setDecryptedContent(null);
    setError(null);
    onOpenChange(false);
  };

  if (!record) return null;

  const isOwner = record.owner_id === profileId;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            View Medical Record
          </DialogTitle>
          <DialogDescription>
            {isOwner ? "Your medical record" : `Shared by ${record.owner?.full_name}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">File Name:</p>
            <p className="text-sm text-muted-foreground">{record.file_name}</p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">File Hash (SHA-256):</p>
            <p className="text-xs text-muted-foreground font-mono break-all">
              {record.file_hash}
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!decryptedContent && !error && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Click the button below to decrypt and view this medical record. 
                {!isOwner && " You'll need your private key to decrypt the shared content."}
              </AlertDescription>
            </Alert>
          )}

          {!decryptedContent ? (
            <Button 
              onClick={handleDecrypt} 
              disabled={decrypting}
              className="w-full"
            >
              {decrypting ? "Decrypting..." : "Decrypt & View"}
            </Button>
          ) : (
            <>
              <div className="border rounded-lg p-4 bg-muted/20">
                <p className="text-sm font-medium mb-3">Decrypted Content:</p>
                <div className="max-h-96 overflow-auto">
                  <img 
                    src={decryptedContent} 
                    alt={record.file_name}
                    className="w-full h-auto rounded"
                    onError={() => {
                      setError("Unable to display image. The file may be corrupted or in an unsupported format.");
                    }}
                  />
                </div>
              </div>
              
              <Button 
                onClick={handleDownload}
                variant="outline"
                className="w-full"
              >
                <Download className="w-4 h-4 mr-2" />
                Download Decrypted File
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ViewRecordDialog;
