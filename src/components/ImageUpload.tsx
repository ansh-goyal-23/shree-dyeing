import React, { useState, useRef } from 'react';
import { Image as ImageIcon, Loader2, X, Upload } from 'lucide-react';

interface ImageUploadProps {
  onConfirm: (file: File) => Promise<void>;
  currentPath?: string | null;
  getPublicUrl?: (path: string) => string;
  uploading?: boolean;
  label?: string;
  compact?: boolean;
}

/**
 * Image upload with gallery-first selection and preview before saving.
 * No camera capture attribute — lets user choose from gallery/files naturally.
 */
const ImageUpload: React.FC<ImageUploadProps> = ({
  onConfirm,
  currentPath,
  getPublicUrl,
  uploading: externalUploading,
  label = 'Upload Photo',
  compact = false,
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const isUploading = externalUploading || uploading;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;

    // Create preview
    const url = URL.createObjectURL(file);
    setPreview(url);
    setSelectedFile(file);
  };

  const handleConfirm = async () => {
    if (!selectedFile) return;
    setUploading(true);
    try {
      await onConfirm(selectedFile);
      clearPreview();
    } catch {
      // Error handled by parent
    }
    setUploading(false);
  };

  const clearPreview = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setSelectedFile(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  // Show current uploaded image
  const currentUrl = currentPath && getPublicUrl ? getPublicUrl(currentPath) : null;

  return (
    <div className="space-y-2">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Preview of selected (not yet uploaded) file */}
      {preview && (
        <div className="relative inline-block">
          <img
            src={preview}
            alt="Preview"
            className="w-32 h-32 sm:w-40 sm:h-40 object-cover rounded-lg border-2 border-primary/30"
          />
          <div className="absolute inset-x-0 bottom-0 flex gap-1 p-1.5 bg-black/50 rounded-b-lg">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isUploading}
              className="flex-1 px-2 py-1.5 bg-approved text-approved-foreground rounded text-xs font-medium btn-transition hover:opacity-90 disabled:opacity-50"
            >
              {isUploading ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : 'Confirm'}
            </button>
            <button
              type="button"
              onClick={clearPreview}
              disabled={isUploading}
              className="px-2 py-1.5 bg-white/20 text-white rounded text-xs btn-transition hover:bg-white/30"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Current uploaded image thumbnail */}
      {!preview && currentUrl && (
        <img src={currentUrl} alt="Current" className="w-20 h-20 object-cover rounded-lg border border-border" />
      )}

      {/* Upload button */}
      {!preview && (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={isUploading}
          className={`inline-flex items-center gap-1.5 rounded-md font-medium btn-transition hover:opacity-90 focus-ring ${
            compact
              ? 'px-3 h-9 bg-secondary text-secondary-foreground text-xs'
              : 'px-4 h-11 bg-secondary text-secondary-foreground text-sm'
          }`}
        >
          {isUploading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Upload className="w-3.5 h-3.5" />
          )}
          {isUploading ? 'Uploading…' : currentPath ? 'Change Photo' : label}
        </button>
      )}

      {!preview && currentPath && <span className="text-xs text-approved ml-2">✓ Uploaded</span>}
    </div>
  );
};

export default ImageUpload;
