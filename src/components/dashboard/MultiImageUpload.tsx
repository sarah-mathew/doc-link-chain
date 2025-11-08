import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Image as ImageIcon, Lock } from "lucide-react";
import { generateAESKey, encryptWithAES, encryptKeyWithRSA, hashFile, fileToBase64 } from "@/lib/encryption";
import CryptoJS from "crypto-js";

interface MultiImageUploadProps {
  profileId: string;
  onUploadComplete?: () => void;
}

const MultiImageUpload = ({ profileId, onUploadComplete }: MultiImageUploadProps) => {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      // Filter only image files
      const imageFiles = selectedFiles.filter(file => file.type.startsWith('image/'));
      if (imageFiles.length !== selectedFiles.length) {
        toast.warning("Only image files are allowed");
      }
      setFiles(imageFiles);
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error("Please select at least one image");
      return;
    }

    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get user's public key
      const { data: profile } = await supabase
        .from("profiles")
        .select("public_key_pem")
        .eq("id", profileId)
        .single();

      if (!profile?.public_key_pem) throw new Error("Public key not found");

      let successCount = 0;

      for (const file of files) {
        try {
          // Convert file to base64
          const base64Content = await fileToBase64(file);
          
          // Generate AES key and encrypt file
          const aesKey = generateAESKey();
          const encryptedContent = encryptWithAES(base64Content, aesKey);
          
          // Encrypt AES key with RSA
          const encryptedAESKey = encryptKeyWithRSA(aesKey, profile.public_key_pem);
          
          // Calculate hash
          const fileHash = hashFile(encryptedContent);

          // Upload to storage
          const filePath = `${user.id}/${Date.now()}-${file.name}`;
          const { error: uploadError } = await supabase.storage
            .from('encrypted-images')
            .upload(filePath, encryptedContent, {
              contentType: 'text/plain',
              upsert: false
            });

          if (uploadError) throw uploadError;

          // Save to database
          const { data: imageRecord, error: dbError } = await supabase
            .from("encrypted_images")
            .insert({
              file_name: file.name,
              file_hash: fileHash,
              encrypted_path: filePath,
              owner_id: profileId,
              encrypted_aes_key: encryptedAESKey,
              metadata: {
                size: file.size,
                type: file.type,
                uploadedAt: new Date().toISOString()
              }
            })
            .select()
            .single();

          if (dbError) throw dbError;

          // Add to blockchain_renewed
          const { data: lastBlock } = await supabase
            .from("blockchain_renewed")
            .select("*")
            .order("block_index", { ascending: false })
            .limit(1)
            .single();

          const newBlockIndex = lastBlock ? lastBlock.block_index + 1 : 0;
          const previousHash = lastBlock ? lastBlock.current_hash : "0";
          const timestamp = new Date().toISOString();
          
          const blockData = {
            fileName: file.name,
            fileHash: fileHash,
            senderId: profileId,
            receiverId: null,
            action: "IMAGE_UPLOADED",
            timestamp
          };

          const currentHash = CryptoJS.SHA256(
            newBlockIndex + timestamp + JSON.stringify(blockData) + previousHash
          ).toString();

          await supabase.from("blockchain_renewed").insert({
            block_index: newBlockIndex,
            timestamp,
            previous_hash: previousHash,
            current_hash: currentHash,
            data_json: blockData,
            sender_id: profileId,
            receiver_id: null
          });

          successCount++;
        } catch (error: any) {
          console.error(`Error uploading ${file.name}:`, error);
          toast.error(`Failed to upload ${file.name}: ${error.message}`);
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully uploaded ${successCount} of ${files.length} image(s)`);
        setFiles([]);
        if (onUploadComplete) onUploadComplete();
        // Reset file input
        const fileInput = document.getElementById('multi-image-input') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Error uploading images");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="w-5 h-5" />
          Upload Multiple Images
        </CardTitle>
        <CardDescription>
          Select multiple images to encrypt and upload securely
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Input
            id="multi-image-input"
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            disabled={uploading}
          />
          {files.length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-sm font-medium">Selected files: {files.length}</p>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {files.map((file, index) => (
                  <div key={index} className="text-xs text-muted-foreground flex items-center gap-2">
                    <ImageIcon className="w-3 h-3" />
                    {file.name} ({(file.size / 1024).toFixed(2)} KB)
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <Button 
          onClick={handleUpload} 
          disabled={uploading || files.length === 0}
          className="w-full"
        >
          {uploading ? (
            <>Processing {files.length} image(s)...</>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Upload & Encrypt Images
            </>
          )}
        </Button>

        <div className="bg-muted/50 p-4 rounded-lg space-y-2">
          <div className="flex items-start gap-2">
            <Lock className="w-4 h-4 mt-0.5 text-primary" />
            <div className="text-sm">
              <p className="font-medium">Encryption Process:</p>
              <ul className="text-xs text-muted-foreground mt-1 space-y-1">
                <li>• Each image encrypted with AES-256</li>
                <li>• AES keys encrypted with RSA</li>
                <li>• SHA-256 hash computed for verification</li>
                <li>• Stored in secure blockchain ledger</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MultiImageUpload;
