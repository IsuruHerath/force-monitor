import React, { useState, useEffect } from 'react';
import { useOrganizations } from '../contexts/OrganizationContext';
import { apiService } from '../services/apiService';
import { HistoryChart } from './HistoryChart';
import { TrendAnalysis } from './TrendAnalysis';
import { LoadingSpinner } from './LoadingSpinner';
import { MetricSelector, MetricOption } from './MetricSelector';
import { CustomChart } from './CustomChart';
import { DashboardTemplates } from './DashboardTemplates';

interface HistoricalData {
  collectedAt: string;
  apiRequestsUsed?: number;
  apiRequestsMax?: number;
  dataStorageUsed?: number;
  dataStorageMax?: number;
  fileStorageUsed?: number;
  fileStorageMax?: number;
  apiUsagePercentage?: number;
  dataUsagePercentage?: number;
  fileUsagePercentage?: number;
}

interface TrendData {
  apiTrend: string;
  dataTrend: string;
  fileTrend: string;
  growthRates: {
    api: number;
    data: number;
    file: number;
  };
}

export const HistoryDashboard: React.FC = () => {
  const { selectedOrganization } = useOrganizations();
  const [historicalData, setHistoricalData] = useState<HistoricalData[]>([]);
  const [trendData, setTrendData] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<number>(30);
  const [granularity, setGranularity] = useState<'hour' | 'day' | 'week'>('day');
  
  // Custom charts state
  const [showMetricSelector, setShowMetricSelector] = useState(false);
  const [customCharts, setCustomCharts] = useState<MetricOption[]>([]);

  useEffect(() => {
    if (selectedOrganization) {
      fetchHistoricalData();
      fetchTrendData();
    }
  }, [selectedOrganization, timeRange, granularity]);

  const fetchHistoricalData = async () => {
    if (!selectedOrganization) return;

    try {
      setLoading(true);
      setError(null);

      const response = await apiService.getHistoricalData(
        selectedOrganization.id, 
        timeRange, 
        granularity
      );

      if (response.success) {
        setHistoricalData(response.data);
      } else {
        setError('Failed to fetch historical data');
      }
    } catch (err) {
      console.error('Error fetching historical data:', err);
      setError('Failed to load historical data');
    } finally {
      setLoading(false);
    }
  };

  const fetchTrendData = async () => {
    if (!selectedOrganization) return;

    try {
      const response = await apiService.getTrendAnalysis(
        selectedOrganization.id, 
        timeRange
      );

      if (response.success) {
        setTrendData(response.data);
      }
    } catch (err) {
      console.error('Error fetching trend data:', err);
    }
  };

  const triggerDataCollection = async () => {
    try {
      await apiService.triggerDataCollection();
      // Refresh data after collection
      setTimeout(() => {
        fetchHistoricalData();
        fetchTrendData();
      }, 2000);
    } catch (err) {
      console.error('Error triggering data collection:', err);
    }
  };

  if (!selectedOrganization) {
    return (
      <div className="bg-white p-8 rounded-lg shadow-lg text-center">
        <h2 className="text-xl font-semibold text-gray-800 mb-2">No Organization Selected</h2>
        <p className="text-gray-600">Please select an organization to view historical data.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white p-8 rounded-lg shadow-lg">
        <LoadingSpinner />
        <p className="text-center text-gray-600 mt-4">Loading historical data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white p-8 rounded-lg shadow-lg text-center">
        <h2 className="text-xl font-semibold text-red-600 mb-2">Error</h2>
        <p className="text-gray-600 mb-4">{error}</p>
        <button
          onClick={fetchHistoricalData}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    );
  }

  if (historicalData.length === 0) {
    return (
      <div className="bg-white p-8 rounded-lg shadow-lg text-center">
        <h2 className="text-xl font-semibold text-gray-800 mb-2">No Historical Data</h2>
        <p className="text-gray-600 mb-4">
          No historical data is available for this organization yet. 
          Data collection happens automatically every hour.
        </p>
        <button
          onClick={triggerDataCollection}
          className="bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600"
        >
          Trigger Data Collection
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-white p-4 rounded-lg shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-gray-800">
            Historical Analytics - {selectedOrganization.name}
          </h1>
          
          <div className="flex flex-wrap items-center gap-4">
            {/* Time Range Selector */}
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Time Range:</label>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(Number(e.target.value))}
                className="border border-gray-300 rounded px-3 py-1 text-sm"
              >
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
              </select>
            </div>

            {/* Granularity Selector */}
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Granularity:</label>
              <select
                value={granularity}
                onChange={(e) => setGranularity(e.target.value as 'hour' | 'day' | 'week')}
                className="border border-gray-300 rounded px-3 py-1 text-sm"
              >
                <option value="hour">Hourly</option>
                <option value="day">Daily</option>
                <option value="week">Weekly</option>
              </select>
            </div>

            {/* Manual Collection Button */}
            <button
              onClick={triggerDataCollection}
              className="bg-blue-500 text-white px-4 py-2 rounded text-sm hover:bg-blue-600"
            >
              Collect Now
            </button>

            {/* Add Custom Chart Button */}
            <button
              onClick={() => setShowMetricSelector(!showMetricSelector)}
              className="bg-green-500 text-white px-4 py-2 rounded text-sm hover:bg-green-600"
            >
              {showMetricSelector ? 'Hide Metrics' : '+ Add Chart'}
            </button>
          </div>
        </div>
      </div>

      {/* Custom Chart Selector */}
      {showMetricSelector && (
        <MetricSelector
          onMetricSelect={(metric) => {
            setCustomCharts(prev => [...prev, metric]);
            setShowMetricSelector(false);
          }}
          selectedMetrics={customCharts}
        />
      )}

      {/* Dashboard Templates */}
      <DashboardTemplates
        onLoadTemplate={(charts) => setCustomCharts(charts)}
        currentCharts={customCharts}
      />

      {/* Trend Analysis */}
      {trendData && <TrendAnalysis trends={trendData} />}

      {/* Historical Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* API Usage Chart */}
        <HistoryChart
          data={historicalData}
          title="API Usage Over Time"
          dataKey="apiUsagePercentage"
          color="#8b5cf6"
          thresholds={{ warning: 80, critical: 95 }}
        />

        {/* Data Storage Chart */}
        <HistoryChart
          data={historicalData}
          title="Data Storage Usage Over Time"
          dataKey="dataUsagePercentage"
          color="#06b6d4"
          thresholds={{ warning: 80, critical: 95 }}
        />

        {/* File Storage Chart */}
        <HistoryChart
          data={historicalData}
          title="File Storage Usage Over Time"
          dataKey="fileUsagePercentage"
          color="#10b981"
          thresholds={{ warning: 80, critical: 95 }}
        />

        {/* API Requests Absolute Numbers */}
        <HistoryChart
          data={historicalData}
          title="API Requests (Absolute)"
          dataKey="apiRequestsUsed"
          color="#f59e0b"
        />
      </div>

      {/* Custom Charts */}
      {customCharts.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-gray-800">Custom Charts</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {customCharts.map((metric, index) => (
              <CustomChart
                key={`${metric.key}-${index}`}
                data={historicalData}
                metric={metric}
                onRemove={() => {
                  setCustomCharts(prev => prev.filter((_, i) => i !== index));
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Data Summary */}
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Data Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div className="p-4 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">
              {historicalData.length}
            </div>
            <div className="text-sm text-gray-600">Data Points Collected</div>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {timeRange}
            </div>
            <div className="text-sm text-gray-600">Days of History</div>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {historicalData.length > 0 ? 
                new Date(historicalData[historicalData.length - 1].collectedAt).toLocaleDateString() : 
                'N/A'
              }
            </div>
            <div className="text-sm text-gray-600">Last Collection</div>
          </div>
        </div>
      </div>
    </div>
  );
};