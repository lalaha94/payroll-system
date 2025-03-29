import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
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
import AdminDashboard from './admin/SalesDataDashboard';

// Error boundary component to catch rendering errors
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
    console.error("Error caught by boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column',
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          padding: '20px',
          textAlign: 'center'
        }}>
          <h2>Noe gikk galt</h2>
          <p>Det oppstod en feil i applikasjonen. Prøv å laste siden på nytt.</p>
          <details style={{ marginTop: '20px', textAlign: 'left' }}>
            <summary>Teknisk informasjon</summary>
            <p>{this.state.error && this.state.error.toString()}</p>
          </details>
          <button 
            onClick={() => window.location.reload()} 
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              border: 'none',
              backgroundColor: '#3f51b5',
              color: 'white',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Last siden på nytt
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Enhanced Protected route component with role-based access
const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [authorized, setAuthorized] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      setLoading(true);
      try {
        // Check authentication
        const session = await supabase.auth.getSession();
        
        if (!session?.data?.session) {
          console.error('No active session found');
          setAuthenticated(false);
          navigate('/login');
          return;
        }
        
        const user = session.data.session.user;
        console.log("ProtectedRoute - Full user data:", user);
        
        // User is authenticated
        setAuthenticated(true);
        
        // If there are no role restrictions, allow access
        if (allowedRoles.length === 0) {
          setAuthorized(true);
          setLoading(false);
          return;
        }
        
        console.log("ProtectedRoute - Allowed roles:", allowedRoles);
        
        // Check multiple possible metadata fields for role
        let metadataRole = null;

        if (user.user_metadata?.is_super_admin === true || user.user_metadata?.is_admin === true) {
          metadataRole = 'admin';
        } else if (user.user_metadata?.role) {
          metadataRole = user.user_metadata.role;
        }

        if (metadataRole) {
          console.log(`ProtectedRoute - Found role in metadata or admin flags: ${metadataRole}`);
          
          if (allowedRoles.includes(metadataRole)) {
            console.log(`ProtectedRoute - User is authorized with role: ${metadataRole}`);
            setUserRole(metadataRole);
            setAuthorized(true);
            setLoading(false);
            return;
          } else {
            console.log(`ProtectedRoute - User role ${metadataRole} not in allowed roles`);
            // User doesn't have permission - redirect to appropriate dashboard based on their role
            if (metadataRole === 'admin') {
              navigate('/sales-dashboard');
            } else if (metadataRole === 'manager') {
              navigate('/office-dashboard');
            } else {
              navigate('/agent-dashboard');
            }
            return;
          }
        }
        
        console.log("ProtectedRoute - No role in metadata, checking database...");
        
        // Fallback to check role from database
        const { data: userData, error: userError } = await supabase
          .from('employees') // Changed from 'users' to 'employees'
          .select('role')
          .eq('email', user.email)
          .single();
          
        console.log("ProtectedRoute - Database user data:", userData, "Error:", userError);
        
        if (userError) {
          console.log("ProtectedRoute - No user found in database, using default role 'user'");
          setUserRole('user');
        } else {
          console.log(`ProtectedRoute - Database role: ${userData.role || 'user'}`);
          setUserRole(userData.role || 'user');
        }
        
        // Check if user role is in the allowed roles
        const effectiveRole = userError ? 'user' : (userData.role || 'user');
        
        if (allowedRoles.includes(effectiveRole)) {
          console.log(`ProtectedRoute - User authorized with role: ${effectiveRole}`);
          setAuthorized(true);
        } else {
          console.log(`ProtectedRoute - User role ${effectiveRole} not in allowed roles`);
          // User doesn't have permission - redirect based on role
          if (effectiveRole === 'admin') {
            navigate('/sales-dashboard');
          } else if (effectiveRole === 'manager') {
            navigate('/office-dashboard');
          } else {
            navigate('/agent-dashboard');
          }
        }
      } catch (error) {
        console.error('Error in auth check:', error);
        setAuthenticated(false);
        navigate('/login');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [navigate, allowedRoles]);

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

  return (authenticated && authorized) ? children : null;
};

// Right before the App component definition, add this debugging log
console.log("Initializing App component");

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
          <Route path="/" element={<Navigate to="/sales-dashboard" />} />
          <Route path="/test" element={<h1>Test Route Works</h1>} />
          
          {/* Protected routes with role-based access control */}
          <Route path="/employees" element={
            <ProtectedRoute allowedRoles={['admin', 'manager']}>
              <Employees key="employees-component" /> {/* Add key to force re-render */}
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
          
          <Route path="/accounting-export" element={
            <ProtectedRoute allowedRoles={['admin', 'manager']}>
              <AccountingExport />
            </ProtectedRoute>
          } />
          
          <Route path="/sales-dashboard" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/office-dashboard" element={
            <ProtectedRoute allowedRoles={['manager', 'admin']}>
              <OfficeManagerDashboard />
            </ProtectedRoute>
          } />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
};

export default App;
