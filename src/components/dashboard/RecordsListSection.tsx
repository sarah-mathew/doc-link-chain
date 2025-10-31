import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Share2, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ShareRecordDialog from "./ShareRecordDialog";
import ViewRecordDialog from "./ViewRecordDialog";

interface RecordsListSectionProps {
  profileId: string;
}

const RecordsListSection = ({ profileId }: RecordsListSectionProps) => {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);

  useEffect(() => {
    if (profileId) {
      loadRecords();
    }
  }, [profileId]);

  const loadRecords = async () => {
    try {
      const { data, error } = await supabase
        .from("medical_records")
        .select(`
          *,
          owner:profiles!owner_id(full_name, specialization),
          shared_with:profiles!shared_with_id(full_name, specialization)
        `)
        .or(`owner_id.eq.${profileId},shared_with_id.eq.${profileId}`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRecords(data || []);
    } catch (error: any) {
      console.error("Error loading records:", error);
      toast.error("Error loading medical records");
    } finally {
      setLoading(false);
    }
  };

  const handleShare = (record: any) => {
    setSelectedRecord(record);
    setShareDialogOpen(true);
  };

  const handleView = (record: any) => {
    setSelectedRecord(record);
    setViewDialogOpen(true);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-sm text-muted-foreground mt-2">Loading records...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Medical Records
          </CardTitle>
          <CardDescription>
            View and manage your encrypted medical records
          </CardDescription>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No medical records found</p>
              <p className="text-sm text-muted-foreground mt-1">Upload your first record to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {records.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{record.file_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {record.owner_id === profileId ? "Owned by you" : `Shared by ${record.owner?.full_name}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Hash: {record.file_hash.substring(0, 16)}...
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleView(record)}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Button>
                    {record.owner_id === profileId && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleShare(record)}
                      >
                        <Share2 className="w-4 h-4 mr-1" />
                        Share
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ShareRecordDialog
        record={selectedRecord}
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        onSuccess={loadRecords}
      />
      
      <ViewRecordDialog
        record={selectedRecord}
        profileId={profileId}
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
      />
    </>
  );
};

export default RecordsListSection;
