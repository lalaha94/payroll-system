import React, { useState, useEffect } from 'react';
import { Box, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import NavigationMenu from './NavigationMenu';
import Sidebar from './Sidebar';
import { supabase } from '../supabaseClient';

/**
 * Layout component that wraps all pages and provides
 * proper spacing for the fixed navigation header and sidebar
 */
const Layout = ({ children }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [userRole, setUserRole] = useState('user');
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);

  useEffect(() => {
    // Fetch user role when component mounts
    const fetchUserRole = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;

        // Try to get role from metadata
        const metadataRole = session.user.user_metadata?.role;
        if (metadataRole) {
          setUserRole(metadataRole);
          return;
        }

        // Fallback to database
        const { data: employeeData } = await supabase
          .from('employees')
          .select('role')
          .eq('email', session.user.email)
          .single();

        if (employeeData?.role) {
          setUserRole(employeeData.role);
        }
      } catch (error) {
        console.error('Error fetching user role:', error);
      }
    };

    fetchUserRole();
  }, []);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Fixed top navigation */}
      <NavigationMenu 
        onToggleSidebar={toggleSidebar} 
        sidebarOpen={sidebarOpen}
        userRole={userRole}
      />
      
      {/* Flex container for sidebar and content */}
      <Box sx={{ display: 'flex', flexGrow: 1 }}>
        {/* Sidebar - visible only on larger screens by default */}
        <Sidebar userRole={userRole} />
        
        {/* Main content - adjust padding based on sidebar visibility */}
        <Box
          component="main"
          className="main-content"
          sx={{
            flexGrow: 1,
            pt: { xs: 9, sm: 10 }, // Padding top to account for fixed header
            pl: { xs: 2, sm: 3, md: sidebarOpen ? 35 : 10 }, // Padding left to account for sidebar
            pr: { xs: 2, sm: 3 },
            pb: 4,
            transition: theme.transitions.create(['padding'], {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
};

export default Layout;
