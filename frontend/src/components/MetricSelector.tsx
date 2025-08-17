import React, { useState, useMemo } from 'react';

export interface MetricOption {
  key: string;
  label: string;
  category: string;
  description: string;
  dataKey: string;
  unit: string;
  color: string;
}

interface MetricSelectorProps {
  onMetricSelect: (metric: MetricOption) => void;
  selectedMetrics: MetricOption[];
}

export const MetricSelector: React.FC<MetricSelectorProps> = ({
  onMetricSelect,
  selectedMetrics
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const availableMetrics: MetricOption[] = [
    // Core Limits (already displayed by default)
    {
      key: 'api_requests',
      label: 'API Requests',
      category: 'Core',
      description: 'Daily API request usage',
      dataKey: 'apiUsagePercentage',
      unit: '%',
      color: '#8b5cf6'
    },
    {
      key: 'data_storage',
      label: 'Data Storage',
      category: 'Core',
      description: 'Organization data storage usage',
      dataKey: 'dataUsagePercentage',
      unit: '%',
      color: '#06b6d4'
    },
    {
      key: 'file_storage',
      label: 'File Storage',
      category: 'Core',
      description: 'File and attachment storage usage',
      dataKey: 'fileUsagePercentage',
      unit: '%',
      color: '#10b981'
    },

    // Email Limits
    {
      key: 'mass_email',
      label: 'Mass Email',
      category: 'Email',
      description: 'Daily mass email sends',
      dataKey: 'MassEmail',
      unit: 'emails',
      color: '#f59e0b'
    },
    {
      key: 'single_email',
      label: 'Single Email',
      category: 'Email',
      description: 'Daily single email sends',
      dataKey: 'SingleEmail',
      unit: 'emails',
      color: '#ef4444'
    },
    {
      key: 'workflow_emails',
      label: 'Workflow Emails',
      category: 'Email',
      description: 'Daily workflow email sends',
      dataKey: 'DailyWorkflowEmails',
      unit: 'emails',
      color: '#8b5cf6'
    },

    // Platform Events & Streaming
    {
      key: 'streaming_events',
      label: 'Streaming API Events',
      category: 'Streaming',
      description: 'Daily streaming API events',
      dataKey: 'DailyStreamingApiEvents',
      unit: 'events',
      color: '#06b6d4'
    },
    {
      key: 'platform_events',
      label: 'Platform Events',
      category: 'Streaming',
      description: 'Hourly published platform events',
      dataKey: 'HourlyPublishedPlatformEvents',
      unit: 'events',
      color: '#10b981'
    },
    {
      key: 'durable_streaming',
      label: 'Durable Streaming Events',
      category: 'Streaming',
      description: 'Daily durable streaming API events',
      dataKey: 'DailyDurableStreamingApiEvents',
      unit: 'events',
      color: '#f59e0b'
    },

    // Analytics & Reports
    {
      key: 'dashboard_results',
      label: 'Dashboard Results',
      category: 'Analytics',
      description: 'Hourly dashboard results',
      dataKey: 'HourlyDashboardResults',
      unit: 'results',
      color: '#ef4444'
    },
    {
      key: 'async_reports',
      label: 'Async Report Runs',
      category: 'Analytics',
      description: 'Hourly async report runs',
      dataKey: 'HourlyAsyncReportRuns',
      unit: 'runs',
      color: '#8b5cf6'
    },
    {
      key: 'sync_reports',
      label: 'Sync Report Runs',
      category: 'Analytics',
      description: 'Hourly sync report runs',
      dataKey: 'HourlySyncReportRuns',
      unit: 'runs',
      color: '#06b6d4'
    },

    // Development & API
    {
      key: 'bulk_batches',
      label: 'Bulk API Batches',
      category: 'Development',
      description: 'Daily bulk API batches',
      dataKey: 'DailyBulkApiBatches',
      unit: 'batches',
      color: '#10b981'
    },
    {
      key: 'async_apex',
      label: 'Async Apex Executions',
      category: 'Development',
      description: 'Daily async Apex executions',
      dataKey: 'DailyAsyncApexExecutions',
      unit: 'executions',
      color: '#f59e0b'
    },
    {
      key: 'functions_api',
      label: 'Functions API Calls',
      category: 'Development',
      description: 'Daily Functions API calls',
      dataKey: 'DailyFunctionsApiCallLimit',
      unit: 'calls',
      color: '#ef4444'
    },

    // Einstein & AI
    {
      key: 'einstein_discovery',
      label: 'Einstein Discovery Stories',
      category: 'Einstein',
      description: 'Daily Einstein Discovery story creation',
      dataKey: 'DailyEinsteinDiscoveryStoryCreation',
      unit: 'stories',
      color: '#8b5cf6'
    },
    {
      key: 'einstein_predictions',
      label: 'Einstein Predict API',
      category: 'Einstein',
      description: 'Daily Einstein Discovery predict API calls',
      dataKey: 'DailyEinsteinDiscoveryPredictAPICalls',
      unit: 'predictions',
      color: '#06b6d4'
    },
    {
      key: 'data_insights',
      label: 'Data Insights Stories',
      category: 'Einstein',
      description: 'Daily Einstein Data Insights story creation',
      dataKey: 'DailyEinsteinDataInsightsStoryCreation',
      unit: 'stories',
      color: '#10b981'
    },

    // Advanced Limits
    {
      key: 'permission_sets',
      label: 'Permission Sets',
      category: 'Advanced',
      description: 'Permission sets limit',
      dataKey: 'PermissionSets',
      unit: 'sets',
      color: '#f59e0b'
    },
    {
      key: 'content_documents',
      label: 'Content Documents',
      category: 'Advanced',
      description: 'Maximum content documents',
      dataKey: 'MaxContentDocumentsLimit',
      unit: 'documents',
      color: '#ef4444'
    },
    {
      key: 'package_versions',
      label: 'Package Version Creates',
      category: 'Advanced',
      description: 'Package2 version creates',
      dataKey: 'Package2VersionCreates',
      unit: 'versions',
      color: '#8b5cf6'
    }
  ];

  const categories = ['all', ...Array.from(new Set(availableMetrics.map(m => m.category)))];

  const filteredMetrics = useMemo(() => {
    return availableMetrics.filter(metric => {
      const matchesSearch = metric.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           metric.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || metric.category === selectedCategory;
      const notAlreadySelected = !selectedMetrics.some(selected => selected.key === metric.key);
      
      return matchesSearch && matchesCategory && notAlreadySelected;
    });
  }, [searchTerm, selectedCategory, selectedMetrics, availableMetrics]);

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Add Custom Chart</h3>
      
      {/* Search and Filter Controls */}
      <div className="flex flex-wrap gap-4 mb-4">
        <div className="flex-1 min-w-48">
          <input
            type="text"
            placeholder="Search metrics..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          {categories.map(category => (
            <option key={category} value={category}>
              {category === 'all' ? 'All Categories' : category}
            </option>
          ))}
        </select>
      </div>

      {/* Metrics List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
        {filteredMetrics.map(metric => (
          <div
            key={metric.key}
            onClick={() => onMetricSelect(metric)}
            className="p-3 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <span 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: metric.color }}
              ></span>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                {metric.category}
              </span>
            </div>
            
            <div className="font-medium text-gray-800 mb-1">
              {metric.label}
            </div>
            
            <div className="text-sm text-gray-600">
              {metric.description}
            </div>
            
            <div className="text-xs text-gray-500 mt-2">
              Unit: {metric.unit}
            </div>
          </div>
        ))}
      </div>

      {filteredMetrics.length === 0 && (
        <div className="text-center text-gray-500 py-8">
          No metrics found. Try adjusting your search or category filter.
        </div>
      )}
    </div>
  );
};