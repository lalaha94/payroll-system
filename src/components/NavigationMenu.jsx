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
  Payments,
  BarChart,
  MoneyOff,
  AccountBalance,
  People,
  Business,
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
    const fetchUserRole = async () => {
      try {
        const session = await supabase.auth.getSession();
        const user = session.data?.session?.user;
        
        if (!user) return;
        
        // First check in user metadata (from auth)
        let role = 'user';
        if (user.user_metadata?.is_super_admin === true || user.user_metadata?.is_admin === true) {
          role = 'admin';
        } else if (user.user_metadata?.role) {
          role = user.user_metadata.role;
        }
        
        // If no role in metadata, check in employees table
        if (role === 'user') {
          const { data: employeeData, error } = await supabase
            .from('employees')
            .select('role')
            .eq('email', user.email)
            .single();
            
          if (!error && employeeData?.role) {
            role = employeeData.role;
          }
        }
        
        console.log("User role determined:", role);
        setUserRole(role);
        
        // Also get the user's name
        const displayName = user.user_metadata?.name || user.email.split('@')[0];
        setUserName(displayName);
      } catch (err) {
        console.error("Error fetching user role:", err);
      }
    };
    
    fetchUserRole();
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
    try {
      await supabase.auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };
  
  // Define navigation items for different roles
  const adminNavItems = [
    { path: '/sales-dashboard', label: 'Dashboard', icon: <Dashboard /> },
    { path: '/employees', label: 'Ansatte', icon: <People /> },
    { path: '/salary-models', label: 'Lønnstrinn', icon: <Payments /> },
    { path: '/sales-data', label: 'Salgsdata', icon: <BarChart /> },
    { path: '/salary-deductions', label: 'Lønnstrekk', icon: <MoneyOff /> },
    { path: '/accounting-export', label: 'Regnskapseksport', icon: <AccountBalance /> },
  ];
  
  // Limited menu items for managers (kontorleder) - removed the accounting-export (Godkjenninger) item
  const managerNavItems = [
    { path: '/office-dashboard', label: 'Kontoroversikt', icon: <Business /> },
    { path: '/employees', label: 'Kontoransatte', icon: <People /> },
  ];
  
  const userNavItems = [
    { path: '/agent-dashboard', label: 'Min Oversikt', icon: <Person /> }
  ];
  
  // Determine navigation items based on user role
  const navItems = 
    userRole === 'admin' ? adminNavItems : 
    userRole === 'manager' ? managerNavItems : 
    userNavItems;

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
            SalesPayroll
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
                    userRole === 'manager' ?
                    <Business fontSize="small" color="warning" /> :
                    <Person fontSize="small" color="primary" />
                  }
                </ListItemIcon>
                <ListItemText 
                  primary={
                    <Typography variant="body2">
                      {userRole === 'admin' ? 'Administrator' : 
                       userRole === 'manager' ? 'Kontorleder' : 'Bruker'}
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
              startIcon={item.icon}
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
