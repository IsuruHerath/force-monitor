import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { OrganizationProvider } from './contexts/OrganizationContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { Dashboard } from './pages/Dashboard';
import { OrganizationsPage } from './pages/OrganizationsPage';
import { OAuthCallbackPage } from './pages/OAuthCallbackPage';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <OrganizationProvider>
        <Router>
          <div className="App">
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/auth/callback" element={<OAuthCallbackPage />} />
              
              {/* Dashboard supports both authenticated and session-based access */}
              <Route path="/dashboard" element={<Dashboard />} />
              
              {/* Protected routes (require authentication) */}
              <Route path="/organizations" element={
                <ProtectedRoute>
                  <OrganizationsPage />
                </ProtectedRoute>
              } />
            </Routes>
          </div>
        </Router>
      </OrganizationProvider>
    </AuthProvider>
  );
}

export default App;
