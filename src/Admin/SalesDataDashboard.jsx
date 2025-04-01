import React, { useState, useEffect } from 'react';
import { useTheme } from '@mui/material/styles';
import {
  Box, Typography, Grid, Card, CardContent, Divider, TextField,
  MenuItem, CircularProgress, Tab, Tabs, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Paper, Alert,
  Chip, Button, IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
  InputAdornment, FormControl, InputLabel, Select
} from '@mui/material';
import NavigationMenu from '../components/NavigationMenu';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend,
  ResponsiveContainer, Cell, PieChart, Pie, LineChart, Line
} from 'recharts';
import { supabase } from '../supabaseClient';
import { 
  ReceiptLong, Download, CalendarMonth, TrendingUp, 
  PieChart as PieChartIcon, BarChart as BarChartIcon,
  CheckCircle, Cancel, Info
} from '@mui/icons-material';

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
  const [approvalData, setApprovalData] = useState([]);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [revokeLoading, setRevokeLoading] = useState(false);
  const [tenderData, setTenderData] = useState({});
  
  const openRevokeDialog = (agent) => {
    setSelectedAgent(agent);
    setRevokeDialogOpen(true);
  };

  const closeRevokeDialog = () => {
    setRevokeDialogOpen(false);
    setSelectedAgent(null);
    setRevokeReason('');
  };
  
  const handleRevokeApproval = async () => {
    if (!selectedAgent) return;
    
    setRevokeLoading(true);
    try {
      const { error } = await supabase
        .from('monthly_commission_approvals')
        .update({
          revoked: true,
          revoked_at: new Date().toISOString(),
          revoked_by: 'Admin',
          revocation_reason: revokeReason
        })
        .eq('id', selectedAgent.approvalInfo.id);
      
      if (error) throw error;
      
      // Oppdater lokal state
      setAgentData(prev => prev.map(agent => 
        agent.agent_name === selectedAgent.agent_name
          ? { ...agent, isApproved: false, approvalInfo: null }
          : agent
      ));
      
      closeRevokeDialog();
    } catch (error) {
      console.error('Error revoking approval:', error);
    } finally {
      setRevokeLoading(false);
    }
  };
  
  // Chart colors
  const CHART_COLORS = [
    theme.palette.primary.main,
    theme.palette.secondary.main,
    theme.palette.success.main,
    theme.palette.warning.main,
    theme.palette.error.main,
    theme.palette.info.main,
  ];
  
  // Fetch data on component mount
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Fetch data in parallel for better performance
        const [salesResponse, modelsResponse, monthlyApprovals, employeesResponse, tenderResponse] = await Promise.all([
          supabase.from('sales_data').select('*'),
          supabase.from('salary_models').select('*'),
          supabase.from('monthly_commission_approvals').select('*'),
          supabase.from('employees').select('name, agent_id, agent_company, salary_model_id'),
          supabase.from('tender_data').select('*')
        ]);
        
        if (salesResponse.error) throw new Error(salesResponse.error.message);
        if (modelsResponse.error) throw new Error(modelsResponse.error.message);
        if (monthlyApprovals.error) throw new Error(monthlyApprovals.error.message);
        if (employeesResponse.error) throw new Error(employeesResponse.error.message);
        if (tenderResponse.error) throw new Error(tenderResponse.error.message);
        
        // Create a map of agent names to their salary model IDs from employees table
        const employeeSalaryModels = {};
        employeesResponse.data.forEach(employee => {
          if (employee.name && employee.salary_model_id) {
            employeeSalaryModels[employee.name] = employee.salary_model_id;
          }
        });
        
        // Process sales data to get agent performance by month
        const { agents, uniqueMonths } = aggregateSalesByAgent(salesResponse.data || [], employeeSalaryModels);
        
        // Sort months in descending order (most recent first)
        const sortedMonths = [...uniqueMonths].sort((a, b) => b.localeCompare(a));
        
        // Set default selected month to most recent
        const latestMonth = sortedMonths.length > 0 ? sortedMonths[0] : '';
        
        // Calculate commissions for each agent using the salary models
        const agentsWithCommission = agents.map(agent => {
          const commission = calculateCommission(agent, modelsResponse.data || []);
          
          // Check if there's an approved commission for this agent/month
          const approvalRecord = monthlyApprovals.data?.find(
            a => a.agent_name === agent.agent_name && 
                a.month_year === agent.monthKey &&
                a.approved === true && 
                a.revoked !== true
          );
          
          return { 
            ...agent, 
            ...commission,
            isApproved: !!approvalRecord,
            approvedCommission: approvalRecord?.approved_commission || null,
            approvalInfo: approvalRecord || null
          };
        });
        
        // Organiser anbudsdata etter agent og måned
        const tenderMap = {};
        tenderResponse.data?.forEach(tender => {
          const key = `${tender.agent_name}-${tender.month_year}`;
          tenderMap[key] = {
            tjenestetorget: tender.tjenestetorget || 0,
            bytt: tender.bytt || 0,
            other: tender.other || 0
          };
        });
        setTenderData(tenderMap);
        
        setSalesData(salesResponse.data || []);
        setAgentData(agentsWithCommission);
        setSalaryModels(modelsResponse.data || []);
        setMonths(sortedMonths);
        setSelectedMonth(latestMonth);
        setApprovalData(monthlyApprovals.data || []);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  // Aggregate sales data by agent and month
  const aggregateSalesByAgent = (salesData, employeeSalaryModels) => {
    const agentMonthMap = {};
    const uniqueMonths = new Set();
    
    salesData.forEach(sale => {
      if (!sale.policy_sale_date || !sale.agent_name) return;
      
      // Skip cancelled sales
      if (sale.cancel_code) return;
      
      const date = new Date(sale.policy_sale_date);
      if (isNaN(date.getTime())) return;
      
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      uniqueMonths.add(monthKey);
      
      const agentMonthKey = `${sale.agent_name}:${monthKey}`;
      
      if (!agentMonthMap[agentMonthKey]) {
        // Get salary level from either sale data or employees table
        const salary_level = sale.agent_salary_level || employeeSalaryModels[sale.agent_name] || null;
        
        agentMonthMap[agentMonthKey] = {
          agent_name: sale.agent_name,
          agent_id: sale.agent_id,
          monthKey: monthKey,
          agent_company: sale.agent_company,
          salary_level: salary_level,
          livPremium: 0,
          skadePremium: 0,
          totalPremium: 0,
          livCount: 0,
          skadeCount: 0,
          totalCount: 0
        };
      }
      
      const netPremium = parseFloat(sale.net_premium_sales) || 0;
      const provisjonsgruppe = (sale.provisjonsgruppe || "").toLowerCase();
      
      if (provisjonsgruppe.includes("life")) {
        agentMonthMap[agentMonthKey].livPremium += netPremium;
        agentMonthMap[agentMonthKey].livCount++;
      } else if (provisjonsgruppe.includes("pc") || provisjonsgruppe.includes("child") || provisjonsgruppe.includes("skad")) {
        agentMonthMap[agentMonthKey].skadePremium += netPremium;
        agentMonthMap[agentMonthKey].skadeCount++;
      }
      
      agentMonthMap[agentMonthKey].totalPremium += netPremium;
      agentMonthMap[agentMonthKey].totalCount++;
    });
    
    return {
      agents: Object.values(agentMonthMap),
      uniqueMonths
    };
  };

  // Calculate commission based on salary model
  const calculateCommission = (agent, salaryModels) => {
    // Find the agent's salary model
    const salaryModel = salaryModels.find(model => parseInt(model.id) === parseInt(agent.salary_level));

    if (!salaryModel) {
      return {
        livCommission: 0,
        skadeCommission: 0,
        totalCommission: 0,
        salaryModelName: 'Unknown',
        livRate: 0,
        skadeRate: 0,
      };
    }

    // Base commission rates
    const livRate = parseFloat(salaryModel.commission_liv) || 0;
    const skadeRate = parseFloat(salaryModel.commission_skade) || 0;

    // Calculate base commissions
    let livCommission = agent.livPremium * (livRate / 100);
    let skadeCommission = agent.skadePremium * (skadeRate / 100);

    // Apply bonus if applicable
    if (
      salaryModel.bonus_enabled &&
      salaryModel.bonus_threshold &&
      (agent.livPremium + agent.skadePremium) >= parseFloat(salaryModel.bonus_threshold)
    ) {
      const bonusLivRate = parseFloat(salaryModel.bonus_percentage_liv) || 0;
      const bonusSkadeRate = parseFloat(salaryModel.bonus_percentage_skade) || 0;

      livCommission += agent.livPremium * (bonusLivRate / 100);
      skadeCommission += agent.skadePremium * (bonusSkadeRate / 100);
    }

    const totalCommission = livCommission + skadeCommission;

    return {
      livCommission,
      skadeCommission,
      totalCommission,
      salaryModelName: salaryModel.name,
      livRate,
      skadeRate,
    };
  };
  
  // Filter agent data for the selected month
  const filteredAgentData = selectedMonth 
    ? agentData.filter(agent => agent.monthKey === selectedMonth)
    : [];
  
  // Get approved totals for the selected month
  const approvedTotal = filteredAgentData
    .filter(agent => agent.isApproved)
    .reduce((sum, agent) => sum + (agent.approvedCommission || 0), 0);
  
  // Get calculated totals for the selected month
  const calculatedTotal = filteredAgentData
    .reduce((sum, agent) => sum + agent.totalCommission, 0);
  
  // Sort agents by total commission
  const sortedAgents = [...filteredAgentData].sort((a, b) => 
    b.totalCommission - a.totalCommission
  );
  
  // Group approvals by office/company
  const approvalsByOffice = approvalData
    .filter(a => a.month_year === selectedMonth && a.approved === true && a.revoked !== true)
    .reduce((acc, approval) => {
      const company = approval.agent_company || 'Unknown';
      if (!acc[company]) {
        acc[company] = {
          name: company,
          count: 0,
          amount: 0,
          agents: []
        };
      }
      acc[company].count++;
      acc[company].amount += parseFloat(approval.approved_commission) || 0;
      acc[company].agents.push(approval.agent_name);
      return acc;
    }, {});
  
  // Convert to array for charts
  const officeDataArray = Object.values(approvalsByOffice);
  
  // Create comparison data for approvals vs. calculations
  const comparisonData = {
    labels: ['Approved', 'Calculated'],
    values: [approvedTotal, calculatedTotal],
    difference: approvedTotal - calculatedTotal,
    differencePercent: calculatedTotal > 0 ? ((approvedTotal - calculatedTotal) / calculatedTotal) * 100 : 0
  };
  
  // Format month for display: YYYY-MM to YYYY/MM
  const formatMonth = (month) => month.replace('-', '/');
  
  // Handle month change
  const handleMonthChange = (event) => {
    setSelectedMonth(event.target.value);
  };
  
  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };
  
  // Create monthly trend data for charts
  const getMonthlyTrendData = () => {
    // Group by month
    const monthlyTotals = {};
    
    agentData.forEach(agent => {
      if (!monthlyTotals[agent.monthKey]) {
        monthlyTotals[agent.monthKey] = {
          month: agent.monthKey,
          displayMonth: formatMonth(agent.monthKey),
          totalPremium: 0,
          totalCommission: 0,
          approvedCommission: 0,
          agentCount: 0
        };
      }
      
      monthlyTotals[agent.monthKey].totalPremium += agent.totalPremium;
      monthlyTotals[agent.monthKey].totalCommission += agent.totalCommission;
      if (agent.approvedCommission) {
        monthlyTotals[agent.monthKey].approvedCommission += agent.approvedCommission;
      }
      monthlyTotals[agent.monthKey].agentCount++;
    });
    
    // Convert to array and sort by month
    return Object.values(monthlyTotals)
      .sort((a, b) => a.month.localeCompare(b.month));
  };
  
  // Create data for company performance chart
  const getCompanyPerformanceData = () => {
    // Gruppér etter kontor
    const companyTotals = {};
    
    filteredAgentData.forEach(agent => {
      const company = agent.agent_company || 'Ukjent';
      
      if (!companyTotals[company]) {
        companyTotals[company] = {
          name: company,
          totalPremium: 0,
          totalCommission: 0,
          approvedCommission: 0,
          agentCount: 0,
          approvedAgentCount: 0,
          deductions: 0,
          bonus: 0,
          otherAdjustments: 0
        };
      }
      
      // Oppdater totaler
      companyTotals[company].totalPremium += agent.totalPremium;
      companyTotals[company].totalCommission += agent.totalCommission;
      companyTotals[company].agentCount++;
      
      // Håndter godkjente provisjoner
      if (agent.isApproved) {
        companyTotals[company].approvedCommission += agent.approvedCommission || 0;
        companyTotals[company].approvedAgentCount++;
        
        // Beregn trekk og justeringer
        const tjenestetorgetDeduction = agent.tjenestetorgetDeduction || 0;
        const byttDeduction = agent.byttDeduction || 0;
        const otherDeductions = agent.otherDeductions || 0;
        const fivePercentDeduction = (agent.skadeCommission + agent.livCommission) * 0.05;
        
        companyTotals[company].deductions += tjenestetorgetDeduction + byttDeduction + otherDeductions + fivePercentDeduction;
        
        // Beregn bonus hvis aktuelt
        if (agent.bonusEnabled && agent.bonusThreshold) {
          const totalPremium = agent.livPremium + agent.skadePremium;
          if (totalPremium >= agent.bonusThreshold) {
            const bonusLivCommission = agent.livPremium * (agent.bonusLivRate / 100);
            const bonusSkadeCommission = agent.skadePremium * (agent.bonusSkadeRate / 100);
            companyTotals[company].bonus += bonusLivCommission + bonusSkadeCommission;
          }
        }
      }
    });
    
    // Konverter til array og sorter etter total provisjon
    return Object.values(companyTotals)
      .map(company => ({
        ...company,
        difference: company.approvedCommission - company.totalCommission,
        percentDiff: company.totalCommission !== 0 
          ? ((company.approvedCommission - company.totalCommission) / company.totalCommission) * 100 
          : 0,
        approvalRate: company.agentCount > 0 
          ? (company.approvedAgentCount / company.agentCount) * 100 
          : 0
      }))
      .sort((a, b) => b.totalPremium - a.totalPremium);
  };
  
  // Create pie chart data for product distribution
  const getProductDistributionData = () => {
    const productTypes = {
      liv: { name: 'Liv', value: 0 },
      skade: { name: 'Skade', value: 0 }
    };
    
    filteredAgentData.forEach(agent => {
      productTypes.liv.value += agent.livPremium;
      productTypes.skade.value += agent.skadePremium;
    });
    
    return Object.values(productTypes);
  };
  
  // Export data as CSV
  const exportData = (data, filename) => {
    // Format data as CSV
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(item => Object.values(item).join(',')).join('\n');
    const csv = `${headers}\n${rows}`;
    
    // Create download link
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openApprovalDialog = (agent) => {
    setSelectedAgent(agent);
    setApprovalDialogOpen(true);
  };

  const closeDialogs = () => {
    setApprovalDialogOpen(false);
    setRevokeDialogOpen(false);
    setSelectedAgent(null);
  };
  
  const handleApproval = async () => {
    if (!selectedAgent) return;
    
    try {
      const { error } = await supabase
        .from('monthly_commission_approvals')
        .update({
          approved: true,
          approved_at: new Date().toISOString(),
          approved_by: 'Admin',
          approved_commission: selectedAgent.approvedCommission,
          salary_model_id: selectedAgent.salaryModelId,
          approval_comment: selectedAgent.approval_comment,
          tjenestetorget: tenderData[`${selectedAgent.agent_name}-${selectedAgent.monthKey}`]?.tjenestetorget || 0,
          bytt: tenderData[`${selectedAgent.agent_name}-${selectedAgent.monthKey}`]?.bytt || 0,
          other_deductions: tenderData[`${selectedAgent.agent_name}-${selectedAgent.monthKey}`]?.other || 0
        })
        .eq('id', selectedAgent.approvalInfo.id);
      
      if (error) throw error;
      
      // Oppdater lokal state
      setAgentData(prev => prev.map(agent => 
        agent.agent_name === selectedAgent.agent_name
          ? { 
              ...agent, 
              isApproved: true,
              approvedCommission: selectedAgent.approvedCommission,
              salaryModelId: selectedAgent.salaryModelId,
              approvalInfo: {
                ...agent.approvalInfo,
                approved_commission: selectedAgent.approvedCommission,
                salary_model_id: selectedAgent.salaryModelId,
                approval_comment: selectedAgent.approval_comment,
                tjenestetorget: tenderData[`${selectedAgent.agent_name}-${selectedAgent.monthKey}`]?.tjenestetorget || 0,
                bytt: tenderData[`${selectedAgent.agent_name}-${selectedAgent.monthKey}`]?.bytt || 0,
                other_deductions: tenderData[`${selectedAgent.agent_name}-${selectedAgent.monthKey}`]?.other || 0
              }
            }
          : agent
      ));
      
      closeDialogs();
    } catch (error) {
      console.error('Error updating approval:', error);
    }
  };
  
  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <NavigationMenu />
        <CircularProgress size={60} sx={{ mt: 10 }} />
        <Typography variant="h6" sx={{ mt: 2 }}>Laster data...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <NavigationMenu />
        <Alert severity="error" sx={{ mt: 10 }}>
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, backgroundColor: "#f5f5f5", minHeight: "100vh", pt: { xs: 10, sm: 11, md: 12 } }}>
      <NavigationMenu />
      
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          Salgsoversikt
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Oversikt over salgsdata og provisjoner for alle kontorer og agenter
        </Typography>
      </Box>
      
      {/* Month selector */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <TextField
              select
              label="Måned"
              value={selectedMonth}
              onChange={handleMonthChange}
              fullWidth
              size="small"
              InputProps={{
                startAdornment: (
                  <CalendarMonth sx={{ mr: 1, color: 'action.active' }} />
                ),
              }}
            >
              {months.map((month) => (
                <MenuItem key={month} value={month}>
                  {formatMonth(month)}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={9}>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
              <Button 
                variant="outlined" 
                startIcon={<Download />}
                onClick={() => exportData(filteredAgentData, `sales_data_${selectedMonth}.csv`)}
                disabled={!selectedMonth || filteredAgentData.length === 0}
              >
                Eksporter data
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>
      
      {/* Summary cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2} sx={{ borderRadius: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography color="text.secondary">
                  Totalt salg
                </Typography>
                <ReceiptLong color="primary" />
              </Box>
              <Typography variant="h5" component="div" fontWeight="bold">
                {filteredAgentData.reduce((sum, agent) => sum + agent.totalPremium, 0).toLocaleString('no-NO')} kr
              </Typography>
              <Typography variant="body2" color="text.secondary">
                for {selectedMonth ? formatMonth(selectedMonth) : 'valgt periode'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2} sx={{ borderRadius: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography color="text.secondary">
                  Beregnet provisjon
                </Typography>
                <TrendingUp color="primary" />
              </Box>
              <Typography variant="h5" component="div" fontWeight="bold">
                {calculatedTotal.toLocaleString('no-NO')} kr
              </Typography>
              <Typography variant="body2" color="text.secondary">
                basert på individuelle lønnstrinn
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2} sx={{ borderRadius: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography color="text.secondary">
                  Godkjent provisjon
                </Typography>
                <CheckCircle color={approvedTotal > 0 ? "success" : "action"} />
              </Box>
              <Typography variant="h5" component="div" fontWeight="bold" color={approvedTotal < calculatedTotal ? "warning.main" : "success.main"}>
                {approvedTotal.toLocaleString('no-NO')} kr
              </Typography>
              <Typography variant="body2" color={Math.abs(comparisonData.differencePercent) > 5 ? "error.main" : "text.secondary"}>
                {comparisonData.difference !== 0 
                  ? `${comparisonData.difference > 0 ? '+' : ''}${comparisonData.difference.toLocaleString('no-NO')} kr (${comparisonData.differencePercent.toFixed(1)}%)` 
                  : 'Ingen differanse'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2} sx={{ borderRadius: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography color="text.secondary">
                  Antall agenter
                </Typography>
                <PieChartIcon color="primary" />
              </Box>
              <Typography variant="h5" component="div" fontWeight="bold">
                {filteredAgentData.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {`${filteredAgentData.filter(a => a.isApproved).length} godkjent av ${filteredAgentData.length}`}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {/* Tabs for different views */}
      <Paper sx={{ mb: 3, borderRadius: 2 }}>
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >
          <Tab label="Oversikt" />
          <Tab label="Kontorer" />
          <Tab label="Agenter" />
        </Tabs>
        
        <Box sx={{ p: 3 }}>
          {/* Tab 1: Overview */}
          {tabValue === 0 && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={8}>
                <Typography variant="h6" gutterBottom>
                  Provisjonsutvikling over tid
                </Typography>
                <Box sx={{ height: 350 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={getMonthlyTrendData()}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="displayMonth" />
                      <YAxis />
                      <RechartsTooltip formatter={(value) => `${value.toLocaleString('no-NO')} kr`} />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="totalCommission" 
                        name="Beregnet provisjon" 
                        stroke={CHART_COLORS[0]} 
                        activeDot={{ r: 8 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="approvedCommission" 
                        name="Godkjent provisjon" 
                        stroke={CHART_COLORS[2]} 
                        strokeDasharray="5 5" 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </Grid>
              
              <Grid item xs={12} md={4}>
                <Typography variant="h6" gutterBottom>
                  Produktfordeling
                </Typography>
                <Box sx={{ height: 350 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={getProductDistributionData()}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={120}
                        fill="#8884d8"
                        dataKey="value"
                        nameKey="name"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {getProductDistributionData().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip formatter={(value) => `${value.toLocaleString('no-NO')} kr`} />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
              </Grid>
              
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Godkjenninger per kontor
                </Typography>
                <Box sx={{ height: 350 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={officeDataArray}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis yAxisId="left" orientation="left" stroke={CHART_COLORS[0]} />
                      <YAxis yAxisId="right" orientation="right" stroke={CHART_COLORS[1]} />
                      <RechartsTooltip formatter={(value, name) => {
                        if (name === 'Antall godkjenninger') return value;
                        return `${value.toLocaleString('no-NO')} kr`;
                      }} />
                      <Legend />
                      <Bar yAxisId="left" dataKey="count" name="Antall godkjenninger" fill={CHART_COLORS[0]} />
                      <Bar yAxisId="right" dataKey="amount" name="Total godkjent provisjon" fill={CHART_COLORS[1]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </Grid>
            </Grid>
          )}
          
          {/* Tab 2: Companies */}
          {tabValue === 1 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Kontoroversikt for {selectedMonth ? formatMonth(selectedMonth) : 'valgt periode'}
              </Typography>
              
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow sx={{ backgroundColor: theme.palette.action.hover }}>
                      <TableCell>Kontor</TableCell>
                      <TableCell align="right">Antall agenter</TableCell>
                      <TableCell align="right">Godkjent</TableCell>
                      <TableCell align="right">Totalt salg</TableCell>
                      <TableCell align="right">Beregnet provisjon</TableCell>
                      <TableCell align="right">Godkjent provisjon</TableCell>
                      <TableCell align="right">Differanse</TableCell>
                      <TableCell align="center">Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {getCompanyPerformanceData().map((company) => (
                      <TableRow key={company.name} hover>
                        <TableCell>{company.name}</TableCell>
                        <TableCell align="right">{company.agentCount}</TableCell>
                        <TableCell align="right">
                          <Typography variant="body2">
                            {company.approvedAgentCount} av {company.agentCount}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            ({company.approvalRate.toFixed(1)}%)
                          </Typography>
                        </TableCell>
                        <TableCell align="right">{company.totalPremium.toLocaleString('no-NO')} kr</TableCell>
                        <TableCell align="right">{company.totalCommission.toLocaleString('no-NO')} kr</TableCell>
                        <TableCell align="right" sx={{ position: 'relative' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                            {company.approvedCommission?.toLocaleString('nb-NO')} kr
                            {company.approvedCommission !== company.totalCommission && (
                              <Tooltip
                                title={
                                  <Box>
                                    <Typography variant="body2" fontWeight="bold">Detaljer:</Typography>
                                    <Typography variant="body2">Beregnet provisjon: {company.totalCommission?.toLocaleString('nb-NO')} kr</Typography>
                                    <Typography variant="body2">Trekk: {company.deductions?.toLocaleString('nb-NO')} kr</Typography>
                                    <Typography variant="body2">Bonus: {company.bonus?.toLocaleString('nb-NO')} kr</Typography>
                                    <Typography variant="body2">Andre justeringer: {company.otherAdjustments?.toLocaleString('nb-NO')} kr</Typography>
                                    <Typography variant="body2" fontWeight="bold">
                                      Total provisjon: {company.approvedCommission?.toLocaleString('nb-NO')} kr
                                    </Typography>
                                  </Box>
                                }
                                arrow
                                placement="top"
                              >
                                <Info fontSize="small" color="action" />
                              </Tooltip>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell 
                          align="right"
                          sx={{ 
                            color: company.difference === 0 
                              ? 'text.primary' 
                              : company.difference > 0 
                                ? 'success.main' 
                                : 'error.main'
                          }}
                        >
                          {`${company.difference > 0 ? '+' : ''}${company.difference.toLocaleString('no-NO')} kr`}
                          <br />
                          <Typography variant="caption">
                            {`(${company.percentDiff > 0 ? '+' : ''}${company.percentDiff.toFixed(1)}%)`}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          {company.approvalRate === 100 ? (
                            <Chip 
                              label="Fullstendig godkjent" 
                              color="success" 
                              size="small" 
                              icon={<CheckCircle />} 
                            />
                          ) : company.approvalRate > 0 ? (
                            <Chip 
                              label="Delvis godkjent" 
                              color="warning" 
                              size="small" 
                              icon={<Info />} 
                            />
                          ) : (
                            <Chip 
                              label="Ikke godkjent" 
                              color="default" 
                              size="small" 
                              icon={<Cancel />} 
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
          
          {/* Tab 3: Agents */}
          {tabValue === 2 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Agentoversikt for {selectedMonth ? formatMonth(selectedMonth) : 'valgt periode'}
              </Typography>
              
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ backgroundColor: theme.palette.action.hover }}>
                      <TableCell width="15%">Agent</TableCell>
                      <TableCell width="12%">Kontor</TableCell>
                      <TableCell width="12%">Lønnstrinn</TableCell>
                      <TableCell align="right" width="12%">Liv-salg</TableCell>
                      <TableCell align="right" width="12%">Skade-salg</TableCell>
                      <TableCell align="right" width="12%">Totalt salg</TableCell>
                      <TableCell align="right" width="12%">Beregnet provisjon</TableCell>
                      <TableCell align="right" width="13%">Godkjent provisjon</TableCell>
                      <TableCell align="center" width="10%">Status</TableCell>
                      <TableCell align="right" width="10%">Handling</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sortedAgents.map((agent) => (
                      <TableRow key={`${agent.agent_name}-${agent.monthKey}`} hover>
                        <TableCell>{agent.agent_name}</TableCell>
                        <TableCell>{agent.agent_company || 'Ukjent'}</TableCell>
                        <TableCell>
                          <Tooltip title={`Liv: ${agent.livRate}%, Skade: ${agent.skadeRate}%`}>
                            <Chip 
                              label={agent.salaryModelName || 'Ukjent'} 
                              size="small" 
                              color="primary"
                              variant="outlined"
                              sx={{ minWidth: '100px' }}
                            />
                          </Tooltip>
                        </TableCell>
                        <TableCell align="right">{agent.livPremium.toLocaleString('no-NO')} kr</TableCell>
                        <TableCell align="right">{agent.skadePremium.toLocaleString('no-NO')} kr</TableCell>
                        <TableCell align="right">{agent.totalPremium.toLocaleString('no-NO')} kr</TableCell>
                        <TableCell align="right">
                          <Typography variant="body2">
                            {agent.totalCommission.toLocaleString('nb-NO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2">
                            {agent.approvedCommission?.toLocaleString('nb-NO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          {agent.isApproved ? (
                            <Chip 
                              label="Godkjent" 
                              color="success" 
                              size="small" 
                              icon={<CheckCircle />}
                              sx={{ minWidth: '90px' }}
                            />
                          ) : (
                            <Chip 
                              label="Ikke godkjent" 
                              color="default" 
                              size="small" 
                              icon={<Cancel />}
                              sx={{ minWidth: '90px' }}
                            />
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                            <Button
                              size="small"
                              variant="outlined"
                              color="primary"
                              onClick={() => openApprovalDialog(agent)}
                              sx={{ minWidth: '80px' }}
                            >
                              Endre
                            </Button>
                            {agent.isApproved && (
                              <Button
                                size="small"
                                variant="outlined"
                                color="error"
                                onClick={() => openRevokeDialog(agent)}
                                sx={{ minWidth: '80px' }}
                              >
                                Trekk tilbake
                              </Button>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </Box>
      </Paper>

      {/* Dialogs */}
      <Dialog open={approvalDialogOpen} onClose={closeDialogs} maxWidth="md" fullWidth>
        <DialogTitle>Endre godkjenning</DialogTitle>
        <DialogContent>
          {selectedAgent && (
            <Box sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Agent: {selectedAgent.agent_name}
              </Typography>
              
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" gutterBottom>Provisjonsbeløp</Typography>
                <TextField
                  fullWidth
                  label="Godkjent provisjon"
                  type="number"
                  value={selectedAgent.approvedCommission || ''}
                  onChange={(e) => {
                    const newValue = parseFloat(e.target.value);
                    setSelectedAgent(prev => ({
                      ...prev,
                      approvedCommission: newValue
                    }));
                  }}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">kr</InputAdornment>,
                  }}
                />
              </Box>

              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" gutterBottom>Lønnstrinn</Typography>
                <FormControl fullWidth>
                  <InputLabel>Velg lønnstrinn</InputLabel>
                  <Select
                    value={selectedAgent.salaryModelId || ''}
                    onChange={(e) => {
                      setSelectedAgent(prev => ({
                        ...prev,
                        salaryModelId: e.target.value
                      }));
                    }}
                    label="Velg lønnstrinn"
                  >
                    {salaryModels.map((model) => (
                      <MenuItem key={model.id} value={model.id}>
                        {model.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" gutterBottom>Kommentar</Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  label="Kommentar til endringen"
                  value={selectedAgent.approval_comment || ''}
                  onChange={(e) => {
                    setSelectedAgent(prev => ({
                      ...prev,
                      approval_comment: e.target.value
                    }));
                  }}
                />
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialogs}>Avbryt</Button>
          <Button 
            variant="contained" 
            color="primary"
            onClick={async () => {
              try {
                const { error } = await supabase
                  .from('monthly_commission_approvals')
                  .update({
                    approved_commission: selectedAgent.approvedCommission,
                    salary_model_id: selectedAgent.salaryModelId,
                    approval_comment: selectedAgent.approval_comment,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', selectedAgent.approvalInfo.id);
                
                if (error) throw error;
                
                // Oppdater lokal state
                setAgentData(prev => prev.map(agent => 
                  agent.agent_name === selectedAgent.agent_name
                    ? { 
                        ...agent, 
                        approvedCommission: selectedAgent.approvedCommission,
                        salaryModelId: selectedAgent.salaryModelId,
                        approvalInfo: {
                          ...agent.approvalInfo,
                          approved_commission: selectedAgent.approvedCommission,
                          salary_model_id: selectedAgent.salaryModelId,
                          approval_comment: selectedAgent.approval_comment
                        }
                      }
                    : agent
                ));
                
                closeDialogs();
              } catch (error) {
                console.error('Error updating approval:', error);
              }
            }}
          >
            Lagre endringer
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={revokeDialogOpen} onClose={closeRevokeDialog}>
        <DialogTitle>Trekke tilbake godkjenning</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Er du sikker på at du vil trekke tilbake godkjenningen for {selectedAgent?.agent_name}?
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Årsak til tilbakekalling"
            value={revokeReason}
            onChange={(e) => setRevokeReason(e.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeRevokeDialog}>Avbryt</Button>
          <Button 
            onClick={handleRevokeApproval} 
            color="error"
            variant="contained"
            disabled={revokeLoading || !revokeReason.trim()}
          >
            {revokeLoading ? <CircularProgress size={24} /> : 'Trekke tilbake'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default SalesDataDashboard;