import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { OrganizationProvider } from './contexts/OrganizationContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { Dashboard } from './pages/Dashboard';
import { OrganizationsPage } from './pages/OrganizationsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { OAuthCallbackPage } from './pages/OAuthCallbackPage';
import { Navigation } from './components/Navigation';
import './App.css';

// Component to conditionally render Navigation based on route
const AppContent = () => {
  const location = useLocation();
  
  // Routes that should NOT show navigation
  const noNavigationRoutes = ['/', '/login', '/register', '/auth/callback'];
  const shouldShowNavigation = !noNavigationRoutes.includes(location.pathname);

  return (
    <div className="App">
      {shouldShowNavigation && <Navigation />}
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
        
        <Route path="/analytics" element={
          <ProtectedRoute>
            <AnalyticsPage />
          </ProtectedRoute>
        } />
      </Routes>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <OrganizationProvider>
        <Router>
          <AppContent />
        </Router>
      </OrganizationProvider>
    </AuthProvider>
  );
}

export default App;
