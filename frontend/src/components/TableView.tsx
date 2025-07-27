import React, { useState } from 'react';
import { OrgLimits } from '../types/salesforce';

interface TableViewProps {
  limits: OrgLimits;
}

export const TableView: React.FC<TableViewProps> = ({ limits }) => {
  const [sortBy, setSortBy] = useState<'name' | 'usage' | 'remaining'>('usage');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchTerm, setSearchTerm] = useState('');

  const formatMetricName = (name: string) => {
    return name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const getUsageColor = (percentage: number) => {
    if (percentage > 80) return 'text-red-600 bg-red-50';
    if (percentage > 60) return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  };

  const handleSort = (column: 'name' | 'usage' | 'remaining') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  // Multi-word search function
  const matchesSearch = (name: string, searchTerm: string) => {
    if (!searchTerm) return true;
    
    const searchWords = searchTerm.toLowerCase().split(/\s+/).filter(word => word.length > 0);
    const searchableText = formatMetricName(name).toLowerCase();
    
    return searchWords.every(word => searchableText.includes(word));
  };

  // Filter and sort data
  const processedData = Object.entries(limits)
    .filter(([name]) => matchesSearch(name, searchTerm))
    .map(([name, data]) => {
      const used = data.Max - data.Remaining;
      const usage = data.Max === 0 ? 0 : (used / data.Max) * 100;
      
      return {
        name,
        data,
        usage,
        used
      };
    })
    .filter(({ data }) => data.Max > 0) // Filter out invalid limits with Max = 0
    .sort((a, b) => {
      let aVal, bVal;
      switch (sortBy) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'usage':
          aVal = a.usage;
          bVal = b.usage;
          break;
        case 'remaining':
          aVal = a.data.Remaining;
          bVal = b.data.Remaining;
          break;
        default:
          return 0;
      }
      
      if (sortOrder === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });

  const getSortIcon = (column: string) => {
    if (sortBy !== column) return '↕️';
    return sortOrder === 'asc' ? '↗️' : '↘️';
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* Search and Controls */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              placeholder="Search limits..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-400">🔍</span>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            {processedData.length} of {Object.keys(limits).length} limits
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center space-x-1">
                  <span>Limit Name</span>
                  <span className="text-sm">{getSortIcon('name')}</span>
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('usage')}
              >
                <div className="flex items-center space-x-1">
                  <span>Usage %</span>
                  <span className="text-sm">{getSortIcon('usage')}</span>
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Used
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('remaining')}
              >
                <div className="flex items-center space-x-1">
                  <span>Remaining</span>
                  <span className="text-sm">{getSortIcon('remaining')}</span>
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Maximum
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Progress
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {processedData.map(({ name, data, usage, used }) => (
              <tr key={name} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {formatMetricName(name)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getUsageColor(usage)}`}>
                    {usage.toFixed(1)}%
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatNumber(used)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatNumber(data.Remaining)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatNumber(data.Max)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        usage > 80 ? 'bg-red-500' : 
                        usage > 60 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(usage, 100)}%` }}
                    ></div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* No Results */}
      {processedData.length === 0 && (
        <div className="p-8 text-center">
          <div className="text-gray-400 text-4xl mb-4">🔍</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No limits found</h3>
          <p className="text-gray-600">
            Try adjusting your search term
          </p>
        </div>
      )}
    </div>
  );
};