import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useOrganizations } from '../contexts/OrganizationContext';
import { useAuth } from '../contexts/AuthContext';
import { LoadingSpinner } from '../components/LoadingSpinner';

export const OAuthCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { connectOrganization } = useOrganizations();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [error, setError] = useState<string | null>(null);
  const [orgName, setOrgName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // Wait for auth to load before making decisions
    if (authLoading) {
      return;
    }

    if (!isAuthenticated) {
      // If user is not authenticated, redirect to login with the current URL as return path
      navigate('/login', { 
        state: { from: { pathname: '/auth/callback', search: window.location.search } }
      });
      return;
    }

    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      setStatus('error');
      setError(`OAuth error: ${error}`);
      return;
    }

    if (!code || !state) {
      setStatus('error');
      setError('Missing authorization code or state parameter');
      return;
    }

    // Check if this is a Phase 2 OAuth callback
    if (state.startsWith('phase2-')) {
      handlePhase2Callback(code, state);
    } else {
      // This might be a Phase 1 callback, redirect appropriately
      setStatus('error');
      setError('Invalid OAuth state parameter');
    }
  }, [searchParams, isAuthenticated, authLoading, navigate]);

  const handlePhase2Callback = async (code: string, state: string) => {
    try {
      // Parse the state parameter to get environment and redirect path
      const stateParts = state.split('-');
      const environment = stateParts[1] as 'production' | 'sandbox';
      
      // Prompt user for organization name
      const name = window.prompt(
        'Enter a name for this organization:',
        `My ${environment === 'sandbox' ? 'Sandbox' : 'Production'} Org`
      );

      if (!name) {
        setStatus('error');
        setError('Organization name is required');
        return;
      }

      setOrgName(name);
      
      console.log('Frontend: Connecting organization with:', { code: code.substring(0, 10) + '...', state, name });
      
      // Connect the organization
      await connectOrganization(code, state, name);
      
      setStatus('success');
      
      // Redirect to organizations page after a short delay
      setTimeout(() => {
        navigate('/organizations');
      }, 2000);
      
    } catch (error: any) {
      console.error('OAuth callback error:', error);
      setStatus('error');
      setError(error.message || 'Failed to connect organization');
    }
  };

  const renderContent = () => {
    switch (status) {
      case 'processing':
        return (
          <div className="text-center">
            <LoadingSpinner />
            <h2 className="text-2xl font-semibold text-gray-900 mt-4 mb-2">
              Connecting Organization
            </h2>
            <p className="text-gray-600">
              Please wait while we connect your Salesforce organization...
            </p>
          </div>
        );
      
      case 'success':
        return (
          <div className="text-center">
            <div className="text-green-500 text-6xl mb-4">✅</div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              Organization Connected Successfully!
            </h2>
            <p className="text-gray-600 mb-4">
              "{orgName}" has been added to your account.
            </p>
            <p className="text-sm text-gray-500">
              Redirecting to organizations page...
            </p>
          </div>
        );
      
      case 'error':
        return (
          <div className="text-center">
            <div className="text-red-500 text-6xl mb-4">❌</div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              Connection Failed
            </h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => navigate('/organizations')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold"
            >
              Back to Organizations
            </button>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        {renderContent()}
      </div>
    </div>
  );
};