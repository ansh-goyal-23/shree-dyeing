import React from 'react';
import { useApp } from '@/context/AppContext';
import { Link } from 'react-router-dom';
import { PlusCircle, CheckCircle2, Clock, Database, ArrowRight } from 'lucide-react';

const Dashboard: React.FC = () => {
  const { lots, masterItems } = useApp();
  const approvedCount = lots.filter(l => l.is_approved).length;
  const draftCount = lots.filter(l => !l.is_approved).length;
  const recentLots = [...lots].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);

  const stats = [
    { label: 'Total Lots', value: lots.length, icon: Database, color: 'text-foreground' },
    { label: 'Approved', value: approvedCount, icon: CheckCircle2, color: 'text-approved' },
    { label: 'Draft', value: draftCount, icon: Clock, color: 'text-correction' },
    { label: 'Master Items', value: masterItems.length, icon: Database, color: 'text-muted-foreground' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <Link
          to="/shade-management/lots/create"
          className="inline-flex items-center gap-2 px-4 h-11 bg-primary text-primary-foreground rounded-md text-sm font-medium btn-transition hover:opacity-90 focus-ring"
        >
          <PlusCircle className="w-4 h-4" />
          New Lot
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="card-industrial p-4">
            <div className="flex items-center gap-3">
              <s.icon className={`w-5 h-5 ${s.color}`} />
              <div>
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-semibold font-data">{s.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card-industrial">
        <div className="flex items-center justify-between p-4 row-separator">
          <h2 className="text-lg font-semibold">Recent Lots</h2>
          <Link to="/shade-management/lots" className="text-sm text-muted-foreground hover:text-foreground btn-transition flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {recentLots.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <p>No lots created yet.</p>
            <Link to="/shade-management/lots/create" className="text-primary underline text-sm mt-2 inline-block">Create your first lot</Link>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {recentLots.map(lot => (
              <Link
                key={lot.lot_no}
                to={`/shade-management/lots/${lot.lot_no}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-secondary/50 btn-transition"
              >
                <div className="flex items-center gap-4">
                  <span className="font-data font-semibold text-sm">{lot.lot_no}</span>
                  <span className="text-sm text-muted-foreground">{lot.yarn_company_name}</span>
                  {lot.color_name && <span className="text-sm text-muted-foreground">• {lot.color_name}</span>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-data text-sm">{lot.net_weight} kg</span>
                  {lot.is_approved ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-approved/10 text-approved rounded">
                      <CheckCircle2 className="w-3 h-3" /> Approved
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-correction/10 text-correction rounded">
                      <Clock className="w-3 h-3" /> Draft
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
