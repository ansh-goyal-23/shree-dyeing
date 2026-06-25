import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  title: string;
  description?: string;
}

const StoreComingSoon: React.FC<Props> = ({ title, description }) => (
  <div className="p-6">
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-muted-foreground text-sm">
        {description || 'This module will be built next.'}
      </CardContent>
    </Card>
  </div>
);

export default StoreComingSoon;
