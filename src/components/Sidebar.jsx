import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Collapse,
  IconButton,
  Divider,
  useTheme,
  useMediaQuery,
  Tooltip,
  Paper
} from '@mui/material';
import {
  Dashboard,
  Person,
  Payments,
  BarChart,
  MoneyOff,
  AccountBalance,
  People,
  Business,
  ExpandLess,
  ExpandMore,
  ChevronLeft,
  ChevronRight,
  Menu as MenuIcon
} from '@mui/icons-material';
import { alpha } from '@mui/material/styles';

const drawerWidth = 240;

const Sidebar = ({ userRole = 'user' }) => {
  const theme = useTheme();
  const location = useLocation();
  const currentPath = location.pathname;
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [open, setOpen] = useState(!isMobile);
  const [mobileOpen, setMobileOpen] = useState(false);
  
  const [expandedSections, setExpandedSections] = useState({
    admin: true,
    manager: true,
    user: true
  });

  const handleToggleSection = (section) => {
    setExpandedSections({
      ...expandedSections,
      [section]: !expandedSections[section]
    });
  };

  const adminNavItems = [
    { path: '/sales-dashboard', label: 'Dashboard', icon: <Dashboard /> },
    { path: '/employees', label: 'Ansatte', icon: <People /> },
    { path: '/salary-models', label: 'Lønnstrinn', icon: <Payments /> },
    { path: '/sales-data', label: 'Salgsdata', icon: <BarChart /> },
    { path: '/salary-deductions', label: 'Lønnstrekk', icon: <MoneyOff /> },
    { path: '/accounting-export', label: 'Regnskap', icon: <AccountBalance /> },
  ];
  
  const managerNavItems = [
    { path: '/office-dashboard', label: 'Kontor', icon: <Business /> },  // Changed from '/manager-dashboard' to '/office-dashboard'
    { path: '/employees', label: 'Ansatte', icon: <People /> },
  ];
  
  const userNavItems = [
    { path: '/agent-dashboard', label: 'Min Oversikt', icon: <Person /> }
  ];

  const handleDrawerToggle = () => {
    if (isMobile) {
      setMobileOpen(!mobileOpen);
    } else {
      setOpen(!open);
    }
  };

  const drawer = (
    <>
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'flex-end',
        p: 1
      }}>
        <IconButton onClick={handleDrawerToggle}>
          {open ? <ChevronLeft /> : <ChevronRight />}
        </IconButton>
      </Box>
      
      <Divider />
      
      <List component="nav" sx={{ width: '100%' }}>
        {userRole === 'admin' && (
          <>
            <ListItemButton onClick={() => handleToggleSection('admin')}>
              <ListItemIcon>
                <Dashboard />
              </ListItemIcon>
              <ListItemText primary="Admin" />
              {expandedSections.admin ? <ExpandLess /> : <ExpandMore />}
            </ListItemButton>
            
            <Collapse in={expandedSections.admin} timeout="auto" unmountOnExit>
              <List component="div" disablePadding>
                {adminNavItems.map((item) => (
                  <ListItemButton
                    key={item.path}
                    component={Link}
                    to={item.path}
                    selected={currentPath === item.path}
                    sx={{ 
                      pl: 4,
                      bgcolor: currentPath === item.path 
                        ? alpha(theme.palette.primary.main, 0.1) 
                        : 'transparent',
                      '&:hover': {
                        bgcolor: alpha(theme.palette.primary.main, 0.05),
                      },
                    }}
                  >
                    <ListItemIcon>{item.icon}</ListItemIcon>
                    <ListItemText primary={item.label} />
                  </ListItemButton>
                ))}
              </List>
            </Collapse>
          </>
        )}

        {(userRole === 'admin' || userRole === 'manager') && (
          <>
            <ListItemButton onClick={() => handleToggleSection('manager')}>
              <ListItemIcon>
                <Business />
              </ListItemIcon>
              <ListItemText primary="Kontorleder" />
              {expandedSections.manager ? <ExpandLess /> : <ExpandMore />}
            </ListItemButton>
            
            <Collapse in={expandedSections.manager} timeout="auto" unmountOnExit>
              <List component="div" disablePadding>
                {managerNavItems.map((item) => (
                  <ListItemButton
                    key={item.path}
                    component={Link}
                    to={item.path}
                    selected={currentPath === item.path}
                    sx={{ 
                      pl: 4,
                      bgcolor: currentPath === item.path 
                        ? alpha(theme.palette.primary.main, 0.1) 
                        : 'transparent',
                      '&:hover': {
                        bgcolor: alpha(theme.palette.primary.main, 0.05),
                      },
                    }}
                  >
                    <ListItemIcon>{item.icon}</ListItemIcon>
                    <ListItemText primary={item.label} />
                  </ListItemButton>
                ))}
              </List>
            </Collapse>
          </>
        )}

        <ListItemButton onClick={() => handleToggleSection('user')}>
          <ListItemIcon>
            <Person />
          </ListItemIcon>
          <ListItemText primary="Bruker" />
          {expandedSections.user ? <ExpandLess /> : <ExpandMore />}
        </ListItemButton>
        
        <Collapse in={expandedSections.user} timeout="auto" unmountOnExit>
          <List component="div" disablePadding>
            {userNavItems.map((item) => (
              <ListItemButton
                key={item.path}
                component={Link}
                to={item.path}
                selected={currentPath === item.path}
                sx={{ 
                  pl: 4,
                  bgcolor: currentPath === item.path 
                    ? alpha(theme.palette.primary.main, 0.1) 
                    : 'transparent',
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.05),
                  },
                }}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            ))}
          </List>
        </Collapse>
      </List>
    </>
  );

  // For desktop: permanent drawer that can be expanded/collapsed
  const desktopDrawer = (
    <Drawer
      variant="permanent"
      sx={{
        width: open ? drawerWidth : theme.spacing(7),
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: open ? drawerWidth : theme.spacing(7),
          boxSizing: 'border-box',
          overflowX: 'hidden',
          transition: theme.transitions.create(['width'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
          borderRight: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          bgcolor: alpha(theme.palette.background.paper, 0.95),
          backdropFilter: 'blur(10px)',
          boxShadow: '0px 2px 10px rgba(0, 0, 0, 0.05)`,
          height: '100%',
          marginTop: '75px', // Adjust to match the top navigation bar height
          paddingTop: '1rem'
        },
      }}
      open={open}
    >
      {drawer}
    </Drawer>
  );

  // For mobile: temporary drawer
  const mobileDrawer = (
    <Drawer
      variant="temporary"
      open={mobileOpen}
      onClose={handleDrawerToggle}
      ModalProps={{
        keepMounted: true, // Better mobile performance
      }}
      sx={{
        display: { xs: 'block', md: 'none' },
        '& .MuiDrawer-paper': { 
          width: drawerWidth, 
          boxSizing: 'border-box',
          bgcolor: alpha(theme.palette.background.paper, 0.95),
          backdropFilter: 'blur(10px)',
        },
      }}
    >
      {drawer}
    </Drawer>
  );

  return (
    <>
      {/* Drawer for mobile */}
      {isMobile ? mobileDrawer : desktopDrawer}
      
      {/* Mobile menu toggle */}
      {isMobile && (
        <Box 
          sx={{ 
            position: 'fixed',
            bottom: 16, 
            right: 16,
            zIndex: 1200
          }}
        >
          <Tooltip title={mobileOpen ? "Close menu" : "Open menu"}>
            <Paper
              elevation={4} 
              sx={{ 
                borderRadius: '50%',
                overflow: 'hidden',
              }}
            >
              <IconButton
                color="primary"
                aria-label="toggle drawer"
                onClick={handleDrawerToggle}
                size="large"
                sx={{ bgcolor: 'background.paper' }}
              >
                <MenuIcon />
              </IconButton>
            </Paper>
          </Tooltip>
        </Box>
      )}
    </>
  );
};

export default Sidebar;
