import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useIntakeEntries, useAllOrders } from '@/hooks/useSampling';
import { PlusCircle, Search, FileText, Image as ImageIcon, Loader2, ShoppingCart, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { IntakeItemStatus } from '@/types/sampling';

const statusColors: Record<IntakeItemStatus, string> = {
  Pending: 'bg-correction/10 text-correction',
  'In Development': 'bg-primary/10 text-primary',
  'In Production': 'bg-accent text-accent-foreground',
  Completed: 'bg-approved/10 text-approved',
  Cancelled: 'bg-destructive/10 text-destructive',
};

type Tab = 'intakes' | 'orders';

const IntakeList: React.FC = () => {
  const { data: entries = [], isLoading: entriesLoading } = useIntakeEntries();
  const { data: allOrders = [], isLoading: ordersLoading } = useAllOrders();
  const [tab, setTab] = useState<Tab>('intakes');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredEntries = useMemo(() => entries.filter(e =>
    e.client_name.toLowerCase().includes(search.toLowerCase()) ||
    e.intake_type.toLowerCase().includes(search.toLowerCase())
  ), [entries, search]);

  const filteredOrders = useMemo(() => {
    let filtered = allOrders;
    if (search) {
      filtered = filtered.filter(o =>
        o.client_name.toLowerCase().includes(search.toLowerCase()) ||
        o.shade_reference.toLowerCase().includes(search.toLowerCase()) ||
        o.linked_lot_no?.toLowerCase().includes(search.toLowerCase()) || false
      );
    }
    if (statusFilter !== 'all') {
      filtered = filtered.filter(o => o.status === statusFilter);
    }
    return filtered;
  }, [allOrders, search, statusFilter]);

  const isLoading = tab === 'intakes' ? entriesLoading : ordersLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Sampling & Orders</h1>
        <div className="flex gap-2">
          <Link to="/sampling/order/create"
            className="inline-flex items-center gap-2 px-4 h-11 border border-input rounded-md text-sm font-medium btn-transition hover:bg-secondary focus-ring">
            <ShoppingCart className="w-4 h-4" />
            Direct Order
          </Link>
          <Link to="/sampling/create"
            className="inline-flex items-center gap-2 px-4 h-11 bg-primary text-primary-foreground rounded-md text-sm font-medium btn-transition hover:opacity-90 focus-ring">
            <PlusCircle className="w-4 h-4" />
            New Intake
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        <button onClick={() => setTab('intakes')}
          className={`px-4 py-2 text-sm font-medium border-b-2 btn-transition ${tab === 'intakes' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
          Intake Entries
        </button>
        <button onClick={() => setTab('orders')}
          className={`px-4 py-2 text-sm font-medium border-b-2 btn-transition ${tab === 'orders' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
          All Orders ({allOrders.length})
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder={tab === 'intakes' ? 'Search by client...' : 'Search by client, shade, lot...'} value={search} onChange={e => setSearch(e.target.value)} className="input-industrial w-full pl-10" />
        </div>
        {tab === 'orders' && (
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-industrial w-40">
            <option value="all">All Status</option>
            <option value="Pending">Pending</option>
            <option value="In Development">In Development</option>
            <option value="In Production">In Production</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : tab === 'intakes' ? (
        /* Intake Entries Tab */
        filteredEntries.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>{search ? 'No results found.' : 'No intake entries yet.'}</p>
          </div>
        ) : (
          <div className="card-industrial divide-y divide-border">
            {filteredEntries.map(entry => (
              <Link key={entry.id} to={`/sampling/${entry.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-secondary/50 btn-transition">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded bg-secondary flex items-center justify-center">
                    {entry.intake_type === 'Sheet' ? <FileText className="w-4 h-4 text-muted-foreground" /> : <ImageIcon className="w-4 h-4 text-muted-foreground" />}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{entry.client_name}</p>
                    <p className="text-xs text-muted-foreground">{new Date(entry.received_date).toLocaleDateString()} • {entry.intake_type}</p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs">{entry.intake_type}</Badge>
              </Link>
            ))}
          </div>
        )
      ) : (
        /* Orders Tab */
        filteredOrders.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>{search || statusFilter !== 'all' ? 'No matching orders.' : 'No orders yet.'}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredOrders.map(order => (
              <div key={order.id} className={`card-industrial p-4 ${order.status === 'Cancelled' ? 'opacity-50' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{order.client_name || 'Unknown'}</span>
                        <Badge className={`text-[10px] ${statusColors[order.status]}`}>{order.status}</Badge>
                        {order.is_direct_order && <Badge variant="outline" className="text-[10px]">Direct</Badge>}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {order.shade_reference && <span>Shade: {order.shade_reference}</span>}
                        {order.order_quantity && <span>Qty: {order.order_quantity}</span>}
                        {order.yarn_type && <span>Yarn: {order.yarn_type}</span>}
                        <span>{new Date(order.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  {order.linked_lot_no && (
                    <Link to={`/shade-management/lots/${order.linked_lot_no}`}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline flex-shrink-0">
                      <ExternalLink className="w-3 h-3" /> Lot {order.linked_lot_no}
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
};

export default IntakeList;
