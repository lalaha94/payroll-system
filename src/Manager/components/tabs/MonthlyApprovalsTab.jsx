import React, { useState, useEffect, useRef, useCallback } from 'react';
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

function MonthlyApprovalsTab({
  agentPerformance,
  showApproved,
  setShowApproved,
  selectedMonth,
  refreshingApprovals,
  fetchMonthlyApprovals,
  setRefreshingApprovals, // Add this prop
  openBatchApproval,
  openRevocationDialog,
  debugApprovalStatus,
  approvalSuccess,
  setApprovalSuccess,
  monthlyApprovals,
  CHART_COLORS
}) {
  const theme = useTheme();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "totalPremium", direction: "desc" });
  const [verifiedAgents, setVerifiedAgents] = useState({});
  
  const initialRender = useRef(true);
  
  useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }
    
    console.log("showApproved changed manually to:", showApproved);
    if (showApproved !== undefined) {
      fetchMonthlyApprovals();
    }
  }, [showApproved]);

  useEffect(() => {
    if (approvalSuccess) {
      fetchMonthlyApprovals();
      
      const timer = setTimeout(() => {
        setApprovalSuccess(null);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [approvalSuccess, fetchMonthlyApprovals, setApprovalSuccess]);
  
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

  const forceFullRefresh = useCallback(async () => {
    console.log("🔄 Performing full refresh of approval data...");
    setRefreshingApprovals(true);
    
    try {
      // Hent alle godkjenninger for valgt måned
      const { data: allApprovals, error } = await supabase
        .from('monthly_commission_approvals')
        .select('*')
        .eq('month_year', selectedMonth);
      
      if (error) {
        console.error("Error fetching approvals:", error);
        return;
      }
      
      console.log(`Found ${allApprovals.length} total approvals in database`);
      
      // Filtrer ut gyldige godkjenninger (godkjent og ikke tilbakekalt)
      const validApprovals = allApprovals.filter(a => 
        a.approved === true && a.revoked !== true
      );
      
      console.log(`Found ${validApprovals.length} valid approvals (approved=true, revoked≠true)`);
      
      // Oppdater verifiedAgents med de gyldige godkjenningene
      const verifiedMap = {};
      validApprovals.forEach(approval => {
        verifiedMap[approval.agent_name] = {
          isApproved: true,
          approvalRecord: approval
        };
      });
      
      setVerifiedAgents(verifiedMap);
      
      // Oppdater agentPerformance med de nye godkjenningsstatusene
      if (agentPerformance) {
        const updatedAgentPerformance = agentPerformance.map(agent => {
          const approval = validApprovals.find(a => a.agent_name === agent.name);
          if (approval) {
            return {
              ...agent,
              isApproved: true,
              approvalRecord: approval,
              approvalStatus: 'approved'
            };
          }
          return {
            ...agent,
            isApproved: false,
            approvalRecord: null,
            approvalStatus: 'pending'
          };
        });
        
        // Kall parent-komponenten for å oppdatere agentPerformance
        if (typeof updateAgentPerformance === 'function') {
          updateAgentPerformance(updatedAgentPerformance);
        }
      }
      
      await fetchMonthlyApprovals();
      
      setApprovalSuccess("Database refresh complete");
      setTimeout(() => setApprovalSuccess(null), 3000);
    } catch (e) {
      console.error("Error in forceFullRefresh:", e);
    } finally {
      setRefreshingApprovals(false);
    }
  }, [selectedMonth, fetchMonthlyApprovals, setRefreshingApprovals, agentPerformance, updateAgentPerformance]);

  useEffect(() => {
    if (selectedMonth) {
      console.log("Initializing approval data...");
      forceFullRefresh();
    }
  }, [selectedMonth, forceFullRefresh]);

  const approvedAgents = React.useMemo(() => {
    const approvedSet = new Set();
    
    if (monthlyApprovals && monthlyApprovals.length > 0) {
      monthlyApprovals.forEach(approval => {
        if (approval.approved === true && approval.revoked !== true) {
          approvedSet.add(approval.agent_name);
        }
      });
    }
    
    console.log(`Created Set of ${approvedSet.size} approved agent names`);
    return approvedSet;
  }, [monthlyApprovals]);

  const sortedAgents = () => {
    if (!agentPerformance || agentPerformance.length === 0) {
      return [];
    }

    const searchFiltered = agentPerformance.filter(agent => 
      agent.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    const filteredAgents = searchFiltered.filter(agent => {
      const isActuallyApproved = approvedAgents.has(agent.name) || agent.isApproved === true;
      const hasCommission = (
        (agent.totalPremium > 0) ||  
        (agent.commission > 0) || 
        (agent.totalCommission > 0) || 
        (agent.skadePremium > 0 || agent.livPremium > 0)
      );
      
      if (isActuallyApproved) {
        return showApproved;
      }
      
      return true;
    });
    
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
    
    return sortedAgents;
  };

  const calculateAgentApprovalData = (agent) => {
    // Use already computed data from agentPerformance (from AgentTab)
    return {
      name: agent.name,
      commission: agent.commission || 0,
      isModified: agent.isModified || false,
      modificationDetails: agent.modificationDetails || {}
    };
  };

  const getAgentApprovalStatus = useCallback((agent) => {
    if (!agent) {
      return {
        isApproved: false,
        approvalRecord: null,
        commission: 0,
        showApprovalChip: false,
        showWaitingChip: false,
        showNoCommissionChip: true,
        showApproveButton: false,
        showControlButtons: false,
        isModified: false
      };
    }
    
    // Sjekk både agent.isApproved og verifiedAgents
    const isApproved = agent.isApproved === true || verifiedAgents[agent.name]?.isApproved === true;
    const commission = agent.commission || 0;
    const hasCommission = commission > 0;
    
    return {
      isApproved: isApproved,
      approvalRecord: agent.approvalRecord || verifiedAgents[agent.name]?.approvalRecord || null,
      commission: commission,
      isModified: agent.isModified || false,
      showApprovalChip: isApproved,
      showWaitingChip: !isApproved && hasCommission,
      showNoCommissionChip: !hasCommission,
      showApproveButton: !isApproved && hasCommission,
      showControlButtons: isApproved
    };
  }, [verifiedAgents]);

  const handleOpenBatchApprovalClick = useCallback((agent) => {
    try {
      console.log("Opening batch approval for agent:", agent);
      
      // Make sure agent data has all required fields
      if (!agent) {
        console.error("Agent data is undefined");
        return;
      }
      
      // Calculate complete agent data for approval
      const agentData = {
        name: agent.name,
        id: agent.id || agent.agentId,
        agentId: agent.agentId || agent.id,
        company: agent.agent_company || agent.company || managerData?.office,
        commission: agent.commission || 0,
        isModified: agent.isModified || false,
        // Add premium data for calculation display
        skadePremium: agent.skadePremium || 0,
        livPremium: agent.livPremium || 0,
        totalPremium: agent.totalPremium || 0,
        // Add commission rates
        skadeCommissionRate: agent.skadeCommissionRate || 0,
        livCommissionRate: agent.livCommissionRate || 0,
        // Include deductions
        tjenestetorgetDeduction: agent.tjenestetorgetDeduction || 0,
        byttDeduction: agent.byttDeduction || 0,
        otherDeductions: agent.otherDeductions || 0,
        // Include other adjustments
        baseSalary: agent.baseSalary || 0,
        bonus: agent.bonus || 0,
        applyFivePercent: agent.applyFivePercent !== undefined ? agent.applyFivePercent : false
      };
      
      console.log("Prepared agent data for approval:", agentData);
      openBatchApproval(agentData);
    } catch (error) {
      console.error("Error in handleOpenBatchApprovalClick:", error);
    }
  }, [openBatchApproval, managerData]);

  const sortedAgentsList = sortedAgents();

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
                onClick={forceFullRefresh}
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
                      (showApproved ? 
                        'Ingen agenter funnet for denne måneden. Prøv å klikk på oppdater-knappen ovenfor.' :
                        'Ingen agenter venter på godkjenning for denne måneden. Godkjente agenter er skjult. Du kan vise godkjente agenter ved å aktivere bryteren ovenfor.'
                      ) :
                      'Velg en måned for å se agenter med provisjon.'
                    }
                  </TableCell>
                </TableRow>
              ) : (
                sortedAgentsList.map((agent, index) => {
                  const agentApprovalStatus = getAgentApprovalStatus(agent);
                  const commission = agentApprovalStatus.commission || 0;
                  
                  return (
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
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: agentApprovalStatus.isModified ? theme.palette.warning.main : theme.palette.success.main }}>
                        {commission.toLocaleString('nb-NO', { minimumFractionDigits: 2 })} kr
                        {agentApprovalStatus.isModified && (
                          <Tooltip title="Provisjon er justert manuelt">
                            <Box component="span" sx={{ display: 'inline-block', ml: 1 }}>*</Box>
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        {agentApprovalStatus.showApprovalChip && (
                          <Tooltip title={`Godkjent av: ${agentApprovalStatus.approvalRecord?.approved_by || 'Ukjent'}`}>
                            <Chip 
                              icon={<CheckCircle fontSize="small" />}
                              label="Godkjent"
                              color="success"
                              size="small"
                            />
                          </Tooltip>
                        )}
                        
                        {agentApprovalStatus.showWaitingChip && (
                          <Chip 
                            label="Venter" 
                            color="warning" 
                            size="small"
                          />
                        )}
                        
                        {agentApprovalStatus.showNoCommissionChip && (
                          <Chip 
                            label="Ingen provisjon" 
                            color="default" 
                            size="small"
                          />
                        )}
                      </TableCell>
                      <TableCell align="center">
                        {agentApprovalStatus.showApproveButton && (
                          <Button
                            variant="contained"
                            color="primary"
                            size="small"
                            onClick={() => handleOpenBatchApprovalClick(agent)}
                          >
                            Godkjenn
                          </Button>
                        )}
                        
                        {agentApprovalStatus.showControlButtons && (
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
                            <Tooltip title="Debug godkjenningsstatus">
                              <IconButton 
                                size="small" 
                                color="default"
                                onClick={() => debugApprovalStatus(agent)}
                              >
                                <Search fontSize="small" />
                              </IconButton>
                            </Tooltip>
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
}

export default MonthlyApprovalsTab;
