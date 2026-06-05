import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, X, File, AlertCircle } from 'lucide-react';

interface DriveFileUploaderProps {
  providerToken: string | null;
  onUploadSuccess: (fileInfo: { id: string, url: string, name: string }) => void;
  existingSubmission?: { id: string, url: string, name: string };
  onRemove: () => void;
}

export const DriveFileUploader: React.FC<DriveFileUploaderProps> = ({ 
  providerToken, 
  onUploadSuccess, 
  existingSubmission,
  onRemove 
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const FOLDER_ID = '1CIeDzrrglXHi3tNqE0zkb8y5kUfwh0Dy';

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!providerToken) {
      setError('Google Drive access is required. Please re-authenticate.');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const metadata = {
        name: file.name,
        parents: [FOLDER_ID]
      };

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', file);

      const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${providerToken}`
        },
        body: form
      });

      if (!response.ok) {
        throw new Error('Failed to upload file to Google Drive.');
      }

      const data = await response.json();
      onUploadSuccess({
        id: data.id,
        name: data.name,
        url: data.webViewLink
      });
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during upload.');
    } finally {
      setIsUploading(false);
    }
  };

  if (existingSubmission) {
    return (
      <div className="flex items-center gap-4 p-4 border rounded-xl bg-muted/30">
        <div className="bg-primary/10 p-3 rounded-full">
          <File className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 overflow-hidden">
          <p className="font-medium truncate">{existingSubmission.name}</p>
          <a 
            href={existingSubmission.url} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-xs text-primary hover:underline block truncate mt-1"
          >
            {existingSubmission.url}
          </a>
        </div>
        <Button variant="ghost" size="icon" onClick={onRemove} className="text-destructive hover:bg-destructive/10">
          <X className="w-5 h-5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center w-full">
        <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-xl cursor-pointer bg-muted/10 hover:bg-muted/30 border-muted-foreground/30 hover:border-primary/50 transition-all">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <Upload className="w-10 h-10 mb-3 text-muted-foreground" />
            <p className="mb-2 text-sm text-muted-foreground">
              <span className="font-semibold text-primary">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              File will be directly uploaded to Anudip's Google Drive.
            </p>
            {isUploading && (
              <p className="text-sm font-semibold text-primary mt-4 animate-pulse">
                Uploading to Google Drive...
              </p>
            )}
          </div>
          <input 
            id="dropzone-file" 
            type="file" 
            className="hidden" 
            onChange={handleFileChange} 
            disabled={isUploading} 
          />
        </label>
      </div>
      
      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}
      
      {!providerToken && !error && (
        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-600 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <p>Note: You need to be signed in with Google Drive access to upload.</p>
        </div>
      )}
    </div>
  );
};
