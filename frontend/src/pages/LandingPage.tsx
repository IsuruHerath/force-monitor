import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/Button';
import { apiService } from '../services/apiService';
import { useAuth } from '../contexts/AuthContext';

export const LandingPage: React.FC = () => {
  const { isAuthenticated } = useAuth();

  const handleConnectToSalesforce = async (environment: 'production' | 'sandbox') => {
    try {
      const response = await apiService.initiateOAuth(environment);
      window.location.href = response.authUrl;
    } catch (error) {
      console.error('Failed to initiate OAuth:', error);
    }
  };

  // If user is already authenticated, redirect them to dashboard
  React.useEffect(() => {
    if (isAuthenticated) {
      window.location.href = '/dashboard';
    }
  }, [isAuthenticated]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Monitor Your Salesforce Org Limits
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Get instant insights into your Salesforce org's API limits, storage usage, 
            and other critical metrics with session-based access or create an account for multi-org management.
          </p>
          
          <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
            <h2 className="text-2xl font-semibold mb-4">Free Access Includes:</h2>
            <div className="grid md:grid-cols-3 gap-6 text-left">
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                <div>
                  <h3 className="font-semibold">Real-time Monitoring</h3>
                  <p className="text-gray-600">Live view of all org limits</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                <div>
                  <h3 className="font-semibold">No Setup Required</h3>
                  <p className="text-gray-600">Connect with OAuth in seconds</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                <div>
                  <h3 className="font-semibold">Secure Access</h3>
                  <p className="text-gray-600">4-hour temporary sessions</p>
                </div>
              </div>
            </div>
          </div>

          {/* Phase 2 - Account-based Access */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">🔗 Multi-Organization Management</h3>
            <p className="text-gray-600 mb-6">
              Create an account to connect and manage multiple Salesforce organizations with persistent access.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/register"
                className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-4 text-lg font-semibold rounded-lg text-center"
              >
                Create Account - Free
              </Link>
              <Link
                to="/login"
                className="bg-gray-600 hover:bg-gray-700 text-white px-8 py-4 text-lg font-semibold rounded-lg text-center"
              >
                Sign In
              </Link>
            </div>
          </div>

          <div className="border-t pt-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">⚡ Quick Session Access</h3>
            <p className="text-gray-600 mb-6">
              Try it out with temporary session-based access. No registration required.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                onClick={() => handleConnectToSalesforce('production')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 text-lg font-semibold rounded-lg"
              >
                Connect to Production
              </Button>
              <Button 
                onClick={() => handleConnectToSalesforce('sandbox')}
                className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 text-lg font-semibold rounded-lg"
              >
                Connect to Sandbox
              </Button>
            </div>
            
            <p className="text-sm text-gray-500 mt-4">
              Session expires in 4 hours. No data is permanently stored.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};