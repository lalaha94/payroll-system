import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  Tooltip,
  IconButton,
  Chip
} from '@mui/material';
import { CalendarMonth, Refresh, Business, PeopleAlt } from '@mui/icons-material';

const ManagerHeader = ({ 
  managerData, 
  selectedMonth, 
  setSelectedMonth, 
  monthOptions, 
  processMonthlyData,
  officeAgents
}) => {
  return (
    <>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          Kontorleder Oversikt
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          {managerData.agent_company} - {selectedMonth ? selectedMonth.replace('-', '/') : 'inneværende måned'}
        </Typography>
      </Box>
      
      <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item>
            <Typography variant="subtitle1">Velg måned:</Typography>
          </Grid>
          <Grid item xs>
            <FormControl size="small" fullWidth sx={{ maxWidth: 200 }}>
              <InputLabel>Måned</InputLabel>
              <Select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                label="Måned"
                startAdornment={
                  <InputAdornment position="start">
                    <CalendarMonth fontSize="small" />
                  </InputAdornment>
                }
              >
                {monthOptions.map(month => (
                  <MenuItem key={month} value={month}>
                    {month.replace('-', '/')}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item>
            <Tooltip title="Oppdater data">
              <IconButton onClick={() => processMonthlyData()} color="primary">
                <Refresh />
              </IconButton>
            </Tooltip>
          </Grid>
          <Grid item>
            <Chip 
              label={`${managerData.agent_company || 'Ukjent kontor'}`} 
              color="primary" 
              variant="outlined" 
              icon={<Business />}
            />
          </Grid>
          <Grid item>
            <Chip 
              label={`${officeAgents.length} ansatte`} 
              color="secondary" 
              variant="outlined" 
              icon={<PeopleAlt />}
            />
          </Grid>
        </Grid>
      </Paper>
    </>
  );
};

export default ManagerHeader;
