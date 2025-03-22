import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Box,
  Stack,
  Button,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';

function NavigationMenu() {
  const theme = useTheme();
  const location = useLocation();
  const currentPath = location.pathname;
  
  // Navigation items configuration
  const navItems = [
    { path: '/employees', label: 'Se ansatte' },
    { path: '/salary-models', label: 'Administrer lønnstrinn' },
    { path: '/salary-deductions', label: 'Lønnstrekk' },
    { path: '/sales-data', label: 'Salgsdata' },
    { path: '/sales-dashboard', label: 'Dashboard' },
    { path: '/user-admin', label: 'Brukere' }, // New item for user admin
  ];

  return (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 4 }}>
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
  );
}

export default NavigationMenu;
