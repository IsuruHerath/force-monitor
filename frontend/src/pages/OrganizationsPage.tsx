import React, { useState } from 'react';
import { useOrganizations } from '../contexts/OrganizationContext';
import { apiService } from '../services/apiService';
import { Button } from '../components/Button';
import { LoadingSpinner } from '../components/LoadingSpinner';

export const OrganizationsPage: React.FC = () => {
  const {
    organizations,
    isLoading,
    error,
    refreshOrganizations,
    updateOrganization,
    deleteOrganization,
    refreshOrganizationToken
  } = useOrganizations();

  const [connectingOrg, setConnectingOrg] = useState(false);
  const [orgActions, setOrgActions] = useState<{ [key: string]: boolean }>({});

  const handleConnectOrganization = async (environment: 'production' | 'sandbox') => {
    try {
      setConnectingOrg(true);
      const response = await apiService.initiateOrgConnection(environment);
      window.location.href = response.authUrl;
    } catch (error) {
      console.error('Failed to initiate org connection:', error);
      setConnectingOrg(false);
    }
  };

  const handleToggleActive = async (orgId: string, currentActive: boolean) => {
    try {
      setOrgActions(prev => ({ ...prev, [orgId]: true }));
      await updateOrganization(orgId, { isActive: !currentActive });
    } catch (error) {
      console.error('Failed to toggle organization status:', error);
    } finally {
      setOrgActions(prev => ({ ...prev, [orgId]: false }));
    }
  };

  const handleRefreshToken = async (orgId: string) => {
    try {
      setOrgActions(prev => ({ ...prev, [orgId]: true }));
      await refreshOrganizationToken(orgId);
    } catch (error) {
      console.error('Failed to refresh token:', error);
    } finally {
      setOrgActions(prev => ({ ...prev, [orgId]: false }));
    }
  };

  const handleDeleteOrganization = async (orgId: string, orgName: string) => {
    if (!window.confirm(`Are you sure you want to remove "${orgName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setOrgActions(prev => ({ ...prev, [orgId]: true }));
      await deleteOrganization(orgId);
    } catch (error) {
      console.error('Failed to delete organization:', error);
    } finally {
      setOrgActions(prev => ({ ...prev, [orgId]: false }));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Organizations</h1>
          <p className="text-gray-600">Manage your connected Salesforce organizations</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Connect New Organization */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Connect New Organization</h2>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              onClick={() => handleConnectOrganization('production')}
              disabled={connectingOrg}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold"
            >
              {connectingOrg ? 'Connecting...' : '🏢 Connect Production Org'}
            </Button>
            <Button
              onClick={() => handleConnectOrganization('sandbox')}
              disabled={connectingOrg}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold"
            >
              {connectingOrg ? 'Connecting...' : '🧪 Connect Sandbox Org'}
            </Button>
          </div>
        </div>

        {/* Organizations List */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">Connected Organizations</h2>
              <Button
                onClick={refreshOrganizations}
                disabled={isLoading}
                className="text-blue-600 hover:text-blue-700 px-4 py-2 border border-blue-200 rounded-lg hover:bg-blue-50"
              >
                {isLoading ? <LoadingSpinner /> : '🔄 Refresh'}
              </Button>
            </div>
          </div>

          {isLoading && organizations.length === 0 ? (
            <div className="p-8 text-center">
              <LoadingSpinner />
              <p className="text-gray-500 mt-2">Loading organizations...</p>
            </div>
          ) : organizations.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-gray-400 text-6xl mb-4">🏢</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Organizations Connected</h3>
              <p className="text-gray-500">Connect your first Salesforce organization to get started.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {organizations.map((org) => (
                <div key={org.id} className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{org.name}</h3>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          org.environment === 'sandbox'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {org.environment === 'sandbox' ? '🧪 Sandbox' : '🏢 Production'}
                        </span>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          org.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {org.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      
                      <div className="text-sm text-gray-500 space-y-1">
                        <p>Org ID: {org.orgId}</p>
                        <p>Instance: {org.instanceUrl}</p>
                        {org.lastSync ? (
                          <p>Last sync: {new Date(org.lastSync).toLocaleString()}</p>
                        ) : (
                          <p className="text-orange-500">Never synced</p>
                        )}
                        <p>Connected: {new Date(org.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>

                    <div className="flex space-x-2 ml-4">
                      <Button
                        onClick={() => handleToggleActive(org.id, org.isActive)}
                        disabled={orgActions[org.id]}
                        className={`px-3 py-2 text-sm rounded-lg border ${
                          org.isActive
                            ? 'border-orange-200 text-orange-600 hover:bg-orange-50'
                            : 'border-green-200 text-green-600 hover:bg-green-50'
                        }`}
                      >
                        {orgActions[org.id] ? <LoadingSpinner /> : (org.isActive ? 'Deactivate' : 'Activate')}
                      </Button>

                      <Button
                        onClick={() => handleRefreshToken(org.id)}
                        disabled={orgActions[org.id]}
                        className="px-3 py-2 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
                      >
                        {orgActions[org.id] ? <LoadingSpinner /> : '🔄 Refresh Token'}
                      </Button>

                      <Button
                        onClick={() => handleDeleteOrganization(org.id, org.name)}
                        disabled={orgActions[org.id]}
                        className="px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                      >
                        {orgActions[org.id] ? <LoadingSpinner /> : '🗑️ Remove'}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};