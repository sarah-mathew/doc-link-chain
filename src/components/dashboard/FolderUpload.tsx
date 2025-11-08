import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, FolderOpen, Loader2 } from "lucide-react";
import { generateAESKey, encryptWithAES, encryptKeyWithRSA, hashFile, fileToBase64 } from "@/lib/encryption";
import CryptoJS from "crypto-js";
import { Progress } from "@/components/ui/progress";

interface FolderUploadProps {
  profileId: string;
  onUploadComplete?: () => void;
}

interface FileWithPath extends File {
  webkitRelativePath: string;
}

const FolderUpload = ({ profileId, onUploadComplete }: FolderUploadProps) => {
  const [files, setFiles] = useState<FileWithPath[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState("");

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files) as FileWithPath[];
      setFiles(selectedFiles);
    }
  };

  const getFolderName = (files: FileWithPath[]): string => {
    if (files.length === 0) return "";
    const firstPath = files[0].webkitRelativePath;
    return firstPath.split("/")[0] || "Unknown Folder";
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error("Please select a folder");
      return;
    }

    setUploading(true);
    setProgress(0);

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

      const folderId = crypto.randomUUID();
      const folderName = getFolderName(files);
      let successCount = 0;
      const fileHashes: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setCurrentFile(file.name);
        setProgress(Math.round(((i + 1) / files.length) * 100));

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
          fileHashes.push(fileHash);

          // Upload to storage with folder structure
          const relativePath = file.webkitRelativePath || file.name;
          const filePath = `${user.id}/${folderId}/${relativePath}`;
          
          const { error: uploadError } = await supabase.storage
            .from('encrypted-images')
            .upload(filePath, encryptedContent, {
              contentType: 'text/plain',
              upsert: false
            });

          if (uploadError) throw uploadError;

          // Save to database
          await supabase
            .from("encrypted_files")
            .insert({
              folder_id: folderId,
              file_name: file.name,
              file_hash: fileHash,
              encrypted_path: filePath,
              owner_id: profileId,
              encrypted_aes_key: encryptedAESKey,
              metadata: {
                size: file.size,
                type: file.type,
                relativePath: file.webkitRelativePath,
                uploadedAt: new Date().toISOString()
              }
            });

          successCount++;
        } catch (error: any) {
          console.error(`Error uploading ${file.name}:`, error);
          toast.error(`Failed to upload ${file.name}: ${error.message}`);
        }
      }

      if (successCount > 0) {
        // Create combined folder hash
        const folderHash = CryptoJS.SHA256(fileHashes.join("")).toString();

        // Save folder record
        await supabase.from("encrypted_folders").insert({
          id: folderId,
          folder_name: folderName,
          folder_hash: folderHash,
          owner_id: profileId,
          file_count: successCount,
          metadata: {
            totalFiles: files.length,
            successfulUploads: successCount,
            uploadedAt: new Date().toISOString()
          }
        });

        // Add to blockchain
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
          folderId,
          folderName,
          folderHash,
          fileCount: successCount,
          senderId: profileId,
          receiverId: null,
          action: "FOLDER_UPLOADED",
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

        toast.success(`Folder encrypted and stored successfully. ${successCount} of ${files.length} files uploaded. Blockchain record created.`);
        setFiles([]);
        setProgress(0);
        setCurrentFile("");
        if (onUploadComplete) onUploadComplete();
        
        // Reset file input
        const fileInput = document.getElementById('folder-input') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Error uploading folder");
    } finally {
      setUploading(false);
    }
  };

  const folderName = files.length > 0 ? getFolderName(files) : "";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderOpen className="w-5 h-5" />
          Upload Entire Folder
        </CardTitle>
        <CardDescription>
          Select a folder to encrypt and upload all files securely
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Input
            id="folder-input"
            type="file"
            /* @ts-ignore - webkitdirectory is not in the type definition */
            webkitdirectory=""
            directory=""
            multiple
            onChange={handleFolderChange}
            disabled={uploading}
            className="cursor-pointer"
          />
          {files.length > 0 && (
            <div className="mt-3 p-3 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium">
                Selected: <span className="text-primary">{folderName}</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {files.length} files selected
              </p>
            </div>
          )}
        </div>

        {uploading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Uploading...</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="w-full" />
            {currentFile && (
              <p className="text-xs text-muted-foreground">
                Processing: {currentFile}
              </p>
            )}
          </div>
        )}

        <Button 
          onClick={handleUpload} 
          disabled={uploading || files.length === 0}
          className="w-full"
        >
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Encrypting & Uploading...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Upload & Encrypt Folder
            </>
          )}
        </Button>

        <div className="bg-muted/50 p-4 rounded-lg space-y-2">
          <div className="text-sm">
            <p className="font-medium">Encryption & Blockchain Process:</p>
            <ul className="text-xs text-muted-foreground mt-2 space-y-1">
              <li>• Each file encrypted with unique AES-256 key</li>
              <li>• AES keys encrypted with RSA public key</li>
              <li>• SHA-256 hash computed per file</li>
              <li>• Combined folder hash for integrity</li>
              <li>• Blockchain record with folder hash</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default FolderUpload;
