import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiService } from '../services/apiService';
import { useAuth } from './AuthContext';

interface Organization {
  id: string;
  name: string;
  orgId: string;
  instanceUrl: string;
  environment: 'production' | 'sandbox';
  isActive: boolean;
  lastSync: string | null;
  createdAt: string;
}

interface OrganizationContextType {
  organizations: Organization[];
  selectedOrganization: Organization | null;
  isLoading: boolean;
  error: string | null;
  refreshOrganizations: () => Promise<void>;
  selectOrganization: (org: Organization | null) => void;
  connectOrganization: (code: string, state: string, name: string) => Promise<void>;
  updateOrganization: (orgId: string, data: { name?: string; isActive?: boolean }) => Promise<void>;
  deleteOrganization: (orgId: string) => Promise<void>;
  refreshOrganizationToken: (orgId: string) => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export const OrganizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      refreshOrganizations();
    } else if (!isAuthenticated) {
      setOrganizations([]);
      setSelectedOrganization(null);
    }
  }, [isAuthenticated, authLoading]);

  // Auto-select first organization if none selected
  useEffect(() => {
    if (organizations.length > 0 && !selectedOrganization) {
      const activeOrg = organizations.find(org => org.isActive) || organizations[0];
      setSelectedOrganization(activeOrg);
    }
  }, [organizations, selectedOrganization]);

  const refreshOrganizations = async () => {
    if (!isAuthenticated) return;
    
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiService.getOrganizations();
      setOrganizations(response.organizations);
    } catch (error: any) {
      console.error('Failed to fetch organizations:', error);
      setError(error.response?.data?.error || 'Failed to fetch organizations');
    } finally {
      setIsLoading(false);
    }
  };

  const selectOrganization = (org: Organization | null) => {
    setSelectedOrganization(org);
  };

  const connectOrganization = async (code: string, state: string, name: string) => {
    try {
      setError(null);
      console.log('Frontend: Calling connectOrganization API with:', {
        codeLength: code.length,
        codePrefix: code.substring(0, 10) + '...',
        state,
        name,
        timestamp: new Date().toISOString()
      });
      
      const response = await apiService.connectOrganization(code, state, name);
      await refreshOrganizations();
      return response;
    } catch (error: any) {
      console.error('Frontend: Connect organization error:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      const errorMessage = error.response?.data?.error || 'Failed to connect organization';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const updateOrganization = async (orgId: string, data: { name?: string; isActive?: boolean }) => {
    try {
      setError(null);
      const response = await apiService.updateOrganization(orgId, data);
      await refreshOrganizations();
      
      // Update selected organization if it was the one being updated
      if (selectedOrganization?.id === orgId) {
        const updatedOrg = organizations.find(org => org.id === orgId);
        if (updatedOrg) {
          setSelectedOrganization(updatedOrg);
        }
      }
      
      return response;
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to update organization';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const deleteOrganization = async (orgId: string) => {
    try {
      setError(null);
      await apiService.deleteOrganization(orgId);
      
      // Clear selected organization if it was deleted
      if (selectedOrganization?.id === orgId) {
        setSelectedOrganization(null);
      }
      
      await refreshOrganizations();
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to delete organization';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const refreshOrganizationToken = async (orgId: string) => {
    try {
      setError(null);
      await apiService.refreshOrganizationToken(orgId);
      await refreshOrganizations();
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to refresh organization token';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const value: OrganizationContextType = {
    organizations,
    selectedOrganization,
    isLoading,
    error,
    refreshOrganizations,
    selectOrganization,
    connectOrganization,
    updateOrganization,
    deleteOrganization,
    refreshOrganizationToken
  };

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganizations = () => {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganizations must be used within an OrganizationProvider');
  }
  return context;
};