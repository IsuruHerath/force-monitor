import React from 'react';
import { LimitsCard } from './LimitsCard';
import { OrgLimits } from '../types/salesforce';

interface LimitsGridProps {
  limits: OrgLimits;
}

export const LimitsGrid: React.FC<LimitsGridProps> = ({ limits }) => {
  const categorizeMetric = (metricName: string) => {
    if (metricName.toLowerCase().includes('api')) return 'api';
    if (metricName.toLowerCase().includes('storage') || metricName.toLowerCase().includes('mb')) return 'storage';
    if (metricName.toLowerCase().includes('email')) return 'email';
    return 'other';
  };

  const formatMetricName = (metricName: string) => {
    // Convert camelCase to readable format
    return metricName
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Object.entries(limits).map(([metricName, data]) => (
        <LimitsCard
          key={metricName}
          title={formatMetricName(metricName)}
          data={data}
          category={categorizeMetric(metricName)}
        />
      ))}
    </div>
  );
};