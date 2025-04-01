import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Avatar,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControlLabel,
  Switch,
  CircularProgress,
  Alert,
  Paper,
  Divider
} from '@mui/material';
import { 
  Search, 
  ArrowUpward, 
  ArrowDownward, 
  Edit, 
  Save, 
  Cancel,
  Warning,
  CheckCircle,
  Refresh
} from '@mui/icons-material';
import { useTheme, alpha } from '@mui/material/styles';
import { format, differenceInMonths } from 'date-fns';
import { supabase } from '../../../supabaseClient';

const AgentTab = ({ agentPerformance, updateAgentPerformance, CHART_COLORS, salaryModels, openBatchApproval }) => {
  const theme = useTheme();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "totalPremium", direction: "desc" });
  const [editingAgent, setEditingAgent] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [editValues, setEditValues] = useState({
    skadeCommissionRate: "",
    livCommissionRate: "",
    tjenestetorgetDeduction: 0,
    byttDeduction: 0,
    otherDeductions: 0,
    baseSalary: 0,
    bonus: 0,
    sickLeave: "",
    applyFivePercent: true
  });
  const [localAgentData, setLocalAgentData] = useState([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [pendingApproval, setPendingApproval] = useState(null);
  const initializedRef = useRef(false);
  const updatingParentRef = useRef(false);
  const previousPropsRef = useRef(null);

  // Memoization av agentPerformance for å unngå unødvendige oppdateringer
  const memoizedAgentPerformance = useMemo(() => agentPerformance, [
    // Kun inkluder nødvendige feltene for sammenligning
    agentPerformance ? JSON.stringify(agentPerformance.map(a => ({
      id: a.id,
      name: a.name,
      isApproved: a.isApproved,
    }))) : null
  ]);
  
  // Memoisert fetchAgentDetails-funksjon for å unngå uendelige loops
  const fetchAgentDetails = useCallback(async () => {
    try {
      const currentMonth = format(new Date(), 'yyyy-MM');
      
      // Hent både ansattdata og godkjenningsstatus
      const [employeesResponse, approvalsResponse] = await Promise.all([
        supabase.from('employees').select('*'),
        supabase
          .from('monthly_commission_approvals')
          .select('*')
          .eq('month_year', currentMonth)
          .eq('revoked', false)
      ]);
      
      if (employeesResponse.error) {
        console.error('Error fetching employee details:', employeesResponse.error);
        return;
      }
      
      if (approvalsResponse.error) {
        console.error('Error fetching approval status:', approvalsResponse.error);
        return;
      }
      
      const employees = employeesResponse.data;
      const approvals = approvalsResponse.data;
      
      if (!memoizedAgentPerformance || memoizedAgentPerformance.length === 0) {
        console.warn("No agent performance data available to merge");
        return;
      }
      
      const mergedData = memoizedAgentPerformance.map(agent => {
        const employeeMatch = employees.find(emp => 
          emp.name === agent.name || emp.agent_id === agent.agent_id
        );
        
        const approvalMatch = approvals.find(approval => 
          approval.agent_name === agent.name
        );
        
        if (employeeMatch) {
          const salaryModel = salaryModels.find(model => 
            model.id === parseInt(employeeMatch.salary_model_id)
          );
          
          return {
            ...agent,
            skadeCommissionRate: agent.skadeCommissionRate || (salaryModel ? salaryModel.commission_skade : 0),
            livCommissionRate: agent.livCommissionRate || (salaryModel ? salaryModel.commission_liv : 0),
            tjenestetorgetDeduction: agent.tjenestetorgetDeduction || employeeMatch.tjenestetorget_deduction || 0,
            byttDeduction: agent.byttDeduction || employeeMatch.bytt_deduction || 0,
            otherDeductions: agent.otherDeductions || employeeMatch.other_deductions || 0,
            baseSalary: agent.baseSalary || employeeMatch.base_salary || 0,
            bonus: agent.bonus || employeeMatch.bonus || 0,
            sickLeave: agent.sickLeave || employeeMatch.sick_leave || "",
            applyFivePercent: agent.applyFivePercent !== undefined ? 
              agent.applyFivePercent : 
              (employeeMatch.apply_five_percent_deduction !== null ? 
                employeeMatch.apply_five_percent_deduction : 
                true),
            // Hent godkjenningsstatus fra monthly_commission_approvals
            isApproved: approvalMatch?.approved || false,
            approvalStatus: approvalMatch ? 'approved' : 'pending',
            lastApprovalAttempt: approvalMatch?.approved_at,
            lastApprovalResult: approvalMatch?.approved ? 'success' : 'pending',
            approvalMetadata: approvalMatch?.approval_metadata || null
          };
        }
        return agent;
      });
      
      initializedRef.current = true;
      setIsInitialLoad(false);
      setLocalAgentData(mergedData);
    } catch (err) {
      console.error('Error processing agent details:', err);
    }
  }, [memoizedAgentPerformance, salaryModels]);

  // Memoisert callback for å oppdatere parent kun når nødvendig
  const updateParent = useCallback((data = localAgentData) => {
    if (
      data.length === 0 || 
      isInitialLoad || 
      !updateAgentPerformance ||
      updatingParentRef.current // Forhindre rekursiv oppdatering
    ) {
      return;
    }
    
    try {
      // Sørg for at vi ikke sender undefined isApproved
      const sanitizedData = data.map(agent => ({
        ...agent,
        isApproved: agent.isApproved || false // Konverter undefined til false
      }));
      
      console.log("Updating parent with data, isApproved status:", 
        sanitizedData.map(a => ({name: a.name, isApproved: a.isApproved})));
      updatingParentRef.current = true;
      updateAgentPerformance(sanitizedData);
    } finally {
      updatingParentRef.current = false;
    }
  }, [localAgentData, updateAgentPerformance, isInitialLoad]);

  // Bruk en enkelt useEffect for datasynkronisering ved første lasting
  useEffect(() => {
    if (isInitialLoad && memoizedAgentPerformance && memoizedAgentPerformance.length > 0) {
      console.log("Initial load - fetching agent details");
      fetchAgentDetails();
    }
  }, [isInitialLoad, memoizedAgentPerformance, fetchAgentDetails]);

  // Separat useEffect for å håndtere oppdateringer fra parent
  useEffect(() => {
    // Returner tidlig hvis vi er i første lasting eller aktivt oppdaterer parent
    if (isInitialLoad || updatingParentRef.current || !memoizedAgentPerformance || memoizedAgentPerformance.length === 0) {
      return;
    }

    // Sjekk om det er endringer i godkjenningsstatus
    if (localAgentData.length > 0) {
      const agentsWithChangedStatus = [];
      
      // Sammenligne agentene og finne de som har endret godkjenningsstatus
      memoizedAgentPerformance.forEach(parentAgent => {
        const localAgent = localAgentData.find(a => 
          (a.id === parentAgent.id) || (a.name === parentAgent.name)
        );
        
        // Håndter undefined status ved å beholde eksisterende status
        const newStatus = parentAgent.isApproved === undefined ? localAgent?.isApproved : parentAgent.isApproved;
        
        if (localAgent && localAgent.isApproved !== newStatus) {
          agentsWithChangedStatus.push({
            name: parentAgent.name,
            oldStatus: localAgent.isApproved,
            newStatus: newStatus
          });
        }
      });
      
      if (agentsWithChangedStatus.length > 0) {
        console.log("Detected approval changes from parent for agents:", agentsWithChangedStatus);
        
        // Kun oppdater isApproved-feltet for agentene som har endret status
        setLocalAgentData(prev => prev.map(localAgent => {
          const parentAgent = memoizedAgentPerformance.find(a => 
            (a.id === localAgent.id) || (a.name === localAgent.name)
          );
          
          // Håndter undefined status ved å beholde eksisterende status
          const newStatus = parentAgent?.isApproved === undefined ? localAgent.isApproved : parentAgent.isApproved;
          
          if (parentAgent && localAgent.isApproved !== newStatus) {
            return { 
              ...localAgent, 
              isApproved: newStatus,
              pendingApproval: false, // Fjern pending status hvis satt
              approvalStatus: newStatus ? 'approved' : 'pending' // Oppdater approvalStatus basert på ny status
            };
          }
          return localAgent;
        }));
      }
    }
  }, [memoizedAgentPerformance, localAgentData, isInitialLoad]);

  // Legg til en separat useEffect for å oppdatere parent BARE når det er nødvendig
  useEffect(() => {
    // Kun oppdater parent når initialiseringen er ferdig
    if (!isInitialLoad && initializedRef.current && !updatingParentRef.current) {
      // Bruker timeouts for å sikre at vi ikke havner i en uendelig oppdateringsløkke
      const timerId = setTimeout(() => {
        updateParent();
      }, 100);
      
      return () => clearTimeout(timerId);
    }
  }, [updateParent, isInitialLoad]);

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'asc' ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />;
  };

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleOpenEditDialog = (agent) => {
    const salaryModel = salaryModels.find(model => model.id === agent.salaryModelId);
    
    setEditingAgent(agent);
    setEditValues({
      skadeCommissionRate: agent.overriddenSkadeRate ? agent.skadeCommissionRate : (salaryModel ? salaryModel.commission_skade : ""),
      livCommissionRate: agent.overriddenLivRate ? agent.livCommissionRate : (salaryModel ? salaryModel.commission_liv : ""),
      tjenestetorgetDeduction: agent.tjenestetorgetDeduction || 0,
      byttDeduction: agent.byttDeduction || 0,
      otherDeductions: agent.otherDeductions || 0,
      baseSalary: agent.baseSalary || 0,
      bonus: agent.bonus || 0,
      sickLeave: agent.sickLeave || "",
      applyFivePercent: agent.applyFivePercent !== undefined 
        ? agent.applyFivePercent 
        : agent.hireDate
          ? differenceInMonths(new Date(), new Date(agent.hireDate)) < 9
          : true
    });
    setEditDialogOpen(true);
  };

  const handleCloseEditDialog = () => {
    setEditDialogOpen(false);
    setEditingAgent(null);
    setSaveError(null);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditValues({
      ...editValues,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleSaveChanges = async () => {
    if (!editingAgent) return;
    
    setSaveLoading(true);
    setSaveError(null);
    
    try {
      const { data: employeeData, error: findError } = await supabase
        .from('employees')
        .select('*')
        .eq('name', editingAgent.name)
        .single();
      
      if (findError) {
        console.error('Error finding employee:', findError);
        throw new Error('Kunne ikke finne ansatt i databasen');
      }
      
      if (!employeeData) {
        throw new Error('Ingen ansatt funnet med dette navnet');
      }
      
      const { error: updateError } = await supabase
        .from('employees')
        .update({ 
          apply_five_percent_deduction: editValues.applyFivePercent,
          tjenestetorget_deduction: parseFloat(editValues.tjenestetorgetDeduction) || 0,
          bytt_deduction: parseFloat(editValues.byttDeduction) || 0,
          other_deductions: parseFloat(editValues.otherDeductions) || 0,
          base_salary: parseFloat(editValues.baseSalary) || 0,
          bonus: parseFloat(editValues.bonus) || 0,
          sick_leave: editValues.sickLeave || null,
          commission_skade_override: parseFloat(editValues.skadeCommissionRate) || null,
          commission_liv_override: parseFloat(editValues.livCommissionRate) || null
        })
        .eq('id', employeeData.id);
      
      if (updateError) {
        throw new Error(`Kunne ikke oppdatere ansattdata: ${updateError.message}`);
      }
      
      const updatedAgentPerformance = localAgentData.map(agent => 
        agent.name === editingAgent.name 
          ? { 
              ...agent, 
              applyFivePercent: editValues.applyFivePercent,
              skadeCommissionRate: parseFloat(editValues.skadeCommissionRate) || agent.skadeCommissionRate,
              livCommissionRate: parseFloat(editValues.livCommissionRate) || agent.livCommissionRate,
              tjenestetorgetDeduction: parseFloat(editValues.tjenestetorgetDeduction) || 0,
              byttDeduction: parseFloat(editValues.byttDeduction) || 0,
              otherDeductions: parseFloat(editValues.otherDeductions) || 0,
              baseSalary: parseFloat(editValues.baseSalary) || 0,
              bonus: parseFloat(editValues.bonus) || 0,
              sickLeave: editValues.sickLeave || "",
              overriddenSkadeRate: true,
              overriddenLivRate: true,
              overriddenDeductions: true,
              isApproved: editingAgent.isApproved,
              totalCommission: calculateTotalCommission({
                ...agent,
                applyFivePercent: editValues.applyFivePercent,
                skadeCommissionRate: parseFloat(editValues.skadeCommissionRate) || agent.skadeCommissionRate,
                livCommissionRate: parseFloat(editValues.livCommissionRate) || agent.livCommissionRate,
                tjenestetorgetDeduction: parseFloat(editValues.tjenestetorgetDeduction) || 0,
                byttDeduction: parseFloat(editValues.byttDeduction) || 0,
                otherDeductions: parseFloat(editValues.otherDeductions) || 0
              }).total
            } 
          : agent
      );
      
      setLocalAgentData(updatedAgentPerformance);
      
      setTimeout(() => {
        updateParent();
      }, 0);
      
      console.log("Changes saved successfully for agent:", editingAgent.name);
      
      handleCloseEditDialog();
    } catch (error) {
      console.error('Error saving changes:', error);
      setSaveError(error.message);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleToggleFivePercent = async (agent, currentValue) => {
    try {
      const { data: employeeData, error: findError } = await supabase
        .from('employees')
        .select('*')
        .eq('name', agent.name)
        .single();
      
      if (findError) {
        console.error('Error finding employee:', findError);
        return;
      }
      
      if (!employeeData) {
        console.error('No employee found with name:', agent.name);
        return;
      }
      
      const { error: updateError } = await supabase
        .from('employees')
        .update({ apply_five_percent_deduction: !currentValue })
        .eq('id', employeeData.id);
      
      if (updateError) {
        console.error('Error updating 5% deduction:', updateError);
        return;
      }
      
      const updatedAgentPerformance = localAgentData.map(a => 
        a.name === agent.name ? { ...a, applyFivePercent: !currentValue } : a
      );
      
      setLocalAgentData(updatedAgentPerformance);
      
      setTimeout(() => {
        updateParent();
      }, 0);
      
      console.log(`5% deduction for ${agent.name} changed to: ${!currentValue}`);
    } catch (error) {
      console.error('Error toggling 5% deduction:', error);
    }
  };

  const sortedAgents = () => {
    if (!localAgentData || localAgentData.length === 0) {
      return [];
    }
    
    // Filter basert på søk, men behold både godkjente og ikke-godkjente agenter
    const filteredAgents = localAgentData.filter(agent => {
      if (!agent || !agent.name) return false;
      return agent.name.toLowerCase().includes(searchTerm.toLowerCase());
    });
    
    return [...filteredAgents].sort((a, b) => {
      // Sorter alltid godkjente agenter sist
      if (a.isApproved !== b.isApproved) {
        return a.isApproved ? 1 : -1;
      }
      
      // Hvis begge agenter har samme godkjenningsstatus, 
      // sorter etter brukerens valgte sorteringskriterie
      if (sortConfig.key === 'name') {
        return sortConfig.direction === 'asc' 
          ? a.name.localeCompare(b.name) 
          : b.name.localeCompare(a.name);
      }
      
      if (sortConfig.key === 'position' || sortConfig.key === 'salaryModelName') {
        const aValue = a[sortConfig.key] || '';
        const bValue = b[sortConfig.key] || '';
        return sortConfig.direction === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      const aValue = a[sortConfig.key] !== undefined ? a[sortConfig.key] : 0;
      const bValue = b[sortConfig.key] !== undefined ? b[sortConfig.key] : 0;
      
      return sortConfig.direction === 'asc' 
        ? aValue - bValue
        : bValue - aValue;
    });
  };

  const calculateTotalCommission = (agent) => {
    const skadeCommission = agent.skadePremium * (agent.skadeCommissionRate / 100) || 0;
    const livCommission = agent.livPremium * (agent.livCommissionRate / 100) || 0;
    
    const totalBeforeDeductions = skadeCommission + livCommission;
    
    const tjenestetorgetDeduction = parseFloat(agent.tjenestetorgetDeduction) || 0;
    const byttDeduction = parseFloat(agent.byttDeduction) || 0;
    const otherDeductions = parseFloat(agent.otherDeductions) || 0;
    
    const fivePercentDeduction = agent.applyFivePercent ? totalBeforeDeductions * 0.05 : 0;
    
    const totalCommission = totalBeforeDeductions - tjenestetorgetDeduction - byttDeduction - otherDeductions - fivePercentDeduction;
    
    return {
      total: totalCommission,
      details: {
        skadeCommission,
        livCommission,
        totalBeforeDeductions,
        tjenestetorgetDeduction,
        byttDeduction, 
        otherDeductions,
        fivePercentDeduction
      }
    };
  };

  const handleOpenBatchApprovalClick = async (agent) => {
    console.log("Opening batch approval for agent:", agent);
    
    // Sjekk om agenten allerede er i godkjenningsprosess
    if (pendingApproval === (agent.id || agent.name)) {
      console.log("Agent is already in approval process");
      return;
    }
    
    // Sjekk om agenten allerede er godkjent
    if (agent.isApproved) {
      console.log("Agent is already approved");
      return;
    }
    
    // Vi setter pending approval for å forhindre flere klikk
    setPendingApproval(agent.id || agent.name);
    
    // Oppdater lokalt først for bedre responsitivitet
    const updatedAgentData = localAgentData.map(localAgent => 
      (localAgent.id === agent.id || localAgent.name === agent.name) 
        ? { 
            ...localAgent, 
            pendingApproval: true,
            approvalStatus: 'pending'
          } 
        : localAgent
    );
    
    setLocalAgentData(updatedAgentData);
    
    // Deretter kall parent-funksjonen for å faktisk utføre godkjenningen
    setTimeout(async () => {
      try {
        // Kall godkjenningsfunksjonen
        openBatchApproval({
          ...agent,
          onApprovalComplete: async (success) => {
            console.log("Approval completed:", success);
            
            try {
              // Beregn total provisjon
              const commissionDetails = calculateTotalCommission(agent);
              const totalCommission = commissionDetails.total;
              
              // Finn eksisterende godkjenning for denne måneden
              const currentMonth = format(new Date(), 'yyyy-MM');
              const { data: existingApproval, error: findError } = await supabase
                .from('monthly_commission_approvals')
                .select('*')
                .eq('agent_name', agent.name)
                .eq('month_year', currentMonth)
                .single();
              
              if (findError && findError.code !== 'PGRST116') { // PGRST116 er "no rows returned"
                throw new Error('Kunne ikke sjekke eksisterende godkjenning');
              }
              
              if (success) {
                // Opprett eller oppdater godkjenning i databasen
                const approvalData = {
                  agent_name: agent.name,
                  month_year: currentMonth,
                  approved: true,
                  approved_by: agent.managerName || 'System',
                  approved_commission: totalCommission,
                  approval_comment: 'Godkjent via batch-godkjenning',
                  salary_model_id: agent.salaryModelId,
                  approved_at: new Date().toISOString(),
                  agent_company: agent.company || null,
                  original_commission: agent.totalCommission || 0,
                  agent_email: agent.email || null,
                  calculated_commission: totalCommission,
                  approval_metadata: {
                    commission_details: commissionDetails.details,
                    approval_timestamp: new Date().toISOString(),
                    approval_method: 'batch'
                  }
                };
                
                if (existingApproval) {
                  // Oppdater eksisterende godkjenning
                  const { error: updateError } = await supabase
                    .from('monthly_commission_approvals')
                    .update(approvalData)
                    .eq('id', existingApproval.id);
                  
                  if (updateError) {
                    throw new Error(`Kunne ikke oppdatere godkjenning: ${updateError.message}`);
                  }
                } else {
                  // Opprett ny godkjenning
                  const { error: insertError } = await supabase
                    .from('monthly_commission_approvals')
                    .insert([approvalData]);
                  
                  if (insertError) {
                    throw new Error(`Kunne ikke opprette godkjenning: ${insertError.message}`);
                  }
                }
              }
              
              // Oppdater lokal status basert på resultatet
              const updatedStatus = success ? 'approved' : 'failed';
              const updatedAgentData = localAgentData.map(localAgent => 
                (localAgent.id === agent.id || localAgent.name === agent.name) 
                  ? { 
                      ...localAgent, 
                      isApproved: success,
                      pendingApproval: false,
                      approvalStatus: updatedStatus,
                      lastApprovalAttempt: new Date().toISOString(),
                      lastApprovalResult: success ? 'success' : 'failed'
                    } 
                  : localAgent
              );
              
              // Oppdater lokalt først
              setLocalAgentData(updatedAgentData);
              
              // Deretter sørg for at parent oppdateres
              updateParent(updatedAgentData);
              
              // Fjern pending status etter en kort forsinkelse
              setTimeout(() => {
                setPendingApproval(null);
              }, 2000);
            } catch (error) {
              console.error("Error updating approval status in database:", error);
              
              // Oppdater status ved feil
              const errorAgentData = localAgentData.map(localAgent => 
                (localAgent.id === agent.id || localAgent.name === agent.name) 
                  ? { 
                      ...localAgent, 
                      pendingApproval: false,
                      approvalStatus: 'error',
                      lastApprovalAttempt: new Date().toISOString(),
                      lastApprovalResult: 'error',
                      lastError: error.message
                    } 
                  : localAgent
              );
              
              setLocalAgentData(errorAgentData);
              setPendingApproval(null);
              
              // Oppdater parent med feilstatus
              updateParent(errorAgentData);
            }
          }
        });
      } catch (error) {
        console.error("Error during approval process:", error);
        
        // Oppdater status ved feil
        const errorAgentData = localAgentData.map(localAgent => 
          (localAgent.id === agent.id || localAgent.name === agent.name) 
            ? { 
                ...localAgent, 
                pendingApproval: false,
                approvalStatus: 'error',
                lastApprovalAttempt: new Date().toISOString(),
                lastApprovalResult: 'error',
                lastError: error.message
              } 
            : localAgent
        );
        
        setLocalAgentData(errorAgentData);
        setPendingApproval(null);
        
        // Oppdater parent med feilstatus
        updateParent(errorAgentData);
      }
    }, 0);
  };

  const handleRetryApproval = (agent) => {
    console.log("Retrying approval for agent:", agent);
    
    // Nullstill feilstatus og start nytt godkjenningsforsøk
    const resetAgentData = localAgentData.map(localAgent => 
      (localAgent.id === agent.id || localAgent.name === agent.name) 
        ? { 
            ...localAgent, 
            approvalStatus: 'pending',
            lastError: null,
            pendingApproval: true
          } 
        : localAgent
    );
    
    setLocalAgentData(resetAgentData);
    handleOpenBatchApprovalClick(agent);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" fontWeight="bold">
          Rådgivere - {sortedAgents().filter(a => !a.isApproved).length} venter på godkjenning
        </Typography>
        
        <TextField 
          placeholder="Søk etter rådgiver..."
          size="small"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ width: 250 }}
        />
      </Box>
      
      <Box sx={{ 
        position: 'relative',
        '&::after': {
          content: '""',
          position: 'absolute',
          bottom: 0,
          right: 0,
          height: '100%',
          width: '15px',
          background: 'linear-gradient(to right, transparent, rgba(0,0,0,0.05) 40%, rgba(0,0,0,0.05) 100%)',
          pointerEvents: 'none',
          zIndex: 1,
          display: { xs: 'block', md: 'none' },
        },
        '&::before': {
          content: '""',
          position: 'absolute',
          bottom: 0,
          height: '15px',
          width: '100%',
          background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.05) 40%, rgba(0,0,0,0.05) 100%)',
          pointerEvents: 'none',
          zIndex: 1,
        }
      }}>
        <TableContainer component={Paper} sx={{ mt: 2, overflowX: 'auto' }}>
          <Table sx={{ tableLayout: 'fixed', minWidth: 1800 }} stickyHeader>
            <TableHead>
              <TableRow sx={{ backgroundColor: alpha(theme.palette.primary.main, 0.05) }}>
                <TableCell sx={{ 
                  width: 40, 
                  p: 1.5, 
                  fontSize: '0.8rem', 
                  fontWeight: 'bold', 
                  whiteSpace: 'nowrap',
                  position: 'sticky',
                  left: 0,
                  zIndex: 3,
                  backgroundColor: alpha(theme.palette.primary.main, 0.05),
                }}>#</TableCell>
                <TableCell sx={{ 
                  width: 180, 
                  p: 1.5, 
                  fontSize: '0.8rem', 
                  fontWeight: 'bold', 
                  whiteSpace: 'nowrap',
                  backgroundColor: alpha(theme.palette.primary.main, 0.05),
                  borderRight: '1px solid rgba(224, 224, 224, 1)'
                }}>Navn</TableCell>
                <TableCell sx={{ width: 150, p: 1.5, fontSize: '0.8rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Lønnstrinn / Stilling</TableCell>
                <TableCell sx={{ width: 110, p: 1.5, fontSize: '0.8rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Skadesalg</TableCell>
                <TableCell sx={{ width: 110, p: 1.5, fontSize: '0.8rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Livsalg</TableCell>
                <TableCell sx={{ width: 130, p: 1.5, fontSize: '0.8rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Skadeprovisjon %</TableCell>
                <TableCell sx={{ width: 130, p: 1.5, fontSize: '0.8rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Livprovisjon %</TableCell>
                <TableCell sx={{ width: 160, p: 1.5, fontSize: '0.8rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Anbud Tjenestetorget</TableCell>
                <TableCell sx={{ width: 120, p: 1.5, fontSize: '0.8rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Anbud Bytt</TableCell>
                <TableCell sx={{ width: 120, p: 1.5, fontSize: '0.8rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Andre anbud</TableCell>
                <TableCell sx={{ width: 130, p: 1.5, fontSize: '0.8rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Total provisjon</TableCell>
                <TableCell sx={{ width: 110, p: 1.5, fontSize: '0.8rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Fastlønn</TableCell>
                <TableCell sx={{ width: 110, p: 1.5, fontSize: '0.8rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Bonus</TableCell>
                <TableCell sx={{ width: 110, p: 1.5, fontSize: '0.8rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Egenmelding</TableCell>
                <TableCell sx={{ width: 90, p: 1.5, fontSize: '0.8rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>5% trekk</TableCell>
                <TableCell sx={{ width: 100, p: 1.5, fontSize: '0.8rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Handlinger</TableCell>
                <TableCell sx={{ width: 120, p: 1.5, fontSize: '0.8rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Godkjenningsstatus</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedAgents().length > 0 ? (
                sortedAgents().map((agent, index) => {
                  const commissionDetails = calculateTotalCommission(agent);
                  return (
                    <TableRow key={agent.agent_id || index} hover>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell sx={{ 
                        whiteSpace: 'nowrap',
                        position: 'sticky',
                        left: 0,
                        zIndex: 1,
                        backgroundColor: 'background.paper',
                        borderRight: '1px solid rgba(224, 224, 224, 1)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: 180
                      }}>
                        <Tooltip title={agent.name}>
                          <span>{agent.name}</span>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Chip 
                            label={agent.salaryModelName} 
                            size="small" 
                            variant="outlined"
                            color="primary"
                          />
                          <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                            {agent.position || "Rådgiver"}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        {(agent.skadePremium || 0).toLocaleString('nb-NO')} kr
                      </TableCell>
                      <TableCell align="right">
                        {(agent.livPremium || 0).toLocaleString('nb-NO')} kr
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                          {agent.skadeCommissionRate || "-"}%
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                          {agent.livCommissionRate || "-"}%
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        {(agent.tjenestetorgetDeduction || 0).toLocaleString('nb-NO')} kr
                      </TableCell>
                      <TableCell align="right">
                        {(agent.byttDeduction || 0).toLocaleString('nb-NO')} kr
                      </TableCell>
                      <TableCell align="right">
                        {(agent.otherDeductions || 0).toLocaleString('nb-NO')} kr
                      </TableCell>
                      <TableCell sx={{ 
                        fontWeight: 'bold', 
                        color: theme.palette.success.main,
                        whiteSpace: 'nowrap'
                      }}>
                        <Tooltip title={
                          agent.applyFivePercent ? 
                          <React.Fragment>
                            <Typography variant="subtitle2">Beregning av provisjon:</Typography>
                            <Typography variant="body2">
                              Skade: {commissionDetails.details.skadeCommission.toLocaleString('nb-NO')} kr<br />
                              Liv: {commissionDetails.details.livCommission.toLocaleString('nb-NO')} kr<br />
                              <b>Sum før trekk: {commissionDetails.details.totalBeforeDeductions.toLocaleString('nb-NO')} kr</b><br />
                              <Divider sx={{ my: 1 }} />
                              Tjenestetorget: -{commissionDetails.details.tjenestetorgetDeduction.toLocaleString('nb-NO')} kr<br />
                              Bytt: -{commissionDetails.details.byttDeduction.toLocaleString('nb-NO')} kr<br />
                              Andre trekk: -{commissionDetails.details.otherDeductions.toLocaleString('nb-NO')} kr<br />
                              5% trekk: -{commissionDetails.details.fivePercentDeduction.toLocaleString('nb-NO')} kr<br />
                              <Divider sx={{ my: 1 }} />
                              <b>Total provisjon: {commissionDetails.total.toLocaleString('nb-NO')} kr</b>
                            </Typography>
                          </React.Fragment>
                          : ""
                        } arrow placement="left">
                          <span>{commissionDetails.total.toLocaleString('nb-NO')} kr</span>
                        </Tooltip>
                      </TableCell>
                      <TableCell align="right">
                        {(agent.baseSalary || 0).toLocaleString('nb-NO')} kr
                      </TableCell>
                      <TableCell align="right">
                        {(agent.bonus || 0).toLocaleString('nb-NO')} kr
                      </TableCell>
                      <TableCell align="center">
                        {agent.sickLeave || "-"}
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="Klikk for å endre">
                          <Chip
                            label={agent.applyFivePercent ? 'Ja' : 'Nei'}
                            color={agent.applyFivePercent ? 'primary' : 'default'}
                            size="small"
                            onClick={() => handleToggleFivePercent(agent, agent.applyFivePercent)}
                            sx={{ cursor: 'pointer' }}
                          />
                        </Tooltip>
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', justifyContent: 'center' }}>
                          {((agent.totalCommission > 0 || agent.commission > 0) && 
                            !agent.isApproved && 
                            pendingApproval !== (agent.id || agent.name)) && (
                            <Button 
                              variant="contained" 
                              color="primary" 
                              size="small"
                              onClick={() => handleOpenBatchApprovalClick(agent)}
                              disabled={pendingApproval !== null}
                              startIcon={<CheckCircle fontSize="small" />}
                            >
                              Godkjenn
                            </Button>
                          )}
                          <IconButton 
                            size="small"
                            color="primary" 
                            onClick={() => handleOpenEditDialog(agent)}
                            disabled={pendingApproval === (agent.id || agent.name)}
                          >
                            <Edit fontSize="small" />
                          </IconButton>
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        {agent.isApproved ? (
                          <Chip 
                            label="Godkjent" 
                            color="success" 
                            size="small" 
                            icon={<CheckCircle fontSize="small" />}
                            sx={{ fontWeight: 'bold' }}
                          />
                        ) : pendingApproval === (agent.id || agent.name) ? (
                          <Chip 
                            label="Venter på bekreftelse..." 
                            color="warning" 
                            size="small"
                            variant="outlined"
                            sx={{ fontWeight: 'medium' }}
                          />
                        ) : agent.approvalStatus === 'failed' ? (
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <Tooltip title={`Siste forsøk: ${new Date(agent.lastApprovalAttempt).toLocaleString('nb-NO')}`}>
                              <Chip 
                                label="Godkjenning feilet" 
                                color="error" 
                                size="small"
                                variant="outlined"
                                sx={{ border: '1px dashed', fontWeight: 'medium' }}
                              />
                            </Tooltip>
                            <Tooltip title="Prøv igjen">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleRetryApproval(agent)}
                                disabled={pendingApproval !== null}
                              >
                                <Refresh fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        ) : agent.approvalStatus === 'error' ? (
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <Tooltip title={agent.lastError || 'En feil oppstod under godkjenning'}>
                              <Chip 
                                label="Feil under godkjenning" 
                                color="error" 
                                size="small"
                                variant="outlined"
                                sx={{ border: '1px dashed', fontWeight: 'medium' }}
                              />
                            </Tooltip>
                            <Tooltip title="Prøv igjen">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleRetryApproval(agent)}
                                disabled={pendingApproval !== null}
                              >
                                <Refresh fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        ) : (
                          <Chip 
                            label="Ikke godkjent" 
                            color="default" 
                            size="small"
                            variant="outlined"
                            sx={{ border: '1px dashed', fontWeight: 'medium' }}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={17} align="center">
                    Ingen agenter funnet for dette kontoret
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
      
      <Dialog open={editDialogOpen} onClose={handleCloseEditDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          Rediger agent: {editingAgent?.name}
        </DialogTitle>
        <DialogContent dividers>
          {saveError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {saveError}
            </Alert>
          )}
          {editingAgent && (
            <Box sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Lønnstrinn: {editingAgent.salaryModelName}
              </Typography>
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" gutterBottom>Provisjonssatser</Typography>
                <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                  <TextField
                    label="Skadeprovisjon %"
                    name="skadeCommissionRate"
                    value={editValues.skadeCommissionRate}
                    onChange={handleInputChange}
                    type="number"
                    InputProps={{
                      endAdornment: <InputAdornment position="end">%</InputAdornment>,
                    }}
                    size="small"
                  />
                  <TextField
                    label="Livprovisjon %"
                    name="livCommissionRate"
                    value={editValues.livCommissionRate}
                    onChange={handleInputChange}
                    type="number"
                    InputProps={{
                      endAdornment: <InputAdornment position="end">%</InputAdornment>,
                    }}
                    size="small"
                  />
                </Box>
              </Box>
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" gutterBottom>Anbudstrekk</Typography>
                <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                  <TextField
                    label="Tjenestetorget"
                    name="tjenestetorgetDeduction"
                    value={editValues.tjenestetorgetDeduction}
                    onChange={handleInputChange}
                    type="number"
                    InputProps={{
                      startAdornment: <InputAdornment position="start">kr</InputAdornment>,
                    }}
                    size="small"
                  />
                  <TextField
                    label="Bytt"
                    name="byttDeduction"
                    value={editValues.byttDeduction}
                    onChange={handleInputChange}
                    type="number"
                    InputProps={{
                      startAdornment: <InputAdornment position="start">kr</InputAdornment>,
                    }}
                    size="small"
                  />
                  <TextField
                    label="Andre anbud"
                    name="otherDeductions"
                    value={editValues.otherDeductions}
                    onChange={handleInputChange}
                    type="number"
                    InputProps={{
                      startAdornment: <InputAdornment position="start">kr</InputAdornment>,
                    }}
                    size="small"
                  />
                </Box>
              </Box>
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" gutterBottom>Lønn og tillegg</Typography>
                <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                  <TextField
                    label="Fastlønn"
                    name="baseSalary"
                    value={editValues.baseSalary}
                    onChange={handleInputChange}
                    type="number"
                    InputProps={{
                      startAdornment: <InputAdornment position="start">kr</InputAdornment>,
                    }}
                    size="small"
                  />
                  <TextField
                    label="Bonus"
                    name="bonus"
                    value={editValues.bonus}
                    onChange={handleInputChange}
                    type="number"
                    InputProps={{
                      startAdornment: <InputAdornment position="start">kr</InputAdornment>,
                    }}
                    size="small"
                  />
                </Box>
              </Box>
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" gutterBottom>Annen informasjon</Typography>
                <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                  <TextField
                    label="Egenmelding periode"
                    name="sickLeave"
                    value={editValues.sickLeave}
                    onChange={handleInputChange}
                    placeholder="F.eks: 01.03-05.03"
                    size="small"
                    fullWidth
                  />
                </Box>
              </Box>
              <Box sx={{ mt: 3 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={editValues.applyFivePercent}
                      onChange={(e) => setEditValues({
                        ...editValues,
                        applyFivePercent: e.target.checked
                      })}
                      name="applyFivePercent"
                    />
                  }
                  label={`Anvend 5% trekk (${editValues.applyFivePercent ? 'Ja' : 'Nei'})`}
                />
                {editingAgent && editValues.applyFivePercent && (
                  <Alert severity="info" sx={{ mt: 1, fontSize: '0.85rem' }}>
                    5% trekket utgjør ca. {(
                      (editingAgent.skadePremium * (editingAgent.skadeCommissionRate || 0) / 100 + 
                       editingAgent.livPremium * (editingAgent.livCommissionRate || 0) / 100) * 0.05
                    ).toLocaleString('nb-NO')} kr av provisjonen.
                  </Alert>
                )}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEditDialog} startIcon={<Cancel />} disabled={saveLoading}>
            Avbryt
          </Button>
          <Button 
            variant="contained" 
            color="primary" 
            startIcon={saveLoading ? null : <Save />}
            onClick={handleSaveChanges} 
            disabled={saveLoading}
          >
            {saveLoading ? <CircularProgress size={24} /> : 'Lagre endringer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AgentTab;
