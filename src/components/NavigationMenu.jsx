import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Box,
  Stack,
  Button,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Dashboard } from '@mui/icons-material';

function NavigationMenu() {
  const theme = useTheme();
  const location = useLocation();
  const currentPath = location.pathname;
  
  // Navigation items configuration - reordered with dashboard first
  const navItems = [
    { path: '/sales-dashboard', label: 'Dashboard' },
    { path: '/employees', label: 'Ansatte' },
    { path: '/salary-models', label: 'Lønnstrinn' },
    { path: '/salary-deductions', label: 'Lønnstrekk' },
    { path: '/sales-data', label: 'Salgsdata' },
    { path: '/user-admin', label: 'Brukere' },
  ];

  return (
    <Box sx={{ mb: 4 }}>
      {/* App Header */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        mb: 2,
        pb: 2,
        borderBottom: `1px solid ${theme.palette.divider}`
      }}>
        <Dashboard color="primary" sx={{ mr: 1, fontSize: 28 }} />
        <Typography variant="h5" fontWeight="bold" color="primary">
          Lønnssystem
        </Typography>
      </Box>

      {/* Navigation Buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Stack direction="row" spacing={1.5}>
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
