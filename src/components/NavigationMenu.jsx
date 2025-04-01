import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Box,
  Button,
  Typography,
  Menu,
  MenuItem,
  IconButton,
  Divider,
  ListItemIcon,
  ListItemText,
  Avatar,
  Tooltip,
  Container,
  Fade,
  useScrollTrigger,
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
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
  Menu as MenuIcon,
} from '@mui/icons-material';
import { supabase } from '../supabaseClient';

const systemFontStack = [
  'system-ui',
  '-apple-system',
  'BlinkMacSystemFont',
  '"Segoe UI"',
  'Roboto',
  '"Helvetica Neue"',
  'Arial',
  'sans-serif',
  '"Apple Color Emoji"',
  '"Segoe UI Emoji"',
  '"Segoe UI Symbol"',
].join(',');

const getInitials = (name = '') => {
  return name
    .split(' ')
    .map((n) => n[0])
    .filter((_, i, arr) => i === 0 || i === arr.length - 1)
    .join('')
    .toUpperCase() || '?';
};

function ElevationScroll(props) {
  const { children } = props;
  const trigger = useScrollTrigger({
    disableHysteresis: true,
    threshold: 0,
  });

  return React.cloneElement(children, {
    elevation: trigger ? 4 : 0,
    sx: {
      bgcolor: trigger ? alpha('#ffffff', 0.95) : alpha('#ffffff', 0.85),
      backdropFilter: 'blur(10px)',
    },
  });
}

