import React, { useState, useEffect } from 'react';
import { MetricOption } from './MetricSelector';

interface DashboardTemplate {
  id: string;
  name: string;
  description: string;
  charts: MetricOption[];
  icon: string;
}

interface DashboardTemplatesProps {
  onLoadTemplate: (charts: MetricOption[]) => void;
  currentCharts: MetricOption[];
}

export const DashboardTemplates: React.FC<DashboardTemplatesProps> = ({
  onLoadTemplate,
  currentCharts
}) => {
  const [showTemplates, setShowTemplates] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<DashboardTemplate[]>([]);

  // Load saved templates on component mount
  useEffect(() => {
    loadSavedTemplates();
  }, []);

  const loadSavedTemplates = () => {
    const saved = JSON.parse(localStorage.getItem('customDashboardTemplates') || '[]');
    setSavedTemplates(saved);
  };

  const predefinedTemplates: DashboardTemplate[] = [
    {
      id: 'admin_essentials',
      name: 'Admin Essentials',
      description: 'Key metrics every Salesforce admin should monitor',
      icon: '👨‍💼',
      charts: [
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
          key: 'bulk_batches',
          label: 'Bulk API Batches',
          category: 'Development',
          description: 'Daily bulk API batches',
          dataKey: 'DailyBulkApiBatches',
          unit: 'batches',
          color: '#10b981'
        }
      ]
    },
    {
      id: 'email_monitoring',
      name: 'Email Monitoring',
      description: 'Track all email-related limits and usage',
      icon: '📧',
      charts: [
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
        }
      ]
    },
    {
      id: 'developer_dashboard',
      name: 'Developer Dashboard',
      description: 'Development and integration focused metrics',
      icon: '👨‍💻',
      charts: [
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
        }
      ]
    },
    {
      id: 'analytics_focus',
      name: 'Analytics & Reporting',
      description: 'Monitor reporting and analytics usage',
      icon: '📊',
      charts: [
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
        }
      ]
    },
    {
      id: 'einstein_ai',
      name: 'Einstein & AI',
      description: 'Einstein and AI feature usage tracking',
      icon: '🧠',
      charts: [
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
        }
      ]
    }
  ];

  const saveCurrentAsTemplate = () => {
    if (currentCharts.length === 0) {
      alert('Add some custom charts first before saving as a template');
      return;
    }

    const name = prompt('Enter a name for this dashboard template:');
    if (name) {
      const template = {
        id: `custom_${Date.now()}`,
        name,
        description: `Custom template with ${currentCharts.length} charts`,
        icon: '⭐',
        charts: currentCharts
      };
      
      // Save to localStorage for persistence
      const saved = JSON.parse(localStorage.getItem('customDashboardTemplates') || '[]');
      localStorage.setItem('customDashboardTemplates', JSON.stringify([...saved, template]));
      
      // Refresh the saved templates list
      loadSavedTemplates();
      
      alert(`Template "${name}" saved successfully!`);
    }
  };

  const deleteSavedTemplate = (templateId: string, templateName: string) => {
    if (window.confirm(`Delete template "${templateName}"?`)) {
      const saved = JSON.parse(localStorage.getItem('customDashboardTemplates') || '[]');
      const updated = saved.filter((t: DashboardTemplate) => t.id !== templateId);
      localStorage.setItem('customDashboardTemplates', JSON.stringify(updated));
      loadSavedTemplates();
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Dashboard Templates</h3>
        <div className="space-x-2">
          <button
            onClick={saveCurrentAsTemplate}
            className="text-sm text-blue-600 hover:text-blue-700 px-3 py-1 border border-blue-200 rounded hover:bg-blue-50"
            disabled={currentCharts.length === 0}
          >
            💾 Save Current
          </button>
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className="text-sm text-gray-600 hover:text-gray-700 px-3 py-1 border border-gray-200 rounded hover:bg-gray-50"
          >
            {showTemplates ? 'Hide Templates' : `Show Templates ${savedTemplates.length > 0 ? `(${savedTemplates.length} saved)` : ''}`}
          </button>
        </div>
      </div>

      {showTemplates && (
        <div className="space-y-6">
          {/* Saved Templates Section */}
          {savedTemplates.length > 0 && (
            <div>
              <h4 className="text-md font-semibold text-gray-800 mb-3 flex items-center">
                ⭐ My Saved Templates ({savedTemplates.length})
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {savedTemplates.map(template => (
                  <div
                    key={template.id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-blue-500 hover:bg-blue-50 transition-colors relative"
                  >
                    {/* Delete button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSavedTemplate(template.id, template.name);
                      }}
                      className="absolute top-2 right-2 text-gray-400 hover:text-red-500 text-sm"
                      title="Delete template"
                    >
                      ✕
                    </button>

                    <div 
                      className="cursor-pointer"
                      onClick={() => {
                        onLoadTemplate(template.charts);
                        setShowTemplates(false);
                      }}
                    >
                      <div className="flex items-center mb-2">
                        <span className="text-2xl mr-2">{template.icon}</span>
                        <h5 className="font-medium text-gray-800">{template.name}</h5>
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                      
                      <div className="text-xs text-gray-500">
                        {template.charts.length} charts included
                      </div>
                      
                      <div className="flex flex-wrap gap-1 mt-2">
                        {template.charts.slice(0, 3).map(chart => (
                          <span
                            key={chart.key}
                            className="inline-block w-3 h-3 rounded-full"
                            style={{ backgroundColor: chart.color }}
                            title={chart.label}
                          ></span>
                        ))}
                        {template.charts.length > 3 && (
                          <span className="text-xs text-gray-400">+{template.charts.length - 3}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Predefined Templates Section */}
          <div>
            <h4 className="text-md font-semibold text-gray-800 mb-3 flex items-center">
              📋 Predefined Templates
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {predefinedTemplates.map(template => (
                <div
                  key={template.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-colors"
                  onClick={() => {
                    onLoadTemplate(template.charts);
                    setShowTemplates(false);
                  }}
                >
                  <div className="flex items-center mb-2">
                    <span className="text-2xl mr-2">{template.icon}</span>
                    <h5 className="font-medium text-gray-800">{template.name}</h5>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                  
                  <div className="text-xs text-gray-500">
                    {template.charts.length} charts included
                  </div>
                  
                  <div className="flex flex-wrap gap-1 mt-2">
                    {template.charts.slice(0, 3).map(chart => (
                      <span
                        key={chart.key}
                        className="inline-block w-3 h-3 rounded-full"
                        style={{ backgroundColor: chart.color }}
                        title={chart.label}
                      ></span>
                    ))}
                    {template.charts.length > 3 && (
                      <span className="text-xs text-gray-400">+{template.charts.length - 3}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showTemplates && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-600">
            💡 <strong>Pro tip:</strong> Start with a template, then customize by adding or removing charts to match your needs.
          </p>
        </div>
      )}
    </div>
  );
};