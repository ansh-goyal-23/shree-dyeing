import React, { useState, useMemo } from 'react';
import { useClients, useCreateClient } from '@/hooks/useSampling';
import { PlusCircle } from 'lucide-react';
import type { Client } from '@/types/sampling';

interface ClientSelectProps {
  value: string;
  onChange: (clientId: string) => void;
}

const ClientSelect: React.FC<ClientSelectProps> = ({ value, onChange }) => {
  const { data: clients = [] } = useClients();
  const createClient = useCreateClient();
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search) return clients;
    return clients.filter(c => c.client_name.toLowerCase().includes(search.toLowerCase()));
  }, [clients, search]);

  const handleCreateNew = async () => {
    if (!newName.trim()) return;
    try {
      const client = await createClient.mutateAsync({
        client_name: newName.trim(),
        contact_person: '',
        phone_number: '',
        notes: '',
      });
      onChange(client.id);
      setNewName('');
      setShowNew(false);
    } catch {
      // error handled by mutation
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="input-industrial w-full"
        >
          <option value="">Select client...</option>
          {clients.map(c => (
            <option key={c.id} value={c.id}>{c.client_name}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setShowNew(!showNew)}
          className="p-2 border border-input rounded-md hover:bg-secondary btn-transition flex-shrink-0"
          title="Add new client"
        >
          <PlusCircle className="w-4 h-4" />
        </button>
      </div>
      {showNew && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="input-industrial flex-1 text-sm"
            placeholder="New client name..."
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleCreateNew())}
          />
          <button
            type="button"
            onClick={handleCreateNew}
            disabled={createClient.isPending}
            className="px-3 h-9 bg-primary text-primary-foreground rounded text-xs font-medium btn-transition hover:opacity-90"
          >
            {createClient.isPending ? 'Adding…' : 'Add'}
          </button>
        </div>
      )}
    </div>
  );
};

export default ClientSelect;
