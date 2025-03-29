import React, { useState, useEffect, useRef } from 'react'; // Add useRef
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  FormControlLabel,
  Switch,
  Chip,
  Avatar,
  IconButton,
  Tooltip,
  Button
} from '@mui/material';
import { 
  Refresh, 
  Comment, 
  Cancel, 
  Search,
  CheckCircle,
  ArrowUpward,
  ArrowDownward
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';

const MonthlyApprovalsTab = ({
  agentPerformance,
  showApproved,
  setShowApproved,
  selectedMonth,
  refreshingApprovals,
  fetchMonthlyApprovals,
  openBatchApproval,
  openRevocationDialog,
  debugApprovalStatus,
  approvalSuccess,
  setApprovalSuccess,
  CHART_COLORS
}) => {
  const theme = useTheme();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "totalPremium", direction: "desc" });
  
  // Add a ref to track initial mount
  const initialRender = useRef(true);
  
  // Fix the infinite loop by only fetching when the component mounts or when showApproved changes manually
  useEffect(() => {
    // Skip the first render since data is loaded by parent component
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }
    
    console.log("showApproved changed manually to:", showApproved);
    fetchMonthlyApprovals();
  }, [showApproved]); // Only depend on showApproved
  
  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'asc' ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />;
  };

  // Add debugging for the Tobias issue
  const sortedAgents = () => {
    if (!agentPerformance || agentPerformance.length === 0) {
      return [];
    }

    // Log for debugging
    console.log("Full agent performance data:", agentPerformance);
    console.log("Current showApproved setting:", showApproved);
    
    // Check specifically for Tobias
    const hasTobias = agentPerformance.some(agent => agent.name === "Tobias Magnussen");
    console.log("Tobias Magnussen found in agentPerformance:", hasTobias);
    
    // First filter agents by name search term
    const filteredAgents = agentPerformance.filter(agent => {
      // Filter by search term
      const matchesSearch = agent.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
    
    // Check Tobias in filtered agents
    const hasTobiasAfterFilter = filteredAgents.some(agent => agent.name === "Tobias Magnussen");
    console.log("Tobias Magnussen found after search filter:", hasTobiasAfterFilter);
    
    // Make sure we don't filter out approved agents when showApproved is true
    console.log("Agents after search filter:", filteredAgents.length);
    
    // Apply the sort - don't filter by approval status here
    const sortedAgents = [...filteredAgents].sort((a, b) => {
      if (sortConfig.key === 'name') {
        return sortConfig.direction === 'asc' 
          ? a.name.localeCompare(b.name) 
          : b.name.localeCompare(a.name);
      }
      
      if (sortConfig.key === 'isApproved') {
        if (sortConfig.direction === 'desc') {
          return (b.isApproved ? 1 : 0) - (a.isApproved ? 1 : 0);
        } else {
          return (a.isApproved ? 1 : 0) - (b.isApproved ? 1 : 0);
        }
      }
      
      const aValue = a[sortConfig.key] !== undefined ? a[sortConfig.key] : 0;
      const bValue = b[sortConfig.key] !== undefined ? b[sortConfig.key] : 0;
      
      return sortConfig.direction === 'asc' 
        ? aValue - bValue 
        : bValue - aValue;
    });
    
    // Check Tobias in final sorted list
    const hasTobiasInFinal = sortedAgents.some(agent => agent.name === "Tobias Magnussen");
    console.log("Tobias Magnussen found in final sorted list:", hasTobiasInFinal);
    
    // Log info for debugging
    console.log(`Sorted agents (${sortedAgents.length}): ${sortedAgents.map(a => a.name).join(', ')}`);
    
    return sortedAgents;
  };

  // Get the sorted agents now so we can see what we're working with
  const sortedAgentsList = sortedAgents();

  // Modified function to calculate commission
  const calculateAgentApprovalData = (agent) => {
    // Check if the agent already has calculated commission values
    if (agent.totalCommission !== undefined) {
      // Return the pre-calculated commission based on the AgentTab modifications
      return {
        name: agent.name,
        commission: agent.totalCommission,
        // Use already calculated values if available
        isModified: agent.overriddenSkadeRate || agent.overriddenLivRate || agent.overriddenDeductions,
        modificationDetails: {
          skadeRate: agent.skadeCommissionRate,
          livRate: agent.livCommissionRate,
          tjenestetorget: agent.tjenestetorgetDeduction || 0,
          bytt: agent.byttDeduction || 0,
          other: agent.otherDeductions || 0,
          applyFivePercent: agent.applyFivePercent
        }
      };
    }
    
    // Calculate from scratch if needed
    const livCommission = agent.livPremium * (agent.livCommissionRate || 0) / 100;
    const skadeCommission = agent.skadePremium * (agent.skadeCommissionRate || 0) / 100;
    const baseCommission = livCommission + skadeCommission;
    
    // Apply deductions
    const fivePercentDeduction = agent.applyFivePercent ? baseCommission * 0.05 : 0;
    const otherDeductions = 
      (agent.tjenestetorgetDeduction || 0) + 
      (agent.byttDeduction || 0) + 
      (agent.otherDeductions || 0);
    
    const totalCommission = baseCommission - fivePercentDeduction - otherDeductions;
    
    return {
      name: agent.name,
      commission: totalCommission,
      isModified: agent.overriddenSkadeRate || agent.overriddenLivRate || agent.overriddenDeductions,
      modificationDetails: {
        skadeRate: agent.skadeCommissionRate,
        livRate: agent.livCommissionRate,
        tjenestetorget: agent.tjenestetorgetDeduction || 0,
        bytt: agent.byttDeduction || 0,
        other: agent.otherDeductions || 0,
        applyFivePercent: agent.applyFivePercent
      }
    };
  };

  // Add this function to prepare agent data before batch approval
  const prepareAgentForApproval = (agent) => {
    const approvalData = calculateAgentApprovalData(agent);
    return {
      ...agent,
      commission: approvalData.commission,
      isModified: approvalData.isModified,
      modificationDetails: approvalData.modificationDetails
    };
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Typography variant="h6" fontWeight="bold" sx={{ mr: 2 }}>
            Godkjenning av Månedsprovisjon
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={showApproved}
                onChange={(e) => {
                  console.log("Switch toggled manually:", e.target.checked);
                  setShowApproved(e.target.checked);
                }}
                color="primary"
                size="small"
              />
            }
            label="Vis godkjente agenter"
          />
        </Box>
        <Box>
          {approvalSuccess && (
            <Alert 
              severity="success" 
              sx={{ mb: 0, mr: 2 }}
              onClose={() => setApprovalSuccess(null)}
            >
              {approvalSuccess}
            </Alert>
          )}
          
          <Tooltip title="Oppdater godkjenningsstatus">
            <span>
              <IconButton 
                onClick={fetchMonthlyApprovals}
                disabled={refreshingApprovals}
                color="primary"
              >
                <Refresh />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Godkjenn månedsutbetalinger for agenter. Her kan du gjennomgå samlet provisjon 
        for hver agent og godkjenne for utbetaling. Godkjente utbetalinger vil bli sendt 
        til regnskapsavdelingen.
      </Typography>
      
      <TableContainer sx={{ maxHeight: 600 }}>
        {refreshingApprovals ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
            <Typography variant="body2" sx={{ ml: 2 }}>
              Henter data...
            </Typography>
          </Box>
        ) : (
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell onClick={() => requestSort('ranking')} sx={{ cursor: 'pointer' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    #
                    {getSortIcon('ranking')}
                  </Box>
                </TableCell>
                <TableCell onClick={() => requestSort('name')} sx={{ cursor: 'pointer' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    Agent
                    {getSortIcon('name')}
                  </Box>
                </TableCell>
                <TableCell>Lønnstrinn</TableCell>
                <TableCell onClick={() => requestSort('totalPremium')} align="right" sx={{ cursor: 'pointer' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    Total Premium
                    {getSortIcon('totalPremium')}
                  </Box>
                </TableCell>
                <TableCell onClick={() => requestSort('commission')} align="right" sx={{ cursor: 'pointer' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    Beregnet Provisjon
                    {getSortIcon('commission')}
                  </Box>
                </TableCell>
                <TableCell onClick={() => requestSort('isApproved')} align="center" sx={{ cursor: 'pointer' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    Status
                    {getSortIcon('isApproved')}
                  </Box>
                </TableCell>
                <TableCell align="center">Handlinger</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedAgentsList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    {selectedMonth ? 
                      'Ingen agenter med provisjon funnet for denne måneden. Prøv å klikk på oppdater-knappen ovenfor.' :
                      'Velg en måned for å se agenter med provisjon.'
                    }
                  </TableCell>
                </TableRow>
              ) : (
                sortedAgentsList.map((agent, index) => {
                  // Process agent data to include any modifications
                  const agentWithApprovalData = prepareAgentForApproval(agent);
                  const shouldShow = !agentWithApprovalData.isApproved || showApproved;
                  
                  return shouldShow && (
                    <TableRow key={agent.id || `agent-${index}`} hover>
                      <TableCell>
                        <Chip 
                          size="small" 
                          label={agent.ranking || index + 1} 
                          color={
                            (agent.ranking || index + 1) === 1 ? "success" :
                            (agent.ranking || index + 1) === 2 ? "primary" :
                            (agent.ranking || index + 1) === 3 ? "secondary" : 
                            "default"
                          }
                          variant="filled"
                          sx={{ 
                            minWidth: '30px', 
                            fontWeight: 'bold',
                            ...((agent.ranking || index + 1) <= 3 ? { color: 'white' } : {})
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Avatar sx={{ 
                            width: 32, 
                            height: 32, 
                            mr: 1, 
                            bgcolor: (agent.ranking || index + 1) <= 3 
                              ? CHART_COLORS[(agent.ranking || index + 1) - 1] 
                              : '#bdbdbd' 
                          }}>
                            {agent.name?.substring(0, 1) || '?'}
                          </Avatar>
                          {agent.name}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={agent.salaryModelName || 'Ukjent'} 
                          size="small" 
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                        {(agent.totalPremium || 0).toLocaleString('nb-NO')} kr
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: agentWithApprovalData.isModified ? theme.palette.warning.main : theme.palette.success.main }}>
                        {agentWithApprovalData.commission.toLocaleString('nb-NO', { minimumFractionDigits: 2 })} kr
                        {agentWithApprovalData.isModified && (
                          <Tooltip title="Provisjon er justert manuelt">
                            <Box component="span" sx={{ display: 'inline-block', ml: 1 }}>*</Box>
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        {agent.isApproved ? (
                          <Tooltip title={`Godkjent av: ${agent.approvalRecord?.approved_by || 'Ukjent'}`}>
                            <Chip 
                              icon={<CheckCircle fontSize="small" />}
                              label="Godkjent"
                              color="success"
                              size="small"
                            />
                          </Tooltip>
                        ) : agent.commission > 0 ? (
                          <Chip 
                            label="Venter" 
                            color="warning" 
                            size="small"
                          />
                        ) : (
                          <Chip 
                            label="Ingen provisjon" 
                            color="default" 
                            size="small"
                          />
                        )}
                      </TableCell>
                      <TableCell align="center">
                        {!agent.isApproved && agent.commission > 0 ? (
                          <Button
                            variant="contained"
                            color="primary"
                            size="small"
                            onClick={() => openBatchApproval(agent)}
                          >
                            Godkjenn
                          </Button>
                        ) : agent.isApproved && (
                          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                            <Tooltip title={agent.approvalRecord?.approval_comment || 'Ingen kommentar'}>
                              <IconButton size="small" color="info">
                                <Comment fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Trekk tilbake godkjenning">
                              <IconButton 
                                size="small" 
                                color="error"
                                onClick={() => openRevocationDialog(agent)}
                              >
                                <Cancel fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            {process.env.NODE_ENV === 'development' && (
                              <Tooltip title="Debug godkjenningsstatus">
                                <IconButton 
                                  size="small" 
                                  color="default"
                                  onClick={() => debugApprovalStatus(agent)}
                                >
                                  <Search fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
              {showApproved && !sortedAgentsList.some(a => a.name === "Tobias Magnussen") && (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Alert severity="info" sx={{ mt: 2 }}>
                      Merk: Noen godkjente agenter som "Tobias Magnussen" kan mangle fra listen.
                      Dette kan være fordi de ikke har salgsdata i systemet for denne perioden,
                      men har godkjent provisjon. Kontrollsjekk mot regnskapseksporten.
                    </Alert>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </TableContainer>
    </Box>
  );
};

export default MonthlyApprovalsTab;
