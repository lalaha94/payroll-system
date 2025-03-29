import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import Layout from './components/Layout'; // Import the Layout component
import Employees from './Employees';
import SalaryModels from './SalaryModels';
import SalesData from './SalesData';
import SalaryDeductionsUpload from './SalaryDeductionsUpload';
import SalesDataDashboard from './admin'; // Import from admin directory
import AccountingExport from './AccountingExport';
import Login from './components/Login'; // Import the Login component
import { OfficeManagerDashboard } from './Manager'; // Import the Manager component
import './index.css';
import LandingPage from './LandingPage';

// Protected route component with Layout wrapper
const ProtectedRoute = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      setLoading(true);
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Error checking auth state:', error);
      }
      
      if (data?.session) {
        setAuthenticated(true);
      } else {
        navigate('/login');
      }
      
      setLoading(false);
    };

    checkAuth();
  }, [navigate]);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div className="loader"></div>
        <p>Laster inn...</p>
      </div>
    );
  }

  // Wrap authenticated routes with Layout component
  return authenticated ? <Layout>{children}</Layout> : <Navigate to="/login" />;
};

// App component
function App() {
  return (
    <Router>
      <Routes>
        {/* Public routes - no authentication required */}
        <Route path="/landingpage" element={<LandingPage />} />
        <Route path="/Landingpage" element={<Navigate to="/landingpage" />} />
        
        {/* Login page doesn't use Layout since it has its own design */}
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/sales-dashboard" />} />
        
        {/* Protected routes all wrapped with Layout through ProtectedRoute */}
        <Route path="/employees" element={
          <ProtectedRoute>
            <Employees />
          </ProtectedRoute>
        } />
        <Route path="/salary-models" element={
          <ProtectedRoute>
            <SalaryModels />
          </ProtectedRoute>
        } />
        <Route path="/sales-data" element={
          <ProtectedRoute>
            <SalesData />
          </ProtectedRoute>
        } />
        <Route path="/salary-deductions" element={
          <ProtectedRoute>
            <SalaryDeductionsUpload />
          </ProtectedRoute>
        } />
        <Route path="/accounting-export" element={
          <ProtectedRoute>
            <AccountingExport />
          </ProtectedRoute>
        } />
        <Route path="/sales-dashboard" element={
          <ProtectedRoute>
            <SalesDataDashboard />
          </ProtectedRoute>
        } />
        <Route path="/office-dashboard" element={
          <ProtectedRoute>
            <OfficeManagerDashboard />
          </ProtectedRoute>
        } />
      </Routes>
    </Router>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
