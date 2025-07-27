import React from 'react';
import { OrgLimits } from '../types/salesforce';

interface SummaryDashboardProps {
  limits: OrgLimits;
}

export const SummaryDashboard: React.FC<SummaryDashboardProps> = ({ limits }) => {
  const calculateOverallHealth = () => {
    const usagePercentages = Object.values(limits)
      .filter(limit => limit.Max > 0) // Filter out invalid limits
      .map(limit => 
        ((limit.Max - limit.Remaining) / limit.Max) * 100
      );
    
    const avgUsage = usagePercentages.length > 0 
      ? usagePercentages.reduce((sum, usage) => sum + usage, 0) / usagePercentages.length 
      : 0;
    const highUsageCount = usagePercentages.filter(usage => usage > 80).length;
    
    if (highUsageCount > 3 || avgUsage > 70) return { status: 'critical', color: 'red' };
    if (highUsageCount > 1 || avgUsage > 50) return { status: 'warning', color: 'yellow' };
    return { status: 'healthy', color: 'green' };
  };

  const getCriticalMetrics = () => {
    return Object.entries(limits)
      .filter(([_, data]) => data.Max > 0 && ((data.Max - data.Remaining) / data.Max) * 100 > 80)
      .slice(0, 3); // Show top 3 critical metrics
  };

  const getKeyMetrics = () => {
    const apiMetrics = Object.entries(limits).filter(([name, data]) => 
      data.Max > 0 && (name.toLowerCase().includes('api') || name.toLowerCase().includes('request'))
    );
    const storageMetrics = Object.entries(limits).filter(([name, data]) => 
      data.Max > 0 && (name.toLowerCase().includes('storage') || name.toLowerCase().includes('mb'))
    );
    
    return {
      api: apiMetrics.slice(0, 2),
      storage: storageMetrics.slice(0, 2)
    };
  };

  const health = calculateOverallHealth();
  const criticalMetrics = getCriticalMetrics();
  const keyMetrics = getKeyMetrics();

  const formatMetricName = (name: string) => {
    return name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
      {/* Overall Health Status */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <div className={`w-4 h-4 rounded-full bg-${health.color}-500`}></div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Org Health Status</h2>
            <p className={`text-${health.color}-600 font-medium capitalize`}>
              {health.status === 'critical' ? 'Needs Attention' : 
               health.status === 'warning' ? 'Monitor Closely' : 'All Good'}
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-gray-900">{Object.keys(limits).length}</div>
          <div className="text-sm text-gray-500">Total Limits</div>
        </div>
      </div>

      {/* Critical Alerts */}
      {criticalMetrics.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <h3 className="flex items-center text-red-800 font-semibold mb-2">
            ⚠️ Critical Usage Alerts ({criticalMetrics.length})
          </h3>
          <div className="space-y-2">
            {criticalMetrics.map(([name, data]) => {
              const usage = data.Max > 0 ? ((data.Max - data.Remaining) / data.Max) * 100 : 0;
              return (
                <div key={name} className="flex justify-between text-sm">
                  <span className="text-red-700">{formatMetricName(name)}</span>
                  <span className="font-medium text-red-800">{usage.toFixed(1)}% used</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Key Metrics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* API Usage */}
        <div className="bg-blue-50 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-3">🔌 API Usage</h3>
          {keyMetrics.api.length > 0 ? (
            <div className="space-y-2">
              {keyMetrics.api.map(([name, data]) => {
                const used = data.Max - data.Remaining;
                return (
                  <div key={name} className="flex justify-between text-sm">
                    <span className="text-blue-700">{formatMetricName(name)}</span>
                    <span className="font-medium text-blue-800">
                      {formatNumber(used)} / {formatNumber(data.Max)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-blue-600 text-sm">No API limits found</p>
          )}
        </div>

        {/* Storage Usage */}
        <div className="bg-green-50 rounded-lg p-4">
          <h3 className="font-semibold text-green-900 mb-3">💾 Storage Usage</h3>
          {keyMetrics.storage.length > 0 ? (
            <div className="space-y-2">
              {keyMetrics.storage.map(([name, data]) => {
                const used = data.Max - data.Remaining;
                return (
                  <div key={name} className="flex justify-between text-sm">
                    <span className="text-green-700">{formatMetricName(name)}</span>
                    <span className="font-medium text-green-800">
                      {formatNumber(used)} / {formatNumber(data.Max)} MB
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-green-600 text-sm">No storage limits found</p>
          )}
        </div>
      </div>
    </div>
  );
};