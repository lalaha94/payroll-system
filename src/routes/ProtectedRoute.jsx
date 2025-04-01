import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../services/supabase/supabaseClient';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

// Enhanced Protected route component with role-based access
const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [authorized, setAuthorized] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      setLoading(true);
      try {
        // Hent pålogget bruker
        const currentPath = location.pathname;
        console.log(`ProtectedRoute - Checking auth for path: "${currentPath}". Allowed roles: [${allowedRoles.join(', ')}]`);
        
        const session = await supabase.auth.getSession();
        
        if (!session?.data?.session) {
          console.error('No active session found');
          setAuthenticated(false);
          navigate('/login', { replace: true });
          return;
        }

        const user = session.data.session.user;
        console.log(`ProtectedRoute - User found: ${user.email}`);
        
        setAuthenticated(true);
        
        // Determine user role with clear priorities
        let userRole = 'agent'; // Default role
        
        // Admin checks - highest priority
        if (user.user_metadata?.is_super_admin === true || 
            user.user_metadata?.is_admin === true || 
            user.user_metadata?.role === 'admin') {
          userRole = 'admin';
        }
        // Manager check - only if not already admin
        else if (user.user_metadata?.role === 'manager') {
          userRole = 'manager';
        }
        // If role not in metadata, check database
        else {
          try {
            // Check users table first
            const { data: userData } = await supabase
              .from('users')
              .select('role')
              .eq('email', user.email)
              .single();
            
            if (userData?.role) {
              if (userData.role === 'admin') userRole = 'admin';
              else if (userData.role === 'manager') userRole = 'manager';
            } 
            else {
              // If not in users, check employees
              const { data: employeeData } = await supabase
                .from('employees')
                .select('role')
                .eq('email', user.email)
                .single();
                
              if (employeeData?.role) {
                if (employeeData.role === 'admin') userRole = 'admin';
                else if (employeeData.role === 'manager') userRole = 'manager';
              }
            }
          } catch (dbError) {
            console.error("Error checking database for role:", dbError);
          }
        }
        
        setUserRole(userRole);
        console.log(`ProtectedRoute - User role determined: "${userRole}". Current path: "${currentPath}"`);
        
        // Check if user is allowed to access this route
        if (allowedRoles.includes(userRole)) {
          console.log(`ProtectedRoute - AUTHORIZED: User with role "${userRole}" can access path "${currentPath}"`);
          setAuthorized(true);
          setLoading(false);
          return; // Stop here - user is authorized for this route
        }
        
        console.log(`ProtectedRoute - NOT AUTHORIZED: User role "${userRole}" not allowed for "${currentPath}"`);
        
        // If we get here, the user is not authorized for this route.
        // Redirect based on role, but first determine appropriate destination
        let redirectTo = '/login'; // Default fallback
        
        if (userRole === 'admin') {
          redirectTo = '/sales-dashboard';
        } else if (userRole === 'manager') {
          redirectTo = '/office-dashboard';
        } else if (userRole === 'agent') {
          redirectTo = '/agent-dashboard';
        }
        
        // Only redirect if we're not already at the target destination
        if (currentPath !== redirectTo) {
          console.log(`ProtectedRoute - Redirecting from "${currentPath}" to "${redirectTo}"`);
          navigate(redirectTo, { replace: true }); // Use replace to avoid browser history issues
        } else {
          console.warn(`ProtectedRoute - Redirect loop prevented: Already at "${redirectTo}"`);
          // Even though they're not authorized based on allowedRoles, we're already at their dashboard
          // This is a special case to prevent redirect loops
          setAuthorized(true);
        }
        
      } catch (error) {
        console.error('Error in auth check:', error);
        setAuthenticated(false);
        navigate('/login', { replace: true });
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [navigate, allowedRoles, location.pathname]);

  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div className="loader"></div>
        <Typography>Laster inn...</Typography>
      </Box>
    );
  }

  return (authenticated && authorized) ? children : null;
};

export default ProtectedRoute;
