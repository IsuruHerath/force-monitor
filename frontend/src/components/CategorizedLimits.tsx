import React, { useState } from 'react';
import { OrgLimits, LimitData } from '../types/salesforce';

interface CategorizedLimitsProps {
  limits: OrgLimits;
}

interface CategoryInfo {
  name: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

const categories: Record<string, CategoryInfo> = {
  api: {
    name: 'API & Requests',
    icon: '🔌',
    color: 'blue',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200'
  },
  storage: {
    name: 'Storage & Data',
    icon: '💾',
    color: 'green', 
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200'
  },
  email: {
    name: 'Email & Messaging',
    icon: '📧',
    color: 'purple',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200'
  },
  sharing: {
    name: 'Sharing & Permissions',
    icon: '👥',
    color: 'indigo',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200'
  },
  other: {
    name: 'Other Limits',
    icon: '⚙️',
    color: 'gray',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200'
  }
};

export const CategorizedLimits: React.FC<CategorizedLimitsProps> = ({ limits }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const categorizeMetric = (metricName: string): string => {
    const name = metricName.toLowerCase();
    
    if (name.includes('api') || name.includes('request') || name.includes('call')) return 'api';
    if (name.includes('storage') || name.includes('mb') || name.includes('data') || name.includes('file')) return 'storage';
    if (name.includes('email') || name.includes('mail') || name.includes('message')) return 'email';
    if (name.includes('sharing') || name.includes('permission') || name.includes('user') || name.includes('role')) return 'sharing';
    
    return 'other';
  };

  const formatMetricName = (name: string) => {
    return name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const getUsageColor = (percentage: number) => {
    if (percentage > 80) return 'text-red-600';
    if (percentage > 60) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getProgressBarColor = (percentage: number) => {
    if (percentage > 80) return 'bg-red-500';
    if (percentage > 60) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const toggleSection = (section: string) => {
    const newCollapsed = new Set(collapsedSections);
    if (newCollapsed.has(section)) {
      newCollapsed.delete(section);
    } else {
      newCollapsed.add(section);
    }
    setCollapsedSections(newCollapsed);
  };

  // Multi-word search function
  const matchesSearch = (name: string, searchTerm: string) => {
    if (!searchTerm) return true;
    
    const searchWords = searchTerm.toLowerCase().split(/\s+/).filter(word => word.length > 0);
    const searchableText = formatMetricName(name).toLowerCase();
    
    return searchWords.every(word => searchableText.includes(word));
  };

  // Group and filter metrics
  const groupedMetrics = Object.entries(limits).reduce((acc, [name, data]) => {
    if (!matchesSearch(name, searchTerm) || data.Max === 0) {
      return acc; // Filter out limits with Max = 0
    }
    
    const category = categorizeMetric(name);
    if (!acc[category]) acc[category] = [];
    acc[category].push([name, data]);
    return acc;
  }, {} as Record<string, [string, LimitData][]>);

  return (
    <div className="space-y-3">
      {/* Search Bar */}
      <div className="bg-white rounded-lg shadow-sm border p-3">
        <div className="relative">
          <input
            type="text"
            placeholder="Search limits..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
          <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
            <span className="text-gray-400 text-sm">🔍</span>
          </div>
        </div>
      </div>

      {/* Categorized Sections */}
      {Object.entries(categories).map(([categoryKey, categoryInfo]) => {
        const metrics = groupedMetrics[categoryKey] || [];
        
        if (metrics.length === 0) return null;

        const isCollapsed = collapsedSections.has(categoryKey);
        const criticalCount = metrics.filter(([_, data]) => 
          ((data.Max - data.Remaining) / data.Max) * 100 > 80
        ).length;

        return (
          <div key={categoryKey} className="bg-white rounded-lg shadow-sm border">
            {/* Section Header */}
            <div 
              className={`${categoryInfo.bgColor} ${categoryInfo.borderColor} border-b p-2 cursor-pointer`}
              onClick={() => toggleSection(categoryKey)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-lg">{categoryInfo.icon}</span>
                  <div>
                    <h3 className={`font-medium text-${categoryInfo.color}-900 text-sm`}>
                      {categoryInfo.name}
                    </h3>
                    <p className={`text-xs text-${categoryInfo.color}-600`}>
                      {metrics.length} limit{metrics.length !== 1 ? 's' : ''}
                      {criticalCount > 0 && (
                        <span className="ml-1 text-red-600 font-medium">
                          • {criticalCount} critical
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className={`transform transition-transform ${isCollapsed ? 'rotate-180' : ''}`}>
                  <span className="text-gray-400 text-sm">⌄</span>
                </div>
              </div>
            </div>

            {/* Section Content */}
            {!isCollapsed && (
              <div className="p-2">
                <div className="space-y-1">
                  {metrics.map(([name, data]) => {
                    const used = data.Max - data.Remaining;
                    const percentage = (used / data.Max) * 100;
                    
                    return (
                      <div key={name} className="border border-gray-200 rounded-md p-2 hover:bg-gray-50 transition-colors">
                        <div className="flex justify-between items-center mb-1">
                          <h4 className="font-medium text-gray-900 text-sm">{formatMetricName(name)}</h4>
                          <span className={`text-xs font-medium ${getUsageColor(percentage)}`}>
                            {percentage.toFixed(1)}%
                          </span>
                        </div>
                        
                        <div className="flex justify-between text-xs text-gray-600 mb-1">
                          <span>Used: {formatNumber(used)}</span>
                          <span>Available: {formatNumber(data.Remaining)}</span>
                        </div>
                        
                        <div className="w-full bg-gray-200 rounded-full h-1.5 mb-1">
                          <div 
                            className={`h-1.5 rounded-full transition-all ${getProgressBarColor(percentage)}`}
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          ></div>
                        </div>
                        
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>0</span>
                          <span>Max: {formatNumber(data.Max)}</span>
                        </div>
                        
                        {percentage > 80 && (
                          <div className="mt-1 text-xs text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                            ⚠️ High usage
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* No Results */}
      {searchTerm && Object.keys(groupedMetrics).length === 0 && (
        <div className="bg-white rounded-lg shadow-sm border p-4 text-center">
          <div className="text-gray-400 text-2xl mb-2">🔍</div>
          <h3 className="text-base font-medium text-gray-900 mb-1">No limits found</h3>
          <p className="text-gray-600 text-sm">
            Try adjusting your search term
          </p>
        </div>
      )}
    </div>
  );
};