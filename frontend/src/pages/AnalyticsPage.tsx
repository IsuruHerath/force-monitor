import React from 'react';
import { HistoryDashboard } from '../components/HistoryDashboard';

export const AnalyticsPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <HistoryDashboard />
      </div>
    </div>
  );
};