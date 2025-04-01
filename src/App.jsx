import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import Layout from './components/Layout';
import Employees from './Employees';
import SalaryModels from './SalaryModels';
import SalesData from './SalesData';
import SalaryDeductionsUpload from './SalaryDeductionsUpload';
import AccountingExport from './AccountingExport';
import Login from './components/Login';
import { OfficeManagerDashboard } from './Manager';
import './index.css';

// Import SalesDataDashboard directly - handle it properly to avoid circular imports
import SalesDataDashboard from './Admin/SalesDataDashboard';
import AgentDashboard from './Agent/components/AgentDashboard'; // Import the AgentDashboard component
import ProtectedRoute from './routes/ProtectedRoute'; // Import the external ProtectedRoute component
import ErrorBoundary from './components/common/ErrorBoundary'; // Import the external ErrorBoundary

// App component with better error handling
const App = () => {
  console.log("Rendering App component");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Check if Supabase is properly configured
    const checkSupabase = async () => {
      try {
        const { data, error } = await supabase.from('salary_models').select('id').limit(1);
        
        if (error) {
          throw new Error(`Supabase query failed: ${error.message}`);
        }
        
        console.log('Supabase connection is working');
        setIsLoading(false);
      } catch (err) {
        console.error("Supabase connection error:", err);
        setError(err.message);
        setIsLoading(false);
      }
    };
    
    checkSupabase();
  }, []);

  if (isLoading) {
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
        <p>Initialiserer app...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        padding: '20px',
        textAlign: 'center'
      }}>
        <h2>Det oppstod en feil</h2>
        <p>{error}</p>
        <p>Sjekk at Supabase er riktig konfigurert.</p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          {/* Public routes that don't require authentication */}
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Navigate to="/login" />} /> {/* Send to login first, then proper redirect */}
          <Route path="/test" element={<h1>Test Route Works</h1>} />
          
          {/* Protected routes with role-based access control */}
          <Route path="/employees" element={
            <ProtectedRoute allowedRoles={['admin', 'manager']}>
              <Employees key="employees-component" />
            </ProtectedRoute>
          } />
          
          {/* Admin routes */}
          <Route path="/sales-dashboard" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <SalesDataDashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/salary-models" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <SalaryModels />
            </ProtectedRoute>
          } />
          
          <Route path="/sales-data" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <SalesData />
            </ProtectedRoute>
          } />
          
          <Route path="/salary-deductions" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <SalaryDeductionsUpload />
            </ProtectedRoute>
          } />
          
          {/* Manager routes */}
          <Route path="/office-dashboard" element={
            <ProtectedRoute allowedRoles={['manager']}>
              <OfficeManagerDashboard />
            </ProtectedRoute>
          } />
          
          {/* Shared routes */}
          <Route path="/accounting-export" element={
            <ProtectedRoute allowedRoles={['admin', 'manager']}>
              <AccountingExport />
            </ProtectedRoute>
          } />
          
          {/* Agent routes */}
          <Route path="/agent-dashboard" element={
            <ProtectedRoute allowedRoles={['agent', 'admin', 'manager']}>
              <AgentDashboard />
            </ProtectedRoute>
          } />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
};

export default App;
