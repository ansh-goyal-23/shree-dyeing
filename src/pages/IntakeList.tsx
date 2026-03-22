import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useIntakeEntries } from '@/hooks/useSampling';
import { PlusCircle, Search, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const IntakeList: React.FC = () => {
  const { data: entries = [], isLoading } = useIntakeEntries();
  const [search, setSearch] = useState('');

  const filtered = entries.filter(e =>
    e.client_name.toLowerCase().includes(search.toLowerCase()) ||
    e.intake_type.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Sampling & Orders</h1>
        <Link
          to="/sampling/create"
          className="inline-flex items-center gap-2 px-4 h-11 bg-primary text-primary-foreground rounded-md text-sm font-medium btn-transition hover:opacity-90 focus-ring"
        >
          <PlusCircle className="w-4 h-4" />
          New Intake
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by client name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input-industrial w-full pl-10"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>{search ? 'No results found.' : 'No intake entries yet.'}</p>
        </div>
      ) : (
        <div className="card-industrial divide-y divide-border">
          {filtered.map(entry => (
            <Link
              key={entry.id}
              to={`/sampling/${entry.id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-secondary/50 btn-transition"
            >
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded bg-secondary flex items-center justify-center">
                  {entry.intake_type === 'Sheet' ? <FileText className="w-4 h-4 text-muted-foreground" /> : <ImageIcon className="w-4 h-4 text-muted-foreground" />}
                </div>
                <div>
                  <p className="font-medium text-sm">{entry.client_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(entry.received_date).toLocaleDateString()} • {entry.intake_type}
                  </p>
                </div>
              </div>
              <Badge variant="secondary" className="text-xs">{entry.intake_type}</Badge>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default IntakeList;
