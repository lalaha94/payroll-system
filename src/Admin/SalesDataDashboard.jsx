import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Paper, Grid, CircularProgress, Alert, 
  Card, CardContent, Divider, Select, MenuItem, FormControl, 
  InputLabel, Tabs, Tab, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import NavigationMenu from '../components/NavigationMenu';
import { supabase } from '../supabaseClient';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { aggregateSalesByAgent } from './utils/dataUtils';
import { fetchSalaryModels, calculateCommission } from './utils/commissionUtils';

function SalesDataDashboard() {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [salesData, setSalesData] = useState([]);
  const [agentData, setAgentData] = useState([]);
  const [salaryModels, setSalaryModels] = useState([]);
  const [months, setMonths] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [tabValue, setTabValue] = useState(0);
  
  // Fetch data on component mount
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const [salesResponse, modelsData] = await Promise.all([
          supabase.from('sales_data').select('*'),
          fetchSalaryModels()
        ]);
        
        if (salesResponse.error) throw new Error(salesResponse.error.message);
        
        const { agents, uniqueMonths } = aggregateSalesByAgent(salesResponse.data || []);
        
        // Sort months in descending order (most recent first)
        const sortedMonths = [...uniqueMonths].sort((a, b) => b.localeCompare(a));
        
        // Set default selected month to most recent
        const latestMonth = sortedMonths.length > 0 ? sortedMonths[0] : '';
        
        // Calculate commissions for each agent
        const agentsWithCommission = agents.map(agent => {
          const commission = calculateCommission(agent, modelsData);
          return { ...agent, ...commission };
        });
        
        setSalesData(salesResponse.data || []);
        setAgentData(agentsWithCommission);
        setSalaryModels(modelsData);
        setMonths(sortedMonths);
        setSelectedMonth(latestMonth);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  // Filter agent data for the selected month
  const filteredAgentData = selectedMonth 
    ? agentData.filter(agent => agent.monthKey === selectedMonth)
    : [];
  
  // Sort agents by total commission
  const sortedAgents = [...filteredAgentData].sort((a, b) => 
    b.totalCommission - a.totalCommission
  );
  
  // Format month for display: YYYY-MM to YYYY/MM
  const formatMonth = (month) => month.replace('-', '/');
  
  const handleMonthChange = (event) => {
    setSelectedMonth(event.target.value);
  };
  
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  if (loading) {
    return (
      <Box sx={{ p: 3, backgroundColor: "#f5f5f5", minHeight: "100vh" }}>
        <NavigationMenu />
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          height: 'calc(100vh - 100px)',
          gap: 2
        }}>
          <CircularProgress />
          <Typography variant="h6" color="text.secondary">
            Laster salgsdata...
          </Typography>
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3, backgroundColor: "#f5f5f5", minHeight: "100vh" }}>
        <NavigationMenu />
        <Paper elevation={3} sx={{ p: 4, mt: 4, borderRadius: 2 }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            En feil oppsto ved lasting av data: {error}
          </Alert>
          <Typography variant="body1">
            Vennligst oppdater siden eller prøv igjen senere.
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      p: 3, 
      backgroundColor: "#f5f5f5", 
      minHeight: "100vh",
      pt: { xs: 10, sm: 11, md: 12 } // Add padding-top to push content below navigation
    }}>
      <NavigationMenu />
      
      {/* Header Section */}
      <Paper elevation={3} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <Typography variant="h5" component="h1" fontWeight="bold">
              Salgsoversikt Dashboard
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" sx={{ mt: 1 }}>
              Alle provisjoner og salgsdata visualiseres her
            </Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth variant="outlined" size="small">
              <InputLabel>Måned</InputLabel>
              <Select
                value={selectedMonth}
                onChange={handleMonthChange}
                label="Måned"
              >
                {months.map(month => (
                  <MenuItem key={month} value={month}>{formatMonth(month)}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>
      
      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2} sx={{ borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" component="div" gutterBottom>
                Total Premium
              </Typography>
              <Typography variant="h4" component="div" color="primary.main" fontWeight="bold">
                {filteredAgentData.reduce((sum, agent) => sum + agent.totalPremium, 0).toLocaleString('nb-NO')} kr
              </Typography>
              <Divider sx={{ my: 1 }} />
              <Typography variant="body2" color="text.secondary">
                {formatMonth(selectedMonth)} - {filteredAgentData.length} agenter
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2} sx={{ borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" component="div" gutterBottom>
                Liv Premium
              </Typography>
              <Typography variant="h4" component="div" color="info.main" fontWeight="bold">
                {filteredAgentData.reduce((sum, agent) => sum + agent.livPremium, 0).toLocaleString('nb-NO')} kr
              </Typography>
              <Divider sx={{ my: 1 }} />
              <Typography variant="body2" color="text.secondary">
                {filteredAgentData.reduce((sum, agent) => sum + agent.livCount, 0)} salg
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2} sx={{ borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" component="div" gutterBottom>
                Skade Premium
              </Typography>
              <Typography variant="h4" component="div" color="success.main" fontWeight="bold">
                {filteredAgentData.reduce((sum, agent) => sum + agent.skadePremium, 0).toLocaleString('nb-NO')} kr
              </Typography>
              <Divider sx={{ my: 1 }} />
              <Typography variant="body2" color="text.secondary">
                {filteredAgentData.reduce((sum, agent) => sum + agent.skadeCount, 0)} salg
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2} sx={{ borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" component="div" gutterBottom>
                Total Provisjon
              </Typography>
              <Typography variant="h4" component="div" color="secondary.main" fontWeight="bold">
                {filteredAgentData.reduce((sum, agent) => sum + agent.totalCommission, 0).toLocaleString('nb-NO')} kr
              </Typography>
              <Divider sx={{ my: 1 }} />
              <Typography variant="body2" color="text.secondary">
                Gjennomsnitt: {(filteredAgentData.length > 0 
                  ? filteredAgentData.reduce((sum, agent) => sum + agent.totalCommission, 0) / filteredAgentData.length
                  : 0).toLocaleString('nb-NO')} kr
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {/* Tabs and Content */}
      <Paper elevation={2} sx={{ borderRadius: 2 }}>
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange} 
          indicatorColor="primary"
          textColor="primary"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Visualisering" />
          <Tab label="Topp Agenter" />
          <Tab label="Detaljert Data" />
        </Tabs>
        
        <Box sx={{ p: 3 }}>
          {/* Tab 1: Visualization */}
          {tabValue === 0 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Premium Fordeling per Agent (Topp 10)
              </Typography>
              <Box sx={{ height: 400 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={sortedAgents.slice(0, 10)}
                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="agent_name" 
                      tick={{ fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                    />
                    <YAxis />
                    <Tooltip 
                      formatter={(value) => new Intl.NumberFormat('nb-NO').format(value) + ' kr'}
                    />
                    <Legend />
                    <Bar dataKey="livPremium" name="Liv Premium" fill={theme.palette.info.main} />
                    <Bar dataKey="skadePremium" name="Skade Premium" fill={theme.palette.success.main} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </Box>
          )}
          
          {/* Tab 2: Top Agents */}
          {tabValue === 1 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Topp Agenter etter Provisjon
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Rang</TableCell>
                      <TableCell>Navn</TableCell>
                      <TableCell>Total Premium</TableCell>
                      <TableCell>Liv Sales</TableCell>
                      <TableCell>Skade Sales</TableCell>
                      <TableCell>Provisjon</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sortedAgents.map((agent, index) => (
                      <TableRow key={agent.agent_id || index} hover>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>{agent.agent_name}</TableCell>
                        <TableCell>{agent.totalPremium.toLocaleString('nb-NO')} kr</TableCell>
                        <TableCell>{agent.livPremium.toLocaleString('nb-NO')} kr</TableCell>
                        <TableCell>{agent.skadePremium.toLocaleString('nb-NO')} kr</TableCell>
                        <TableCell sx={{ color: theme.palette.success.main, fontWeight: 'bold' }}>
                          {agent.totalCommission.toLocaleString('nb-NO')} kr
                        </TableCell>
                      </TableRow>
                    ))}
                    {sortedAgents.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} align="center">
                          Ingen data funnet for valgt måned
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
          
          {/* Tab 3: Detailed Data */}
          {tabValue === 2 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Detaljert Salgsdata
              </Typography>
              {/* Add more detailed data view here if needed */}
              <Alert severity="info">
                Detaljert data-visning er under utvikling
              </Alert>
            </Box>
          )}
        </Box>
      </Paper>
    </Box>
  );
}

export default SalesDataDashboard;