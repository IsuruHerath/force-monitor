import React from 'react';

interface TrendAnalysisProps {
  trends: {
    apiTrend: string;
    dataTrend: string;
    fileTrend: string;
    growthRates: {
      api: number;
      data: number;
      file: number;
    };
  };
}

export const TrendAnalysis: React.FC<TrendAnalysisProps> = ({ trends }) => {
  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return '📈';
      case 'decreasing':
        return '📉';
      case 'stable':
        return '➡️';
      default:
        return '❓';
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return 'text-red-600';
      case 'decreasing':
        return 'text-green-600';
      case 'stable':
        return 'text-blue-600';
      default:
        return 'text-gray-600';
    }
  };

  const formatGrowthRate = (rate: number) => {
    const sign = rate > 0 ? '+' : '';
    return `${sign}${rate.toFixed(1)}%`;
  };

  const trendItems = [
    {
      label: 'API Usage',
      trend: trends.apiTrend,
      rate: trends.growthRates.api,
      description: 'Daily API request utilization'
    },
    {
      label: 'Data Storage',
      trend: trends.dataTrend,
      rate: trends.growthRates.data,
      description: 'Organization data storage usage'
    },
    {
      label: 'File Storage',
      trend: trends.fileTrend,
      rate: trends.growthRates.file,
      description: 'File and attachment storage usage'
    }
  ];

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Usage Trends</h3>
      <div className="space-y-4">
        {trendItems.map((item, index) => (
          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">{getTrendIcon(item.trend)}</span>
              <div>
                <div className="font-medium text-gray-800">{item.label}</div>
                <div className="text-sm text-gray-600">{item.description}</div>
              </div>
            </div>
            <div className="text-right">
              <div className={`font-semibold ${getTrendColor(item.trend)}`}>
                {item.trend.charAt(0).toUpperCase() + item.trend.slice(1)}
              </div>
              <div className="text-sm text-gray-600">
                {formatGrowthRate(item.rate)}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="text-xs text-gray-500 space-y-1">
          <div>📈 Increasing: Usage growing over time</div>
          <div>📉 Decreasing: Usage declining over time</div>
          <div>➡️ Stable: Usage relatively unchanged</div>
        </div>
      </div>
    </div>
  );
};