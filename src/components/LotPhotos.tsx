import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { X, Loader2, Image as ImageIcon, Upload, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { normalizeImage } from '@/lib/imageNormalize';

interface LotPhoto {
  id: string;
  lot_no: string;
  step_id: string | null;
  file_path: string;
  label: string;
  category: string;
  created_at: string;
}

interface LotPhotosProps {
  lotNo: string;
  stepId?: string | null;
}

const LotPhotos: React.FC<LotPhotosProps> = ({ lotNo, stepId = null }) => {
  const [photos, setPhotos] = useState<LotPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [label, setLabel] = useState('');
  const [viewPhoto, setViewPhoto] = useState<LotPhoto | null>(null);

  // Preview state
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [normalizedUrl, setNormalizedUrl] = useState<string | null>(null);
  const [normalizedFile, setNormalizedFile] = useState<File | null>(null);
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [useOriginal, setUseOriginal] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const hasPreview = originalUrl !== null;

  const fetchPhotos = async () => {
    let query = supabase.from('lot_photos').select('*').eq('lot_no', lotNo).order('created_at', { ascending: false });
    if (stepId) {
      query = query.eq('step_id', stepId);
    } else {
      query = query.is('step_id', null);
    }
    const { data } = await query;
    if (data) setPhotos(data as unknown as LotPhoto[]);
  };

  useEffect(() => { fetchPhotos(); }, [lotNo, stepId]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file.'); return; }

    setRawFile(file);
    setUseOriginal(false);
    setProcessing(true);

    try {
      const result = await normalizeImage(file);
      setOriginalUrl(result.originalUrl);
      setNormalizedUrl(result.normalizedUrl);
      setNormalizedFile(result.normalizedFile);
    } catch {
      const url = URL.createObjectURL(file);
      setOriginalUrl(url);
      setNormalizedUrl(null);
      setNormalizedFile(null);
    }
    setProcessing(false);
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

  const handleConfirmUpload = async () => {
    const fileToUpload = (useOriginal || !normalizedFile) ? rawFile : normalizedFile;
    if (!fileToUpload) return;
    setUploading(true);
    const ext = fileToUpload.name.split('.').pop();
    const filePath = `${lotNo}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadErr } = await supabase.storage.from('lot-photos').upload(filePath, fileToUpload);
    if (uploadErr) { toast.error('Upload failed: ' + uploadErr.message); setUploading(false); return; }

    const { error: insertErr } = await supabase.from('lot_photos').insert({
      lot_no: lotNo,
      step_id: stepId || null,
      file_path: filePath,
      label: label.trim() || 'Untitled',
      category: stepId ? 'step' : 'base',
    });

    if (insertErr) { toast.error('Failed to save photo record.'); }
    else { toast.success('Photo uploaded.'); setLabel(''); await fetchPhotos(); }
    clearPreview();
    setUploading(false);
  };

  const handleDelete = async (photo: LotPhoto) => {
    await supabase.storage.from('lot-photos').remove([photo.file_path]);
    await supabase.from('lot_photos').delete().eq('id', photo.id);
    toast.success('Photo deleted.');
    setViewPhoto(null);
    await fetchPhotos();
  };

  const getPublicUrl = (filePath: string) => {
    const { data } = supabase.storage.from('lot-photos').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const displayUrl = hasPreview
    ? (useOriginal || !normalizedUrl ? originalUrl : normalizedUrl)
    : null;

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-3 flex-wrap">
        <div className="space-y-1 flex-1 min-w-[120px]">
          <label className="text-xs text-muted-foreground">Label</label>
          <input type="text" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. After leveling" className="input-industrial w-full text-sm" />
        </div>
        <div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
          <button onClick={() => fileRef.current?.click()} disabled={uploading || processing}
            className="px-3 h-9 bg-primary text-primary-foreground rounded-md text-xs font-medium btn-transition hover:opacity-90 focus-ring inline-flex items-center gap-1.5">
            {processing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {processing ? 'Processing…' : 'Select Photo'}
          </button>
        </div>
      </div>

      {/* Preview before upload with original/corrected toggle */}
      {hasPreview && !processing && (
        <div className="space-y-2">
          <div className="relative inline-block">
            <img src={displayUrl!} alt="Preview" className="w-32 h-32 sm:w-40 sm:h-40 object-cover rounded-lg border-2 border-primary/30" />
            {normalizedUrl && (
              <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-black/60 text-white">
                {useOriginal ? 'Original' : 'Corrected'}
              </span>
            )}
            <div className="absolute inset-x-0 bottom-0 flex gap-1 p-1.5 bg-black/50 rounded-b-lg">
              <button onClick={handleConfirmUpload} disabled={uploading}
                className="flex-1 px-2 py-1.5 bg-approved text-approved-foreground rounded text-xs font-medium btn-transition hover:opacity-90 disabled:opacity-50">
                {uploading ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : 'Upload'}
              </button>
              {normalizedUrl && (
                <button onClick={() => setUseOriginal(!useOriginal)} disabled={uploading}
                  title={useOriginal ? 'Use corrected' : 'Use original'}
                  className="px-2 py-1.5 bg-white/20 text-white rounded text-xs btn-transition hover:bg-white/30">
                  <RefreshCw className="w-3 h-3" />
                </button>
              )}
              <button onClick={clearPreview} disabled={uploading}
                className="px-2 py-1.5 bg-white/20 text-white rounded text-xs btn-transition hover:bg-white/30">
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

      {processing && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Optimizing image…
        </div>
      )}

      {photos.length === 0 && !hasPreview && !processing ? (
        <div className="text-center py-4 text-muted-foreground text-xs flex flex-col items-center gap-1">
          <ImageIcon className="w-6 h-6 opacity-40" />
          No photos yet.
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {photos.map(photo => (
            <button key={photo.id} onClick={() => setViewPhoto(photo)}
              className="group relative aspect-square rounded-lg overflow-hidden border border-border hover:border-primary btn-transition bg-secondary">
              <img src={getPublicUrl(photo.file_path)} alt={photo.label} className="w-full h-full object-cover" loading="lazy" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
                <p className="text-white text-[10px] font-medium truncate">{photo.label}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {viewPhoto && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setViewPhoto(null)}>
          <div className="relative max-w-3xl max-h-[90vh] w-full" onClick={e => e.stopPropagation()}>
            <img src={getPublicUrl(viewPhoto.file_path)} alt={viewPhoto.label} className="w-full max-h-[80vh] object-contain rounded-lg" />
            <div className="mt-2 flex items-center justify-between text-white text-sm">
              <div>
                <span className="font-medium">{viewPhoto.label}</span>
                <span className="text-white/40 ml-2">{new Date(viewPhoto.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleDelete(viewPhoto)} className="px-3 py-1.5 bg-destructive text-destructive-foreground rounded text-xs hover:opacity-90">Delete</button>
                <button onClick={() => setViewPhoto(null)} className="p-1.5 bg-white/20 rounded hover:bg-white/30"><X className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LotPhotos;
