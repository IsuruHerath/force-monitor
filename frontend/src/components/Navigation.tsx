import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useOrganizations } from '../contexts/OrganizationContext';
import { Button } from './Button';

export const Navigation: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const { selectedOrganization } = useOrganizations();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (!isAuthenticated) {
    return null; // Only show navigation when authenticated
  }

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo and brand */}
          <div className="flex items-center space-x-4">
            <Link to="/dashboard" className="flex items-center space-x-2">
              <div className="text-2xl">⚡</div>
              <span className="text-xl font-bold text-gray-900">Force Monitor</span>
            </Link>
          </div>

          {/* Navigation links */}
          <div className="flex items-center space-x-6">
            <Link
              to="/dashboard"
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive('/dashboard')
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              📊 Dashboard
            </Link>
            
            <Link
              to="/organizations"
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive('/organizations')
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              🏢 Organizations
            </Link>

            <Link
              to="/analytics"
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive('/analytics')
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              📈 Analytics
            </Link>

            {/* Selected org indicator */}
            {selectedOrganization && (
              <div className="flex items-center space-x-2 px-3 py-1 bg-gray-100 rounded-lg">
                <span className="text-sm text-gray-600">Active:</span>
                <span className="text-sm font-medium text-gray-900">
                  {selectedOrganization.name}
                </span>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  selectedOrganization.environment === 'sandbox'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {selectedOrganization.environment === 'sandbox' ? 'Sandbox' : 'Production'}
                </span>
              </div>
            )}

            {/* User menu */}
            <div className="flex items-center space-x-3 border-l border-gray-200 pl-6">
              <div className="text-sm">
                <span className="text-gray-600">Welcome, </span>
                <span className="font-medium text-gray-900">
                  {user?.firstName || user?.email?.split('@')[0] || 'User'}
                </span>
              </div>
              
              <Button
                onClick={handleLogout}
                className="text-sm text-red-600 hover:text-red-700 px-3 py-2 border border-red-200 rounded-lg hover:bg-red-50"
              >
                🚪 Logout
              </Button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};