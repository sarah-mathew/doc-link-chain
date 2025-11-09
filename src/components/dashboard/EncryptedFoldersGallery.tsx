import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FolderOpen, Download, Loader2, Lock, FileText, Share2 } from "lucide-react";
import { decryptKeyWithRSA, decryptWithAES } from "@/lib/encryption";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import ShareFolderDialog from "./ShareFolderDialog";
import JSZip from "jszip";

interface EncryptedFolder {
  id: string;
  folder_name: string;
  folder_hash: string;
  file_count: number;
  created_at: string;
  metadata: any;
  owner_id: string;
}

interface EncryptedFile {
  id: string;
  file_name: string;
  file_hash: string;
  encrypted_path: string;
  encrypted_aes_key: string;
  metadata: any;
  created_at: string;
}

interface EncryptedFoldersGalleryProps {
  profileId: string;
}

const EncryptedFoldersGallery = ({ profileId }: EncryptedFoldersGalleryProps) => {
  const [folders, setFolders] = useState<EncryptedFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState<EncryptedFolder | null>(null);
  const [folderFiles, setFolderFiles] = useState<EncryptedFile[]>([]);
  const [decrypting, setDecrypting] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [folderToShare, setFolderToShare] = useState<EncryptedFolder | null>(null);
  const [downloadingFolder, setDownloadingFolder] = useState(false);

  useEffect(() => {
    loadFolders();
  }, [profileId]);

  const loadFolders = async () => {
    try {
      const { data, error } = await supabase
        .from("encrypted_folders")
        .select("*")
        .eq("owner_id", profileId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFolders(data || []);
    } catch (error: any) {
      console.error("Error loading folders:", error);
      toast.error("Failed to load folders");
    } finally {
      setLoading(false);
    }
  };

  const loadFolderFiles = async (folderId: string) => {
    try {
      const { data, error } = await supabase
        .from("encrypted_files")
        .select("*")
        .eq("folder_id", folderId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFolderFiles(data || []);
    } catch (error: any) {
      console.error("Error loading folder files:", error);
      toast.error("Failed to load folder files");
    }
  };

  const handleViewFolder = async (folder: EncryptedFolder) => {
    setSelectedFolder(folder);
    await loadFolderFiles(folder.id);
  };

  const handleDecryptFile = async (file: EncryptedFile) => {
    setDecrypting(true);
    try {
      // Get user's private key
      const { data: profile } = await supabase
        .from("profiles")
        .select("private_key_pem")
        .eq("id", profileId)
        .single();

      if (!profile?.private_key_pem) {
        toast.error("Private key not found");
        return;
      }

      // Download encrypted file
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('encrypted-images')
        .download(file.encrypted_path);

      if (downloadError) throw downloadError;

      const encryptedContent = await fileData.text();

      // Decrypt AES key with RSA private key
      const aesKey = decryptKeyWithRSA(file.encrypted_aes_key, profile.private_key_pem);
      
      if (!aesKey) {
        toast.error("Failed to decrypt encryption key");
        return;
      }

      // Decrypt file content
      const decryptedBase64 = decryptWithAES(encryptedContent, aesKey);

      // Convert base64 to blob and download
      const response = await fetch(decryptedBase64);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success("File decrypted and downloaded successfully");
    } catch (error: any) {
      console.error("Error decrypting file:", error);
      toast.error("Failed to decrypt file");
    } finally {
      setDecrypting(false);
    }
  };

  const handleShareFolder = (folder: EncryptedFolder) => {
    setFolderToShare(folder);
    setShareDialogOpen(true);
  };

  const handleDownloadFolder = async (folder: EncryptedFolder) => {
    setDownloadingFolder(true);
    try {
      // Get user's private key
      const { data: profile } = await supabase
        .from("profiles")
        .select("private_key_pem")
        .eq("id", profileId)
        .single();

      if (!profile?.private_key_pem) {
        toast.error("Private key not found");
        return;
      }

      // Get all files in folder
      const { data: files, error: filesError } = await supabase
        .from("encrypted_files")
        .select("*")
        .eq("folder_id", folder.id);

      if (filesError) throw filesError;
      if (!files || files.length === 0) {
        toast.error("No files found in folder");
        return;
      }

      // Create ZIP file
      const zip = new JSZip();
      const folderZip = zip.folder(folder.folder_name);

      if (!folderZip) {
        toast.error("Failed to create folder in ZIP");
        return;
      }

      // Decrypt and add each file to ZIP
      for (const file of files) {
        try {
          // Download encrypted file
          const { data: fileData, error: downloadError } = await supabase.storage
            .from('encrypted-images')
            .download(file.encrypted_path);

          if (downloadError) throw downloadError;

          const encryptedContent = await fileData.text();

          // Decrypt AES key with RSA private key
          const aesKey = decryptKeyWithRSA(file.encrypted_aes_key, profile.private_key_pem);
          
          if (!aesKey) {
            console.error(`Failed to decrypt key for ${file.file_name}`);
            continue;
          }

          // Decrypt file content
          const decryptedBase64 = decryptWithAES(encryptedContent, aesKey);

          // Convert base64 to blob
          const response = await fetch(decryptedBase64);
          const blob = await response.blob();

          // Add to ZIP
          folderZip.file(file.file_name, blob);
        } catch (error) {
          console.error(`Error processing ${file.file_name}:`, error);
        }
      }

      // Generate and download ZIP
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${folder.folder_name}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success("Folder downloaded successfully");
    } catch (error: any) {
      console.error("Error downloading folder:", error);
      toast.error("Failed to download folder");
    } finally {
      setDownloadingFolder(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="w-6 h-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5" />
            Encrypted Folders
          </CardTitle>
          <CardDescription>
            View and manage your encrypted folder uploads
          </CardDescription>
        </CardHeader>
        <CardContent>
          {folders.length === 0 ? (
            <div className="text-center py-8">
              <FolderOpen className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                No encrypted folders yet. Upload a folder to get started.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {folders.map((folder) => (
                <Card key={folder.id} className="hover:bg-muted/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <FolderOpen className="w-8 h-8 text-primary" />
                      <Badge variant="secondary">{folder.file_count} files</Badge>
                    </div>
                    <h3 className="font-semibold text-sm mb-1 truncate">
                      {folder.folder_name}
                    </h3>
                    <p className="text-xs text-muted-foreground mb-3">
                      {new Date(folder.created_at).toLocaleDateString()}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => handleViewFolder(folder)}
                      >
                        <Lock className="w-3 h-3 mr-2" />
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleShareFolder(folder)}
                      >
                        <Share2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedFolder} onOpenChange={() => setSelectedFolder(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  <FolderOpen className="w-5 h-5" />
                  {selectedFolder?.folder_name}
                </DialogTitle>
                <DialogDescription>
                  {folderFiles.length} encrypted files in this folder
                </DialogDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => selectedFolder && handleDownloadFolder(selectedFolder)}
                disabled={downloadingFolder}
              >
                {downloadingFolder ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Download All
                  </>
                )}
              </Button>
            </div>
          </DialogHeader>
          
          <div className="space-y-2">
            {folderFiles.map((file) => (
              <Card key={file.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{file.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {file.metadata?.size ? `${(file.metadata.size / 1024).toFixed(2)} KB` : 'Unknown size'}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDecryptFile(file)}
                    disabled={decrypting}
                  >
                    {decrypting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-1" />
                        Decrypt
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <ShareFolderDialog
        folder={folderToShare}
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        onSuccess={loadFolders}
      />
    </>
  );
};

export default EncryptedFoldersGallery;
