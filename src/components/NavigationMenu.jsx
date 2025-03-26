import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Stack,
  Button,
  Typography,
  Chip,
  Menu,
  MenuItem,
  IconButton,
  Divider,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { 
  Dashboard, 
  Person, 
  Logout, 
  Settings, 
  AccountCircle,
  KeyboardArrowDown,
  AdminPanelSettings,
} from '@mui/icons-material';
import { supabase } from '../supabaseClient';

function NavigationMenu() {
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const [userRole, setUserRole] = useState('user');
  const [userName, setUserName] = useState('');
  const [userMenuAnchor, setUserMenuAnchor] = useState(null);
  
  useEffect(() => {
    // Check current user's role
    const checkUserRole = async () => {
      try {
        // Get user session
        const session = await supabase.auth.getSession();
        
        console.log("Full session data:", session);
        
        if (!session?.data?.session) {
          console.error('No active session found');
          return;
        }
        
        const user = session.data.session.user;
        console.log("User from session:", user);
        
        if (user) {
          // Check multiple possible metadata fields for role
          // This covers both user_metadata.role and other potential fields
          const metadataRole = user.user_metadata?.role || 
                               user.user_metadata?.is_admin === true ? 'admin' : 
                               user.user_metadata?.is_super_admin === true ? 'admin' : null;
          
          if (metadataRole) {
            console.log("Role from metadata or admin flags:", metadataRole);
            setUserRole(metadataRole);
            setUserName(user.user_metadata?.name || user.email);
            return;
          }
          
          // Fallback to database
          console.log("No role in metadata, checking database...");
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('email', user.email)
            .single();
          
          console.log("DB user data:", userData, "Error:", userError);
              
          if (!userError && userData) {
            setUserRole(userData.role || 'user');
            setUserName(userData.name || user.email);
          } else {
            // Try to find by email in employees table (just for the name)
            const { data: employeeData } = await supabase
              .from('employees')
              .select('name, email')
              .eq('email', user.email)
              .single();
                
            if (employeeData) {
              setUserName(employeeData.name);
              setUserRole('user');
            } else {
              // Last resort - use email username part
              setUserName(user.email.split('@')[0]);
              setUserRole('user');
            }
          }
        }
      } catch (error) {
        console.error('Error checking user role:', error);
      }
    };
    
    checkUserRole();
  }, []);
  
  // Handle user menu
  const handleOpenUserMenu = (event) => {
    setUserMenuAnchor(event.currentTarget);
  };
  
  const handleCloseUserMenu = () => {
    setUserMenuAnchor(null);
  };
  
  const handleLogout = async () => {
    handleCloseUserMenu();
    await supabase.auth.signOut();
    navigate('/login');
  };
  
  // Define navigation items for different roles
  const adminNavItems = [
    { path: '/sales-dashboard', label: 'Dashboard', roles: ['admin', 'manager'] },
    { path: '/employees', label: 'Ansatte', roles: ['admin'] },
    { path: '/salary-models', label: 'Lønnstrinn', roles: ['admin'] },
    { path: '/salary-deductions', label: 'Lønnstrekk', roles: ['admin', 'manager'] },
    { path: '/sales-data', label: 'Salgsdata', roles: ['admin', 'manager'] },
    { path: '/accounting-export', label: 'Regnskapseksport', roles: ['admin', 'manager'] },
    { path: '/user-admin', label: 'Brukere', roles: ['admin'] },
  ];
  
  const userNavItems = [
    { path: '/agent-dashboard', label: 'Min Oversikt', roles: ['user', 'manager'] }, // Remove 'admin' from roles array
  ];
  
  // Select navigation items based on role and permissions
  const navItems = userRole === 'admin' ? 
    [...adminNavItems] : // For admins, show only admin items
    userRole === 'manager' ?
      [...adminNavItems.filter(item => item.roles.includes('manager')), ...userNavItems] : // For managers, show allowed admin items and user items
      userNavItems; // For regular users, show only user items

  return (
    <Box sx={{ mb: 4 }}>
      {/* App Header */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center', 
        mb: 2,
        pb: 2,
        borderBottom: `1px solid ${theme.palette.divider}`
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Dashboard color="primary" sx={{ mr: 1, fontSize: 28 }} />
          <Typography variant="h5" fontWeight="bold" color="primary">
            Lønnssystem
          </Typography>
        </Box>
        
        {userName && (
          <Box>
            <Chip
              icon={<Person />}
              label={userName}
              variant="outlined"
              color="primary"
              onClick={handleOpenUserMenu}
              deleteIcon={<KeyboardArrowDown />}
              onDelete={handleOpenUserMenu}
            />
            <Menu
              anchorEl={userMenuAnchor}
              open={Boolean(userMenuAnchor)}
              onClose={handleCloseUserMenu}
              PaperProps={{
                elevation: 2,
                sx: { minWidth: 180 }
              }}
            >
              <MenuItem disabled>
                <ListItemText 
                  primary={
                    <Typography variant="body2" color="text.secondary">
                      Innlogget som
                    </Typography>
                  }
                  secondary={
                    <Typography variant="body2" fontWeight="bold">
                      {userName}
                    </Typography>
                  }
                />
              </MenuItem>
              <MenuItem disabled>
                <ListItemIcon>
                  {userRole === 'admin' ? 
                    <AdminPanelSettings fontSize="small" color="error" /> : 
                    <Person fontSize="small" color="primary" />
                  }
                </ListItemIcon>
                <ListItemText 
                  primary={
                    <Typography variant="body2">
                      {userRole === 'admin' ? 'Administrator' : 
                       userRole === 'manager' ? 'Manager' : 'Bruker'}
                    </Typography>
                  }
                />
              </MenuItem>
              <Divider />
              <MenuItem onClick={handleLogout}>
                <ListItemIcon>
                  <Logout fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Logg ut" />
              </MenuItem>
            </Menu>
          </Box>
        )}
      </Box>

      {/* Navigation Buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
          {navItems.map((item) => (
            <Button
              key={item.path}
              component={Link}
              to={item.path}
              variant={currentPath === item.path ? "contained" : "outlined"}
              size="small"
              disableElevation={currentPath === item.path}
              sx={{
                borderRadius: '20px',
                textTransform: 'none',
                px: 2,
                fontWeight: 500,
                mb: 1,
                ...(currentPath === item.path
                  ? {
                      backgroundColor: theme.palette.primary.main,
                      '&:hover': {
                        backgroundColor: theme.palette.primary.dark,
                      },
                    }
                  : {
                      borderColor: 'rgba(0, 0, 0, 0.12)',
                      color: 'text.primary',
                      '&:hover': {
                        backgroundColor: 'rgba(0, 0, 0, 0.04)',
                        borderColor: 'rgba(0, 0, 0, 0.23)',
                      },
                    }),
              }}
            >
              {item.label}
            </Button>
          ))}
        </Stack>
      </Box>
    </Box>
  );
}

export default NavigationMenu;
