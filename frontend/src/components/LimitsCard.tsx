import React from 'react';
import { LimitCardProps } from '../types/salesforce';

export const LimitsCard: React.FC<LimitCardProps> = ({ title, data, category }) => {
  const usagePercent = ((data.Max - data.Remaining) / data.Max) * 100;
  const isHighUsage = usagePercent > 80;
  const isMediumUsage = usagePercent > 60;

  const getCategoryColor = () => {
    switch (category) {
      case 'api': return 'border-blue-200 bg-blue-50';
      case 'storage': return 'border-green-200 bg-green-50';
      case 'email': return 'border-purple-200 bg-purple-50';
      default: return 'border-gray-200 bg-gray-50';
    }
  };

  const getUsageColor = () => {
    if (isHighUsage) return 'bg-red-500';
    if (isMediumUsage) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className={`border rounded-lg p-6 ${getCategoryColor()}`}>
      <h3 className="font-semibold text-gray-900 mb-3">{title}</h3>
      
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Used: {(data.Max - data.Remaining).toLocaleString()}</span>
          <span>Available: {data.Remaining.toLocaleString()}</span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className={`h-2 rounded-full ${getUsageColor()}`}
            style={{ width: `${usagePercent}%` }}
          ></div>
        </div>
        
        <div className="flex justify-between text-xs text-gray-600">
          <span>{usagePercent.toFixed(1)}% used</span>
          <span>Max: {data.Max.toLocaleString()}</span>
        </div>
      </div>
      
      {isHighUsage && (
        <div className="mt-3 text-xs text-red-600 font-medium">
          ⚠️ High usage - consider upgrading
        </div>
      )}
    </div>
  );
};