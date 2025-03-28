import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import Employees from './Employees';
import SalaryModels from './SalaryModels';
import SalesData from './SalesData';
import SalaryDeductionsUpload from './SalaryDeductionsUpload';
import SalesDataDashboard from './SalesDataDashboard';
import Login from './components/Login'; // Import the Login component
import { OfficeManagerDashboard } from './Manager'; // Import the new Manager component
import './index.css';

// Protected route component
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

  return authenticated ? children : <Navigate to="/login" />;
};

// App component
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/sales-dashboard" />} />
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
        <Route path="/sales-dashboard" element={
          <ProtectedRoute>
            <SalesDataDashboard />
          </ProtectedRoute>
        } />
        <Route path="/manager-dashboard" element={
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