function NavigationMenu() {
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const [userRole, setUserRole] = useState('user');
  const [userName, setUserName] = useState('');
  const [userMenuAnchor, setUserMenuAnchor] = useState(null);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();
        if (sessionError || !session?.user) {
          console.log('Ingen aktiv session.');
          return;
        }
        const user = session.user;
        let role = 'user',
          fetchedName = user.email?.split('@')[0] || 'Bruker';
        if (user.user_metadata) {
          fetchedName = user.user_metadata.name || fetchedName;
          if (
            user.user_metadata.is_super_admin === true ||
            user.user_metadata.is_admin === true
          ) {
            role = 'admin';
          } else if (user.user_metadata.role) {
            role = user.user_metadata.role;
          }
        }
        if (role === 'user') {
          const { data: employeeData, error: employeeError } = await supabase
            .from('employees')
            .select('role, name')
            .eq('email', user.email)
            .maybeSingle();
          if (!employeeError && employeeData) {
            role = employeeData.role || role;
            fetchedName = employeeData.name || fetchedName;
          } else if (employeeError) {
            console.warn(
              'Kunne ikke hente ansattdetaljer:',
              employeeError.message
            );
          }
        }
        setUserRole(role);
        setUserName(fetchedName);
      } catch (err) {
        console.error('Feil ved henting av brukerdata:', err);
      }
    };
    fetchUserData();
  }, []);
  const handleOpenUserMenu = (event) => setUserMenuAnchor(event.currentTarget);
  const handleCloseUserMenu = () => setUserMenuAnchor(null);
  const handleLogout = async () => {
    handleCloseUserMenu();
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      // Rydd opp i eventuelle lokale tilstander
      localStorage.clear();
      sessionStorage.clear();
      
      // Tving en full sideoppdatering for å sikre at all tilstand blir nullstilt
      window.location.href = '/login';
    } catch (error) {
      console.error('Utlogging feilet:', error);
    }
  };

  const handleNavigation = (path) => {
    // Always force a refresh when navigating to Employees page
    if (path === '/employees' || currentPath === path) {
      console.log("Forcing refresh for path:", path);
      window.location.href = path; // Use direct navigation instead of history push
      return;
    }
  };

  const baseNavIconSize = { fontSize: theme.typography.pxToRem(20) };
  const adminNavItems = [
    {
      path: '/sales-dashboard',
      label: 'Dashboard',
      icon: <Dashboard sx={baseNavIconSize} />,
    },
    {
      path: '/employees',
      label: 'Ansatte',
      icon: <People sx={baseNavIconSize} />,
    },
    {
      path: '/salary-models',
      label: 'Lønnstrinn',
      icon: <Payments sx={baseNavIconSize} />,
    },
    {
      path: '/sales-data',
      label: 'Salgsdata',
      icon: <BarChart sx={baseNavIconSize} />,
    },
    {
      path: '/salary-deductions',
      label: 'Lønnstrekk',
      icon: <MoneyOff sx={baseNavIconSize} />,
    },
    {
      path: '/accounting-export',
      label: 'Regnskap',
      icon: <AccountBalance sx={baseNavIconSize} />,
    },
  ];
  const managerNavItems = [
    {
      path: '/office-dashboard',
      label: 'Kontor',
      icon: <Business sx={baseNavIconSize} />,
    },
    {
      path: '/employees',
      label: 'Ansatte',
      icon: <People sx={baseNavIconSize} />,
    },
    // Accounting export removed - only for admins now
  ];
  const userNavItems = [
    {
      path: '/agent-dashboard',
      label: 'Min Oversikt',
      icon: <Person sx={baseNavIconSize} />,
    },
  ];
  const navItems =
    userRole === 'admin'
      ? adminNavItems
      : userRole === 'manager'
      ? managerNavItems
      : userNavItems;
  const isCurrent = (path) => currentPath === path;

  return (
    <ElevationScroll>
      <AppBar
        position="fixed"
        color="default"
        sx={{
          backgroundColor: alpha(theme.palette.background.paper, 0.85),
          backdropFilter: 'blur(10px)',
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
          fontFamily: systemFontStack,
          width: '100%',
          zIndex: theme.zIndex.drawer + 1,
          boxShadow: 'none',
          height: { xs: '70px', sm: '75px' }, // Explicitly set height
        }}
      >
        <Container maxWidth="xl">
          <Toolbar
            disableGutters
            sx={{ justifyContent: 'space-between', minHeight: { xs: 70, sm: 75 } }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Dashboard color="primary" sx={{ mr: 1.5, fontSize: 32 }} />
              <Typography
                variant="h5"
                noWrap
                component={Link}
                to={
                  userRole === 'admin'
                    ? '/sales-dashboard'
                    : userRole === 'manager'
                    ? '/office-dashboard'
                    : '/agent-dashboard'
                }
                sx={{
                  mr: 4,
                  fontWeight: 600,
                  color: 'inherit',
                  textDecoration: 'none',
                  fontFamily: 'inherit',
                  fontSize: theme.typography.pxToRem(24),
                }}
              >
                SalesPayroll
              </Typography>

              <Box
                sx={{
                  display: { xs: 'none', md: 'flex' },
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                {navItems.map((item) => (
                  <Button
                    key={item.path}
                    component={Link}
                    to={item.path}
                    size="medium"
                    startIcon={item.icon}
                    onClick={() => handleNavigation(item.path)}
                    sx={{
                      fontFamily: 'inherit',
                      color: isCurrent(item.path)
                        ? 'primary.main'
                        : 'text.secondary',
                      fontWeight: isCurrent(item.path) ? 600 : 400,
                      textTransform: 'none',
                      borderRadius: '10px',
                      fontSize: theme.typography.pxToRem(17),
                      px: 2,
                      '&:hover': {
                        backgroundColor: alpha(theme.palette.primary.main, 0.05),
                        color: isCurrent(item.path)
                          ? 'primary.dark'
                          : 'text.primary',
                      },
                    }}
                  >
                    {item.label}
                  </Button>
                ))}
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {userName ? (
                <>
                  <Tooltip title="Brukerkonto">
                    <IconButton onClick={handleOpenUserMenu} sx={{ p: 0.5, ml: 1.5 }}>
                      <Avatar
                        sx={{
                          width: 40,
                          height: 40,
                          fontSize: theme.typography.pxToRem(16),
                          bgcolor: 'primary.light',
                          color: 'primary.contrastText',
                          fontFamily: 'inherit',
                        }}
                      >
                        {getInitials(userName)}
                      </Avatar>
                      <Typography
                        variant="body1"
                        sx={{
                          ml: 1.5,
                          display: { xs: 'none', sm: 'inline' },
                          fontWeight: 500,
                          fontFamily: 'inherit',
                          fontSize: theme.typography.pxToRem(16),
                        }}
                      >
                        {userName}
                      </Typography>
                      <KeyboardArrowDown
                        fontSize="medium"
                        sx={{ ml: 0.5, color: 'text.secondary' }}
                      />
                    </IconButton>
                  </Tooltip>
                  <Menu
                    anchorEl={userMenuAnchor}
                    open={Boolean(userMenuAnchor)}
                    onClose={handleCloseUserMenu}
                    TransitionComponent={Fade}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                    PaperProps={{
                      elevation: 3,
                      sx: {
                        mt: 1.5,
                        minWidth: 240,
                        borderRadius: '10px',
                        fontFamily: systemFontStack,
                        backdropFilter: 'blur(10px)',
                        bgcolor: alpha(theme.palette.background.paper, 0.95),
                        '& .MuiMenuItem-root': {
                          fontSize: theme.typography.pxToRem(15),
                          py: '10px',
                        },
                        '& .MuiTypography-subtitle2': {
                          fontSize: theme.typography.pxToRem(16),
                          fontWeight: 600,
                        },
                        '& .MuiTypography-caption': {
                          fontSize: theme.typography.pxToRem(13),
                        },
                        '& .MuiListItemIcon-root': {
                          minWidth: '40px',
                          '& .MuiSvgIcon-root': {
                            fontSize: theme.typography.pxToRem(22),
                          },
                        },
                      },
                    }}
                  >
                    <Box sx={{ px: 2, py: 2 }}>
                      <Typography variant="subtitle2">{userName}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {userRole === 'admin'
                          ? 'Administrator'
                          : userRole === 'manager'
                          ? 'Kontorleder'
                          : 'Bruker'}
                      </Typography>
                    </Box>
                    <Divider sx={{ my: 0.5 }} />
                    <MenuItem onClick={handleLogout} sx={{ color: 'text.secondary' }}>
                      <ListItemIcon>
                        <Logout sx={{ fontSize: theme.typography.pxToRem(22) }} />
                      </ListItemIcon>
                      <ListItemText
                        primaryTypographyProps={{ fontSize: 'inherit' }}
                      >
                        Logg ut
                      </ListItemText>
                    </MenuItem>
                  </Menu>
                </>
              ) : (
                <Button
                  component={Link}
                  to="/login"
                  color="primary"
                  size="medium"
                  sx={{
                    fontFamily: 'inherit',
                    fontSize: theme.typography.pxToRem(15),
                    textTransform: 'none',
                  }}
                >
                  Logg inn
                </Button>
              )}
            </Box>
          </Toolbar>
        </Container>
      </AppBar>
    </ElevationScroll>
  );
}

export default NavigationMenu;