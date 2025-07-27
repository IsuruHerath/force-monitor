import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SummaryDashboard } from '../components/SummaryDashboard';
import { CategorizedLimits } from '../components/CategorizedLimits';
import { TableView } from '../components/TableView';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { apiService } from '../services/apiService';
import { OrgLimits } from '../types/salesforce';

export const Dashboard: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [limits, setLimits] = useState<OrgLimits | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<'categorized' | 'table'>('table');

  const sessionId = searchParams.get('session');

  const fetchLimits = React.useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiService.getOrgLimits(sessionId!);
      setLimits(data);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError('Failed to fetch org limits. Session may have expired.');
      console.error('Error fetching limits:', err);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) {
      setError('No session found. Please connect to Salesforce again.');
      setLoading(false);
      return;
    }

    fetchLimits();
    // Refresh every 5 minutes
    const interval = setInterval(fetchLimits, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [sessionId, fetchLimits]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Session Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <a 
            href="/" 
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
          >
            Connect Again
          </a>
        </div>
      </div>
    );
  }

  if (loading && !limits) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">
              Salesforce Org Limits
            </h1>
            <div className="flex items-center space-x-4">
              {lastUpdated && (
                <span className="text-sm text-gray-500">
                  Last updated: {lastUpdated.toLocaleTimeString()}
                </span>
              )}
              
              {/* View Toggle */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('table')}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                    viewMode === 'table' 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  📋 Table
                </button>
                <button
                  onClick={() => setViewMode('categorized')}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                    viewMode === 'categorized' 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  📊 Categories
                </button>
              </div>
              
              <button
                onClick={fetchLimits}
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {limits && (
          <>
            <SummaryDashboard limits={limits} />
            {viewMode === 'categorized' ? (
              <CategorizedLimits limits={limits} />
            ) : (
              <TableView limits={limits} />
            )}
          </>
        )}
      </main>
    </div>
  );
};