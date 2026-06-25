import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, Users, ShieldAlert } from 'lucide-react';
import BusinessEventsTab from '@/components/activity/BusinessEventsTab';
import UserActivityTab from '@/components/activity/UserActivityTab';
import SystemEventsTab from '@/components/activity/SystemEventsTab';

const ActivityCenter: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'business';

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2"><Activity className="h-6 w-6" />Activity Center</h1>
        <p className="text-sm text-muted-foreground">Central monitoring for business events, user activity, and system health.</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v })}>
        <TabsList>
          <TabsTrigger value="business"><Activity className="h-4 w-4 mr-1.5" />Business Events</TabsTrigger>
          <TabsTrigger value="users"><Users className="h-4 w-4 mr-1.5" />User Activity</TabsTrigger>
          <TabsTrigger value="system"><ShieldAlert className="h-4 w-4 mr-1.5" />System Events</TabsTrigger>
        </TabsList>
        <TabsContent value="business" className="mt-4"><BusinessEventsTab /></TabsContent>
        <TabsContent value="users" className="mt-4"><UserActivityTab /></TabsContent>
        <TabsContent value="system" className="mt-4"><SystemEventsTab /></TabsContent>
      </Tabs>
    </div>
  );
};

export default ActivityCenter;
