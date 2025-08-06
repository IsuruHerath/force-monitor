import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { SummaryDashboard } from '../components/SummaryDashboard';
import { CategorizedLimits } from '../components/CategorizedLimits';
import { TableView } from '../components/TableView';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { OrganizationSelector } from '../components/OrganizationSelector';
import { Navigation } from '../components/Navigation';
import { apiService } from '../services/apiService';
import { OrgLimits } from '../types/salesforce';
import { useAuth } from '../contexts/AuthContext';
import { useOrganizations } from '../contexts/OrganizationContext';

export const Dashboard: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [limits, setLimits] = useState<OrgLimits | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<'categorized' | 'table'>('table');

  const { isAuthenticated, user, logout } = useAuth();
  const { selectedOrganization, organizations } = useOrganizations();
  const sessionId = searchParams.get('session');

  // Determine if this is Phase 1 (session-based) or Phase 2 (authenticated) access
  const isPhase1Access = !isAuthenticated && sessionId;
  const isPhase2Access = isAuthenticated && selectedOrganization;

  const fetchLimits = React.useCallback(async () => {
    try {
      setLoading(true);
      let data;
      
      if (isPhase2Access) {
        // Phase 2: Use organization ID
        data = await apiService.getOrganizationLimits(selectedOrganization.id);
      } else if (isPhase1Access) {
        // Phase 1: Use session ID (backwards compatibility)
        data = await apiService.getOrgLimits(sessionId!);
      } else {
        throw new Error('No valid access method available');
      }
      
      setLimits(data);
      setLastUpdated(new Date());
      setError(null);
    } catch (err: any) {
      if (isPhase1Access) {
        setError('Failed to fetch org limits. Session may have expired.');
      } else {
        setError('Failed to fetch org limits. Please check your organization connection.');
      }
      console.error('Error fetching limits:', err);
    } finally {
      setLoading(false);
    }
  }, [isPhase1Access, isPhase2Access, sessionId, selectedOrganization]);

  useEffect(() => {
    if (!isPhase1Access && !isPhase2Access) {
      if (isAuthenticated && organizations.length === 0) {
        setError('No organizations connected. Please connect a Salesforce organization first.');
      } else if (!isAuthenticated && !sessionId) {
        setError('No session found. Please connect to Salesforce again.');
      } else if (isAuthenticated && !selectedOrganization) {
        setError('No organization selected. Please select an organization to view limits.');
      }
      setLoading(false);
      return;
    }

    fetchLimits();
    // Refresh every 5 minutes
    const interval = setInterval(fetchLimits, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [isPhase1Access, isPhase2Access, fetchLimits, isAuthenticated, organizations.length, selectedOrganization, sessionId]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">
            {isAuthenticated ? 'Organization Error' : 'Session Error'}
          </h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="space-x-4">
            {isAuthenticated ? (
              <Link 
                to="/organizations"
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
              >
                Manage Organizations
              </Link>
            ) : (
              <>
                <a 
                  href="/" 
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
                >
                  Connect Again
                </a>
                <Link
                  to="/login"
                  className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 ml-4"
                >
                  Sign In
                </Link>
              </>
            )}
          </div>
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
      {/* Show navigation only for authenticated users */}
      {isAuthenticated && <Navigation />}
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {isPhase1Access ? 'Salesforce Org Limits' : 'Dashboard'}
          </h1>
          <p className="text-gray-600">
            {isPhase1Access 
              ? 'View your organization limits and usage'
              : selectedOrganization 
                ? `Monitoring ${selectedOrganization.name}`
                : 'Select an organization to view limits'
            }
          </p>
        </div>

        {/* Organization Selector for Phase 2 */}
        {isPhase2Access && (
          <div className="mb-6">
            <OrganizationSelector />
          </div>
        )}

        {/* Dashboard Controls */}
        <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
            <div className="flex items-center space-x-4">
              {lastUpdated && (
                <span className="text-sm text-gray-500">
                  Last updated: {lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </div>
            
            <div className="flex items-center space-x-4">
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

        {/* Main Dashboard Content */}
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
      </div>
    </div>
  );
};