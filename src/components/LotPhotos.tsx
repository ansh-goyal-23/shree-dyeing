import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Camera, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

interface LotPhoto {
  id: string;
  lot_no: string;
  file_path: string;
  label: string;
  category: 'version' | 'post_dye' | 'general';
  created_at: string;
}

interface LotPhotosProps {
  lotNo: string;
}

const CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'version', label: 'Version / Recipe' },
  { value: 'post_dye', label: 'Post-Dye Result' },
] as const;

const LotPhotos: React.FC<LotPhotosProps> = ({ lotNo }) => {
  const [photos, setPhotos] = useState<LotPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<LotPhoto['category']>('general');
  const [label, setLabel] = useState('');
  const [viewPhoto, setViewPhoto] = useState<LotPhoto | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchPhotos = async () => {
    const { data } = await supabase
      .from('lot_photos')
      .select('*')
      .eq('lot_no', lotNo)
      .order('created_at', { ascending: false });
    if (data) setPhotos(data as unknown as LotPhoto[]);
  };

  useEffect(() => { fetchPhotos(); }, [lotNo]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file.');
      return;
    }

    setUploading(true);
    const ext = file.name.split('.').pop();
    const filePath = `${lotNo}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from('lot-photos')
      .upload(filePath, file);

    if (uploadErr) {
      toast.error('Upload failed: ' + uploadErr.message);
      setUploading(false);
      return;
    }

    const { error: insertErr } = await supabase
      .from('lot_photos')
      .insert({
        lot_no: lotNo,
        file_path: filePath,
        label: label.trim() || 'Untitled',
        category: selectedCategory,
      });

    if (insertErr) {
      toast.error('Failed to save photo record.');
    } else {
      toast.success('Photo uploaded.');
      setLabel('');
      await fetchPhotos();
    }
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

  const categoryLabel = (cat: string) =>
    CATEGORIES.find(c => c.value === cat)?.label || cat;

  return (
    <div className="space-y-4">
      {/* Upload section */}
      <div className="flex items-end gap-3 flex-wrap">
        <div className="space-y-1.5">
          <label className="text-sm text-muted-foreground">Label</label>
          <input
            type="text"
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="e.g. After leveling"
            className="input-industrial w-48"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm text-muted-foreground">Category</label>
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value as LotPhoto['category'])}
            className="input-industrial w-44"
          >
            {CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleUpload}
            className="hidden"
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="px-4 h-11 bg-primary text-primary-foreground rounded-md text-sm font-medium btn-transition hover:opacity-90 focus-ring inline-flex items-center gap-2"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            {uploading ? 'Uploading…' : 'Upload Photo'}
          </button>
        </div>
      </div>

      {/* Photo grid */}
      {photos.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm flex flex-col items-center gap-2">
          <ImageIcon className="w-8 h-8 opacity-40" />
          No photos yet.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {photos.map(photo => (
            <button
              key={photo.id}
              onClick={() => setViewPhoto(photo)}
              className="group relative aspect-square rounded-lg overflow-hidden border border-border hover:border-primary btn-transition bg-secondary"
            >
              <img
                src={getPublicUrl(photo.file_path)}
                alt={photo.label}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                <p className="text-white text-xs font-medium truncate">{photo.label}</p>
                <p className="text-white/70 text-[10px]">{categoryLabel(photo.category)}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {viewPhoto && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setViewPhoto(null)}>
          <div className="relative max-w-3xl max-h-[90vh] w-full" onClick={e => e.stopPropagation()}>
            <img
              src={getPublicUrl(viewPhoto.file_path)}
              alt={viewPhoto.label}
              className="w-full max-h-[80vh] object-contain rounded-lg"
            />
            <div className="mt-2 flex items-center justify-between text-white text-sm">
              <div>
                <span className="font-medium">{viewPhoto.label}</span>
                <span className="text-white/60 ml-2">{categoryLabel(viewPhoto.category)}</span>
                <span className="text-white/40 ml-2">{new Date(viewPhoto.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleDelete(viewPhoto)}
                  className="px-3 py-1.5 bg-destructive text-destructive-foreground rounded text-xs hover:opacity-90"
                >
                  Delete
                </button>
                <button
                  onClick={() => setViewPhoto(null)}
                  className="p-1.5 bg-white/20 rounded hover:bg-white/30"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LotPhotos;
