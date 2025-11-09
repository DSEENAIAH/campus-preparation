import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './context/AWSAuthContext';

const ProtectedRoute = ({ children, requireAdmin = false, requireAuth = true }) => {
  const { user, admin, loading, isAuthenticated, isAdmin } = useAuth();
  

  
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#ffffff'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid #e5e7eb',
          borderTop: '3px solid #3b82f6',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
      </div>
    );
  }

  // If authentication is required but user is not authenticated
  if (requireAuth && !isAuthenticated) {

    return <Navigate to="/login" replace />;
  }

  // If admin access is required but user is not admin
  if (requireAdmin && !isAdmin) {

    return <Navigate to="/dashboard" replace />;
  }

  // If user is admin but trying to access student routes
  if (isAdmin && !requireAdmin && window.location.pathname !== '/admin/dashboard') {

    return <Navigate to="/admin/dashboard" replace />;
  }


  return children;
};

export default ProtectedRoute;