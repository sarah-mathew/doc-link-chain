import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Image as ImageIcon, Lock, Unlock, Download, Calendar } from "lucide-react";
import { decryptKeyWithRSA, decryptWithAES } from "@/lib/encryption";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface EncryptedImage {
  id: string;
  file_name: string;
  file_hash: string;
  encrypted_path: string;
  owner_id: string;
  receiver_id: string | null;
  encrypted_aes_key: string;
  metadata: any;
  created_at: string;
}

interface EncryptedImagesGalleryProps {
  profile: any;
}

const EncryptedImagesGallery = ({ profile }: EncryptedImagesGalleryProps) => {
  const [images, setImages] = useState<EncryptedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<EncryptedImage | null>(null);
  const [decryptedContent, setDecryptedContent] = useState<string | null>(null);
  const [decrypting, setDecrypting] = useState(false);

  useEffect(() => {
    loadImages();
  }, [profile]);

  const loadImages = async () => {
    try {
      const { data, error } = await supabase
        .from("encrypted_images")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setImages(data || []);
    } catch (error: any) {
      console.error("Error loading images:", error);
      toast.error("Failed to load images");
    } finally {
      setLoading(false);
    }
  };

  const handleDecrypt = async (image: EncryptedImage) => {
    setDecrypting(true);
    try {
      // Download encrypted file
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('encrypted-images')
        .download(image.encrypted_path);

      if (downloadError) throw downloadError;

      const encryptedContent = await fileData.text();

      // Get private key
      const { data: profileData } = await supabase
        .from("profiles")
        .select("private_key_pem")
        .eq("id", profile.id)
        .single();

      if (!profileData?.private_key_pem) throw new Error("Private key not found");

      // Decrypt AES key
      const aesKey = decryptKeyWithRSA(image.encrypted_aes_key, profileData.private_key_pem);
      if (!aesKey) throw new Error("Failed to decrypt AES key");

      // Decrypt content
      const decrypted = decryptWithAES(encryptedContent, aesKey);
      if (!decrypted) throw new Error("Failed to decrypt content");

      setDecryptedContent(decrypted);
      toast.success("Image decrypted successfully");
    } catch (error: any) {
      console.error("Decryption error:", error);
      toast.error(error.message || "Failed to decrypt image");
    } finally {
      setDecrypting(false);
    }
  };

  const handleDownload = () => {
    if (!decryptedContent || !selectedImage) return;

    const link = document.createElement('a');
    link.href = decryptedContent;
    link.download = selectedImage.file_name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Image downloaded");
  };

  const handleCloseDialog = () => {
    setSelectedImage(null);
    setDecryptedContent(null);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5" />
            Encrypted Images Gallery
          </CardTitle>
          <CardDescription>
            {images.length} encrypted image(s) in your vault
          </CardDescription>
        </CardHeader>
        <CardContent>
          {images.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No encrypted images yet</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {images.map((image) => (
                <Card key={image.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <CardContent className="p-4 space-y-3">
                    <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                      <Lock className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium text-sm truncate" title={image.file_name}>
                        {image.file_name}
                      </p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        {new Date(image.created_at).toLocaleDateString()}
                      </div>
                      {image.metadata?.size && (
                        <p className="text-xs text-muted-foreground">
                          {(image.metadata.size / 1024).toFixed(2)} KB
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setSelectedImage(image);
                        handleDecrypt(image);
                      }}
                    >
                      <Unlock className="w-3 h-3 mr-2" />
                      Decrypt & View
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedImage} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Decrypt Image</DialogTitle>
            <DialogDescription>
              {selectedImage?.file_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {!decryptedContent && (
              <Alert>
                <Lock className="w-4 h-4" />
                <AlertDescription>
                  {decrypting ? "Decrypting image..." : "Click decrypt to view the image"}
                </AlertDescription>
              </Alert>
            )}

            {decrypting && (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            )}

            {decryptedContent && !decrypting && (
              <div className="space-y-4">
                <div className="border rounded-lg overflow-hidden bg-muted/50">
                  <img 
                    src={decryptedContent} 
                    alt={selectedImage?.file_name}
                    className="w-full h-auto max-h-[500px] object-contain"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleDownload} className="flex-1">
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EncryptedImagesGallery;
