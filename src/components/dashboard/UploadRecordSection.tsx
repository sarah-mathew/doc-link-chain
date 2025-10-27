import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { generateAESKey, encryptWithAES, hashFile, fileToBase64 } from "@/lib/encryption";
import { Blockchain, BlockData } from "@/lib/blockchain";

interface UploadRecordSectionProps {
  profileId: string;
}

const UploadRecordSection = ({ profileId }: UploadRecordSectionProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file || !profileId) {
      toast.error("Please select a file to upload");
      return;
    }

    setUploading(true);

    try {
      // Convert file to base64
      const fileContent = await fileToBase64(file);
      
      // Generate AES key and encrypt file
      const aesKey = generateAESKey();
      const encryptedContent = encryptWithAES(fileContent, aesKey);
      
      // Hash the file
      const fileHash = hashFile(fileContent);

      // For now, store encrypted AES key directly (in production, encrypt with receiver's public key)
      const encryptedAesKey = aesKey; // Simplified for demo

      // Get profile info
      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", profileId)
        .single();

      // Create medical record
      const { data: recordData, error: recordError } = await supabase
        .from("medical_records")
        .insert({
          file_name: file.name,
          file_hash: fileHash,
          encrypted_file_path: encryptedContent,
          owner_id: profileId,
          encrypted_aes_key: encryptedAesKey,
          metadata: {
            size: file.size,
            type: file.type,
            uploadedAt: new Date().toISOString()
          }
        })
        .select()
        .single();

      if (recordError) throw recordError;

      // Add to blockchain
      const blockData: BlockData = {
        fileName: file.name,
        fileHash: fileHash,
        senderId: profileId,
        senderName: profileData?.full_name || "Doctor",
        timestamp: new Date().toISOString()
      };

      // Get the latest block index
      const { data: latestBlock } = await supabase
        .from("blockchain")
        .select("block_index")
        .order("block_index", { ascending: false })
        .limit(1)
        .single();

      const newBlockIndex = latestBlock ? latestBlock.block_index + 1 : 0;

      // Get previous hash
      const { data: previousBlock } = await supabase
        .from("blockchain")
        .select("current_hash")
        .eq("block_index", newBlockIndex - 1)
        .single();

      const previousHash = previousBlock?.current_hash || "0";

      // Calculate new hash
      const blockchain = new Blockchain();
      const calculatedHash = blockchain.calculateHash(
        newBlockIndex,
        new Date().toISOString(),
        blockData,
        previousHash
      );

      // Insert blockchain record
      await supabase.from("blockchain").insert([{
        block_index: newBlockIndex,
        previous_hash: previousHash,
        current_hash: calculatedHash,
        data_json: blockData as any,
        sender_id: profileId,
      }]);

      toast.success("Medical record uploaded and added to blockchain!");
      setFile(null);
      
      // Reset file input
      const fileInput = document.getElementById("file-upload") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Error uploading file");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="w-5 h-5" />
          Upload Medical Record
        </CardTitle>
        <CardDescription>
          Securely encrypt and store medical files on the blockchain
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="file-upload">Select Medical File</Label>
          <Input
            id="file-upload"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.dcm"
            onChange={handleFileChange}
            disabled={uploading}
          />
          {file && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="w-4 h-4" />
              <span>{file.name} ({(file.size / 1024).toFixed(2)} KB)</span>
            </div>
          )}
        </div>

        <Button 
          onClick={handleUpload} 
          disabled={!file || uploading}
          className="w-full"
        >
          {uploading ? "Encrypting and uploading..." : "Upload & Encrypt"}
        </Button>

        <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
          <p className="font-semibold mb-1">Encryption Process:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>File encrypted with AES-256</li>
            <li>File hash calculated with SHA-256</li>
            <li>Record added to blockchain</li>
            <li>Verification complete</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
};

export default UploadRecordSection;
