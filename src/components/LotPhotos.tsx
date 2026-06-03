import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Camera, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

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
  const [label, setLabel] = useState('');
  const [viewPhoto, setViewPhoto] = useState<LotPhoto | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file.'); return; }

    setUploading(true);
    const ext = file.name.split('.').pop();
    const filePath = `${lotNo}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadErr } = await supabase.storage.from('lot-photos').upload(filePath, file);
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
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
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

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-3 flex-wrap">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Label</label>
          <input type="text" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. After leveling" className="input-industrial w-40 text-sm" />
        </div>
        <div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleUpload} className="hidden" />
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="px-3 h-9 bg-primary text-primary-foreground rounded-md text-xs font-medium btn-transition hover:opacity-90 focus-ring inline-flex items-center gap-1.5">
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>

      {photos.length === 0 ? (
        <div className="text-center py-4 text-muted-foreground text-xs flex flex-col items-center gap-1">
          <ImageIcon className="w-6 h-6 opacity-40" />
          No photos yet.
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {photos.map(photo => (
            <button key={photo.id} data-owner-id={(photo as any).created_by || ''} onClick={() => setViewPhoto(photo)}
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
          <div className="relative max-w-3xl max-h-[90vh] w-full" data-owner-id={(viewPhoto as any).created_by || ''} onClick={e => e.stopPropagation()}>
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
