import React, { useState } from 'react';
import { useOrganizations } from '../contexts/OrganizationContext';
import { LoadingSpinner } from './LoadingSpinner';

export const OrganizationSelector: React.FC = () => {
  const {
    organizations,
    selectedOrganization,
    selectOrganization,
    isLoading
  } = useOrganizations();
  
  const [isOpen, setIsOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center space-x-2">
        <LoadingSpinner />
        <span className="text-sm text-gray-500">Loading organizations...</span>
      </div>
    );
  }

  if (organizations.length === 0) {
    return (
      <div className="text-sm text-gray-500">
        No organizations connected
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 bg-white border border-gray-300 rounded-lg px-4 py-2 text-left hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <div className="flex-1">
          {selectedOrganization ? (
            <div>
              <div className="font-medium text-gray-900">
                {selectedOrganization.name}
              </div>
              <div className="text-xs text-gray-500">
                {selectedOrganization.environment === 'sandbox' ? '🧪 Sandbox' : '🏢 Production'}
              </div>
            </div>
          ) : (
            <span className="text-gray-500">Select organization</span>
          )}
        </div>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
          <div className="max-h-60 overflow-y-auto">
            {organizations.map((org) => (
              <button
                key={org.id}
                onClick={() => {
                  selectOrganization(org);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${
                  selectedOrganization?.id === org.id ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">{org.name}</div>
                    <div className="text-xs text-gray-500 flex items-center space-x-2">
                      <span>
                        {org.environment === 'sandbox' ? '🧪 Sandbox' : '🏢 Production'}
                      </span>
                      {!org.isActive && (
                        <span className="text-orange-500">• Inactive</span>
                      )}
                      {org.lastSync && (
                        <span>
                          • Last sync: {new Date(org.lastSync).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                  </div>
                  {selectedOrganization?.id === org.id && (
                    <div className="text-blue-600">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};