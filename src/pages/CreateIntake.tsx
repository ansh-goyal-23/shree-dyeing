import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateIntakeEntry } from '@/hooks/useSampling';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Upload, X } from 'lucide-react';
import ClientSelect from '@/components/ClientSelect';
import type { IntakeType } from '@/types/sampling';

const CreateIntake: React.FC = () => {
  const navigate = useNavigate();
  const createEntry = useCreateIntakeEntry();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [form, setForm] = useState({
    intake_type: 'Sheet' as IntakeType,
    received_date: new Date().toISOString().split('T')[0],
    client_id: '',
    notes: '',
    reference_photo_path: null as string | null,
  });

  const update = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }));

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) { toast.error('Please select an image.'); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    setSelectedFile(file);
  };

  const handleConfirmUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    const ext = selectedFile.name.split('.').pop();
    const path = `intake-refs/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('lot-photos').upload(path, selectedFile);
    if (error) { toast.error('Upload failed.'); setUploading(false); return; }
    update('reference_photo_path', path);
    toast.success('Reference photo uploaded.');
    clearPreview();
    setUploading(false);
  };

  const clearPreview = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setSelectedFile(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.client_id) { toast.error('Please select a client.'); return; }

    try {
      const entry = await createEntry.mutateAsync({
        intake_type: form.intake_type,
        received_date: form.received_date,
        sheet_date: null,
        client_id: form.client_id,
        notes: form.notes.trim(),
        reference_photo_path: form.reference_photo_path,
      });
      toast.success('Intake entry created.');
      navigate(`/sampling/${entry.id}`);
    } catch {
      toast.error('Failed to create intake entry.');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">New Intake Entry</h1>
      <form onSubmit={handleSubmit} className="card-industrial p-4 sm:p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Intake Type *</label>
            <select value={form.intake_type} onChange={e => update('intake_type', e.target.value)} className="input-industrial w-full">
              <option value="Sheet">Sheet</option>
              <option value="Loose Sample">Loose Sample</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Received Date *</label>
            <input type="date" value={form.received_date} onChange={e => update('received_date', e.target.value)} className="input-industrial w-full" required />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Client *</label>
          <ClientSelect value={form.client_id} onChange={v => update('client_id', v)} />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Notes</label>
          <textarea value={form.notes} onChange={e => update('notes', e.target.value)} className="input-industrial w-full min-h-[80px] py-2" placeholder="Any additional notes..." />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Reference Photo</label>
          <div className="space-y-2">
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />

            {/* Preview before upload */}
            {preview && (
              <div className="relative inline-block">
                <img src={preview} alt="Preview" className="w-32 h-32 sm:w-40 sm:h-40 object-cover rounded-lg border-2 border-primary/30" />
                <div className="absolute inset-x-0 bottom-0 flex gap-1 p-1.5 bg-black/50 rounded-b-lg">
                  <button type="button" onClick={handleConfirmUpload} disabled={uploading}
                    className="flex-1 px-2 py-1.5 bg-approved text-approved-foreground rounded text-xs font-medium btn-transition hover:opacity-90 disabled:opacity-50">
                    {uploading ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : 'Confirm'}
                  </button>
                  <button type="button" onClick={clearPreview} disabled={uploading}
                    className="px-2 py-1.5 bg-white/20 text-white rounded text-xs btn-transition hover:bg-white/30">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}

            {!preview && (
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                  className="px-3 h-9 bg-secondary text-secondary-foreground rounded-md text-xs font-medium btn-transition hover:opacity-90 focus-ring inline-flex items-center gap-1.5">
                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {uploading ? 'Uploading…' : form.reference_photo_path ? 'Change Photo' : 'Upload Photo'}
                </button>
                {form.reference_photo_path && <span className="text-xs text-approved">✓ Uploaded</span>}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
          <button type="button" onClick={() => navigate('/sampling')}
            className="px-4 h-11 border border-input rounded-md text-sm font-medium btn-transition hover:bg-secondary focus-ring">
            Cancel
          </button>
          <button type="submit" disabled={createEntry.isPending}
            className="px-6 h-11 bg-primary text-primary-foreground rounded-md text-sm font-medium btn-transition hover:opacity-90 focus-ring">
            {createEntry.isPending ? 'Creating…' : 'Create Entry'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateIntake;
