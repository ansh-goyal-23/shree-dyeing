import React, { useState, useRef } from 'react';
import { Loader2, X, Upload, RefreshCw } from 'lucide-react';
import { normalizeImage } from '@/lib/imageNormalize';

interface ImageUploadProps {
  onConfirm: (file: File) => Promise<void>;
  currentPath?: string | null;
  getPublicUrl?: (path: string) => string;
  uploading?: boolean;
  label?: string;
  compact?: boolean;
  /** Skip color normalization (default: false) */
  skipNormalization?: boolean;
}

const ImageUpload: React.FC<ImageUploadProps> = ({
  onConfirm,
  currentPath,
  getPublicUrl,
  uploading: externalUploading,
  label = 'Upload Photo',
  compact = false,
  skipNormalization = false,
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [normalizedUrl, setNormalizedUrl] = useState<string | null>(null);
  const [normalizedFile, setNormalizedFile] = useState<File | null>(null);
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [useOriginal, setUseOriginal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [uploading, setUploading] = useState(false);

  const isUploading = externalUploading || uploading;
  const hasPreview = originalUrl !== null;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    setRawFile(file);
    setUseOriginal(false);

    if (skipNormalization) {
      const url = URL.createObjectURL(file);
      setOriginalUrl(url);
      setNormalizedUrl(null);
      setNormalizedFile(null);
      return;
    }

    setProcessing(true);
    try {
      const result = await normalizeImage(file);
      setOriginalUrl(result.originalUrl);
      setNormalizedUrl(result.normalizedUrl);
      setNormalizedFile(result.normalizedFile);
    } catch {
      // Fallback: show original without normalization
      const url = URL.createObjectURL(file);
      setOriginalUrl(url);
      setNormalizedUrl(null);
      setNormalizedFile(null);
    }
    setProcessing(false);
  };

  const handleConfirm = async () => {
    const fileToUpload = (useOriginal || !normalizedFile) ? rawFile : normalizedFile;
    if (!fileToUpload) return;
    setUploading(true);
    try {
      await onConfirm(fileToUpload);
      clearPreview();
    } catch {
      // Error handled by parent
    }
    setUploading(false);
  };

  const clearPreview = () => {
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    if (normalizedUrl) URL.revokeObjectURL(normalizedUrl);
    setOriginalUrl(null);
    setNormalizedUrl(null);
    setNormalizedFile(null);
    setRawFile(null);
    setUseOriginal(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const currentUrl = currentPath && getPublicUrl ? getPublicUrl(currentPath) : null;
  const displayUrl = hasPreview
    ? (useOriginal || !normalizedUrl ? originalUrl : normalizedUrl)
    : null;

  return (
    <div className="space-y-2">
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />

      {/* Processing spinner */}
      {processing && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          Optimizing image…
        </div>
      )}

      {/* Preview with original/corrected toggle */}
      {hasPreview && !processing && (
        <div className="space-y-2">
          <div className="relative inline-block">
            <img
              src={displayUrl!}
              alt="Preview"
              className="w-40 h-40 sm:w-48 sm:h-48 object-cover rounded-lg border-2 border-primary/30"
            />
            {/* Badge showing current mode */}
            {normalizedUrl && (
              <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-black/60 text-white">
                {useOriginal ? 'Original' : 'Corrected'}
              </span>
            )}
            {/* Action buttons overlaid at bottom */}
            <div className="absolute inset-x-0 bottom-0 flex gap-1 p-1.5 bg-black/50 rounded-b-lg">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isUploading}
                className="flex-1 px-2 py-1.5 bg-approved text-approved-foreground rounded text-xs font-medium btn-transition hover:opacity-90 disabled:opacity-50"
              >
                {isUploading ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : 'Save'}
              </button>
              {normalizedUrl && (
                <button
                  type="button"
                  onClick={() => setUseOriginal(!useOriginal)}
                  disabled={isUploading}
                  title={useOriginal ? 'Use corrected' : 'Use original'}
                  className="px-2 py-1.5 bg-white/20 text-white rounded text-xs btn-transition hover:bg-white/30"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              )}
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
          {normalizedUrl && (
            <p className="text-[10px] text-muted-foreground">
              Tap <RefreshCw className="w-2.5 h-2.5 inline" /> to toggle original / color-corrected
            </p>
          )}
        </div>
      )}

      {/* Current uploaded image thumbnail */}
      {!hasPreview && !processing && currentUrl && (
        <img src={currentUrl} alt="Current" className="w-20 h-20 object-cover rounded-lg border border-border" />
      )}

      {/* Upload button */}
      {!hasPreview && !processing && (
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
          {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {isUploading ? 'Uploading…' : currentPath ? 'Change Photo' : label}
        </button>
      )}

      {!hasPreview && !processing && currentPath && <span className="text-xs text-approved ml-2">✓ Uploaded</span>}
    </div>
  );
};

export default ImageUpload;
