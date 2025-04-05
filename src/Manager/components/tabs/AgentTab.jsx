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
  Refresh,
  BugReport
} from '@mui/icons-material';
import { useTheme, alpha } from '@mui/material/styles';
import { format, differenceInMonths } from 'date-fns';
import { supabase } from '../../../supabaseClient';

const AgentTab = ({ agentPerformance, updateAgentPerformance, CHART_COLORS, salaryModels, openBatchApproval, managerData }) => {
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
  const previousAgentPerformanceRef = useRef(null);

  // Memoization av agentPerformance for å unngå unødvendige oppdateringer
  const memoizedAgentPerformance = useMemo(() => agentPerformance, [
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
          
          // Sjekk ansettelsestid og bestem om 5% trekk skal være på
          let shouldApplyFivePercent = false;
          if (employeeMatch.hire_date) {
            const hireDate = new Date(employeeMatch.hire_date);
            const today = new Date();
            const monthsEmployed = differenceInMonths(today, hireDate);
            // Hvis mindre enn 9 måneder: slå på 5% trekk
            shouldApplyFivePercent = monthsEmployed < 9;
            console.log(`${employeeMatch.name} har vært ansatt i ${monthsEmployed} måneder. 5% trekk: ${shouldApplyFivePercent}`);
          }
          
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
                shouldApplyFivePercent),
            // Hent godkjenningsstatus fra monthly_commission_approvals
            isApproved: approvalMatch?.approved || false,
            approvalStatus: approvalMatch ? 'approved' : 'pending',
            lastApprovalAttempt: approvalMatch?.approved_at,
            lastApprovalResult: approvalMatch?.approved ? 'success' : 'pending',
            approvalMetadata: approvalMatch?.approval_metadata || null,
            hireDate: employeeMatch.hire_date || null
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
      // Sjekk om dataene faktisk har endret seg
      const currentDataString = JSON.stringify(data.map(a => ({
        id: a.id,
        name: a.name,
        isApproved: a.isApproved
      })));
      
      const previousDataString = JSON.stringify(previousAgentPerformanceRef.current?.map(a => ({
        id: a.id,
        name: a.name,
        isApproved: a.isApproved
      })));

      if (currentDataString === previousDataString) {
        return; // Ingen endringer, ikke oppdater
      }

      // Sørg for at vi ikke sender undefined isApproved
      const sanitizedData = data.map(agent => ({
        ...agent,
        isApproved: agent.isApproved || false
      }));
      
      console.log("Updating parent with data, isApproved status:", 
        sanitizedData.map(a => ({name: a.name, isApproved: a.isApproved})));
      
      updatingParentRef.current = true;
      updateAgentPerformance(sanitizedData);
      previousAgentPerformanceRef.current = sanitizedData;
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

    // Sjekk om det faktisk er endringer i dataene
    const currentDataString = JSON.stringify(memoizedAgentPerformance.map(a => ({
      id: a.id,
      name: a.name,
      isApproved: a.isApproved
    })));
    
    const previousDataString = JSON.stringify(previousAgentPerformanceRef.current?.map(a => ({
      id: a.id,
      name: a.name,
      isApproved: a.isApproved
    })));

    if (currentDataString === previousDataString) {
      return; // Ingen endringer, ikke oppdater
    }

    // Oppdater localAgentData kun hvis det er faktiske endringer
    setLocalAgentData(prevData => {
      const newData = memoizedAgentPerformance.map(agent => {
        const existingAgent = prevData.find(a => a.id === agent.id);
        return existingAgent ? { ...existingAgent, ...agent } : agent;
      });
      return newData;
    });

    previousAgentPerformanceRef.current = memoizedAgentPerformance;
  }, [memoizedAgentPerformance, isInitialLoad]);

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
    
    // Sjekk ansettelsestid
    const hireDate = agent.hireDate ? new Date(agent.hireDate) : null;
    const monthsEmployed = hireDate ? differenceInMonths(new Date(), hireDate) : null;
    const newHire = monthsEmployed !== null && monthsEmployed < 9;
    
    console.log(`Åpner redigeringsdialog for ${agent.name}:`, {
      hireDate: agent.hireDate,
      monthsEmployed,
      newHire,
      currentFivePercentSetting: agent.applyFivePercent
    });
    
    setEditingAgent({
      ...agent,
      monthsEmployed,
      isNewHire: newHire
    });
    
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
        : newHire  // Sett 5% trekk til true hvis nylig ansatt (under 9 måneder)
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

  const handleSubmitEdit = async () => {
    setIsLoading(true);
    try {
      // Validering av input
      const livRate = parseFloat(editValues.livCommissionRate);
      const skadeRate = parseFloat(editValues.skadeCommissionRate);
      const tjenestetorgetDeduction = parseFloat(editValues.tjenestetorgetDeduction || 0);
      const byttDeduction = parseFloat(editValues.byttDeduction || 0);
      const otherDeductions = parseFloat(editValues.otherDeductions || 0);
      const baseSalary = parseFloat(editValues.baseSalary || 0);
      const bonus = parseFloat(editValues.bonus || 0);
      const applyFivePercent = editValues.applyFivePercent;
      
      // Beregne provisjon på nytt med nye verdier
      const updatedAgent = {
        ...editingAgent,
        skadeCommissionRate: skadeRate,
        livCommissionRate: livRate,
        overriddenSkadeRate: true, // Så vi vet at dette er overskrevet
        overriddenLivRate: true,
        tjenestetorgetDeduction,
        byttDeduction,
        otherDeductions,
        baseSalary,
        bonus,
        applyFivePercent,
        sickLeave: editValues.sickLeave
      };
      
      // Beregne ny provisjon
      const totalBeforeDeductions = (
        updatedAgent.skadePremium * skadeRate / 100 +
        updatedAgent.livPremium * livRate / 100
      );
      
      const totalWithBonus = totalBeforeDeductions + (bonus || 0);
      
      // Legg til 5% trekk hvis det er aktivert
      const fivePercentDeduction = applyFivePercent ? totalWithBonus * 0.05 : 0;
      
      // Beregne total provisjon
      const commission = totalWithBonus - 
        tjenestetorgetDeduction - 
        byttDeduction - 
        otherDeductions - 
        fivePercentDeduction;

      console.log('Oppdatert agent provisjonsdata:', {
        agent: updatedAgent.name,
        totalBeforeDeductions,
        totalWithBonus,
        applyFivePercent,
        fivePercentDeduction,
        otherDeductions: tjenestetorgetDeduction + byttDeduction + otherDeductions,
        finalCommission: commission
      });
      
      updatedAgent.commission = commission;
      
      // Oppdater agenten i databasen
      const { data, error } = await supabase
        .from('agents')
        .update({
          skade_commission_rate: skadeRate,
          liv_commission_rate: livRate,
          overridden_liv_rate: true,
          overridden_skade_rate: true,
          tjenestetorget_deduction: tjenestetorgetDeduction,
          bytt_deduction: byttDeduction,
          other_deductions: otherDeductions,
          base_salary: baseSalary,
          bonus: bonus,
          apply_five_percent: applyFivePercent,
          sick_leave: editValues.sickLeave
        })
        .eq('id', editingAgent.id);
        
      if (error) {
        console.error('Feil ved oppdatering av agent:', error);
        throw error;
      }
      
      // Oppdate agent i lokal state
      setAgentPerformance(prevAgents => {
        return prevAgents.map(agent => {
          if (agent.id === editingAgent.id) {
            return updatedAgent;
          }
          return agent;
        });
      });
      
      setEditDialogOpen(false);
      setSnackbarInfo({
        open: true,
        message: `${editingAgent.name} oppdatert med suksess`,
        severity: 'success'
      });
      
    } catch (error) {
      console.error('Feil ved håndtering av agentredigering:', error);
      setSnackbarInfo({
        open: true,
        message: `Feil ved oppdatering: ${error.message}`,
        severity: 'error'
      });
    } finally {
      setIsLoading(false);
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

  const sortedAgents = useMemo(() => {
    if (!agentPerformance || agentPerformance.length === 0) {
      console.log("Ingen agentdata tilgjengelig");
      return [];
    }
    
    // Filtrer ut agenter basert på søkeord
    let filteredAgents = agentPerformance.filter(agent => {
      const matchesSearch = !searchTerm || 
        agent.name.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Logg agentdata for debugging
      console.log(`Agent ${agent.name}:`, {
        totalPremium: agent.totalPremium,
        isApproved: agent.isApproved,
        manager_approved: agent.manager_approved,
        admin_approved: agent.admin_approved,
        approvalStatus: agent.approvalStatus
      });

      return matchesSearch;
    });

    // Sorter agentene
    filteredAgents.sort((a, b) => {
      if (sortConfig.key === "name") {
        return sortConfig.direction === "asc" 
          ? a.name.localeCompare(b.name) 
          : b.name.localeCompare(a.name);
      }
      
      const aValue = parseFloat(a[sortConfig.key]) || 0;
      const bValue = parseFloat(b[sortConfig.key]) || 0;
      
      return sortConfig.direction === "asc" 
        ? aValue - bValue
        : bValue - aValue;
    });

    return filteredAgents;
  }, [agentPerformance, searchTerm, sortConfig]);

  const calculateTotalCommission = (agent) => {
    const skadeCommission = agent.skadePremium * (agent.skadeCommissionRate / 100) || 0;
    const livCommission = agent.livPremium * (agent.livCommissionRate / 100) || 0;
    
    const totalBeforeDeductions = skadeCommission + livCommission;
    
    // Legg til bonus hvis det finnes
    const bonusAmount = agent.bonusAmount || 0;
    const totalWithBonus = totalBeforeDeductions + bonusAmount;
    
    // Beregn trekk
    const tjenestetorgetDeduction = parseFloat(agent.tjenestetorgetDeduction) || 0;
    const byttDeduction = parseFloat(agent.byttDeduction) || 0;
    const otherDeductions = parseFloat(agent.otherDeductions) || 0;
    
    // Anvendelse av 5% trekk hvis agent er nylig ansatt (under 9 måneder)
    const fivePercentDeduction = agent.applyFivePercent ? totalWithBonus * 0.05 : 0;
    
    console.log(`Beregner provisjon for ${agent.name}:`, {
      skadePremium: agent.skadePremium,
      livPremium: agent.livPremium,
      skadeCommission,
      livCommission,
      bonusAmount,
      totalBeforeDeductions,
      totalWithBonus,
      applyFivePercent: agent.applyFivePercent,
      fivePercentDeduction,
      tjenestetorgetDeduction,
      byttDeduction,
      otherDeductions
    });
    
    const totalCommission = totalWithBonus - fivePercentDeduction - tjenestetorgetDeduction - byttDeduction - otherDeductions;
    
    return {
      total: totalCommission,
      details: {
        skadeCommission,
        livCommission,
        bonusAmount,
        totalBeforeDeductions,
        totalWithBonus,
        tjenestetorgetDeduction,
        byttDeduction, 
        otherDeductions,
        fivePercentDeduction
      }
    };
  };

  const handleOpenBatchApprovalClick = useCallback((agent) => {
    try {
      console.log("Opening batch approval for agent:", agent);
      
      if (!agent) {
        console.error("Agent data is undefined");
        return;
      }
      
      // Sjekk og logg 5% trekk status
      const monthsEmployed = agent.hireDate ? 
        differenceInMonths(new Date(), new Date(agent.hireDate)) : null;
      
      console.log("Agent employment details:", {
        name: agent.name,
        hireDate: agent.hireDate,
        monthsEmployed,
        applyFivePercent: agent.applyFivePercent,
        reason: monthsEmployed !== null ? 
          (monthsEmployed < 9 ? "Under 9 måneder ansatt" : "Over 9 måneder ansatt") : 
          "Ansettelsesdato mangler"
      });
      
      // Logg full agentdata for debugging
      console.log("Full agent data:", {
        name: agent.name,
        commission: agent.commission,
        originalCommission: agent.originalCommission,
        livCommission: agent.livCommission,
        skadeCommission: agent.skadeCommission,
        bonusAmount: agent.bonusAmount,
        baseCommission: agent.baseCommission,
        totalBeforeTrekk: agent.totalBeforeTrekk,
        trekk: {
          tjenestetorgetDeduction: agent.tjenestetorgetDeduction,
          byttDeduction: agent.byttDeduction,
          otherDeductions: agent.otherDeductions,
          applyFivePercent: agent.applyFivePercent,
          fivePercentDeduction: agent.applyFivePercent ? 
            (agent.totalBeforeTrekk + (agent.bonusAmount || 0)) * 0.05 : 0
        }
      });
      
      // Beregn 5% trekket basert på totalprovisjon med bonus
      const totalBeforeTrekk = agent.totalBeforeTrekk || 
        (agent.livCommission || 0) + (agent.skadeCommission || 0);
      const totalWithBonus = totalBeforeTrekk + (agent.bonusAmount || 0);
      const fivePercentDeduction = agent.applyFivePercent ? totalWithBonus * 0.05 : 0;

      console.log("5% trekk-beregning:", {
        totalBeforeTrekk,
        totalWithBonus,
        applyFivePercent: agent.applyFivePercent,
        fivePercentDeduction,
        bonusAmount: agent.bonusAmount
      });

      const agentData = {
        name: agent.name,
        id: agent.id || agent.agentId,
        agentId: agent.agentId || agent.id,
        company: agent.agent_company || agent.company || managerData?.office,
        
        // Provisjonsdata
        commission: agent.commission || agent.originalCommission || 0,
        livCommission: agent.livCommission || 0,
        skadeCommission: agent.skadeCommission || 0,
        bonusAmount: agent.bonusAmount || 0,
        baseCommission: agent.baseCommission || 0,
        totalBeforeTrekk: totalBeforeTrekk,
        totalWithBonus: totalWithBonus,
        
        // Premier
        skadePremium: agent.skadePremium || 0,
        livPremium: agent.livPremium || 0,
        totalPremium: agent.totalPremium || 0,
        
        // Provisjonssatser
        skadeCommissionRate: agent.skadeCommissionRate || 0,
        livCommissionRate: agent.livCommissionRate || 0,
        
        // Trekk
        tjenestetorgetDeduction: agent.tjenestetorgetDeduction || agent.tjenestetorgetTrekk || 0,
        byttDeduction: agent.byttDeduction || agent.byttTrekk || 0,
        otherDeductions: agent.otherDeductions || agent.andreTrekk || 0,
        fivePercentDeduction: fivePercentDeduction,
        
        // Andre felter
        baseSalary: agent.baseSalary || 0,
        bonus: agent.bonus || 0,
        applyFivePercent: agent.applyFivePercent !== undefined ? agent.applyFivePercent : false,
        salaryModelId: agent.salaryModelId,
        isModified: agent.isModified || false,
        
        // Ansettelsesdata
        hireDate: agent.hireDate,
        monthsEmployed: monthsEmployed,
        
        // Måned og år
        selectedMonth: selectedMonth ? selectedMonth.split('-')[1] : '',
        selectedYear: selectedMonth ? selectedMonth.split('-')[0] : ''
      };
      
      console.log("Prepared agent data for approval:", agentData);
      openBatchApproval(agentData);
    } catch (error) {
      console.error("Error in handleOpenBatchApprovalClick:", error);
    }
  }, [openBatchApproval, managerData]);

  const renderApprovalStatus = useCallback((agent) => {
    console.log(`Rendering approval status for ${agent.name}:`, {
      isApproved: agent.isApproved,
      manager_approved: agent.manager_approved,
      admin_approved: agent.admin_approved,
      approvalStatus: agent.approvalStatus
    });

    if (agent.isApproved) {
      return (
        <Chip
          label="Godkjent"
          color="success"
          size="small"
          icon={<CheckCircle />}
        />
      );
    } else if (agent.manager_approved) {
      return (
        <Chip
          label="Venter på admin"
          color="warning"
          size="small"
          icon={<Warning />}
        />
      );
    } else {
      return (
        <Chip
          label="Ikke godkjent"
          color="error"
          size="small"
          icon={<Warning />}
        />
      );
    }
  }, []);

  const handleApproveCommission = async (agent) => {
    try {
      const isAdmin = managerData?.role === 'admin';
      await handleApproval(
        agent,
        agent.commission,
        "",
        updateAgentPerformance,
        isAdmin
      );
      
      // Oppdater lokale data
      const updatedAgents = localAgentData.map(a => {
        if (a.name === agent.name) {
          return {
            ...a,
            isApproved: isAdmin,
            approvalStatus: isAdmin ? 'approved' : 'pending_admin'
          };
        }
        return a;
      });
      setLocalAgentData(updatedAgents);
      
    } catch (error) {
      console.error('Feil ved godkjenning:', error);
      setSaveError(error.message);
    }
  };

  const formatCurrency = (value) => {
    if (value === undefined || value === null) return '0 kr';
    return `${value.toLocaleString('nb-NO')} kr`;
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

  // Forenklede provisjonsdetaljer for visning i hovedtabellen
  const renderCommissionAmount = (agent) => {
    if (!agent) return null;
    
    // Formater provisjonsbeløpet pent
    const commission = agent.commission || 0;
    
    // Vis både brutto- og nettobeløp hvis vi har 5% trekk
    if (agent.applyFivePercent && agent.fivePercentTrekk > 0) {
      const totalBeforeTrekk = agent.totalBeforeTrekk || 0;
      const fivePercentTrekk = agent.fivePercentTrekk || 0;
      
      return (
        <Box>
          <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
            {commission.toLocaleString('nb-NO')} kr
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            Før 5% trekk: {totalBeforeTrekk.toLocaleString('nb-NO')} kr
          </Typography>
          <Typography variant="caption" color="warning.main" sx={{ display: 'block' }}>
            5% trekk: {fivePercentTrekk.toLocaleString('nb-NO')} kr
          </Typography>
        </Box>
      );
    }
    
    return (
      <Typography variant="body1">
        {commission.toLocaleString('nb-NO')} kr
      </Typography>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
        <TextField 
          placeholder="Søk etter rådgiver..."
          variant="outlined"
          size="small"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
          sx={{ flexGrow: 1 }}
        />
      </Box>
      
      <TableContainer component={Paper}>
        <Table>
            <TableHead>
            <TableRow>
              <TableCell>Navn</TableCell>
              <TableCell>Lønnstrinn</TableCell>
              <TableCell>Skadesalg</TableCell>
              <TableCell>Livsalg</TableCell>
              <TableCell>Trekk (anbud)</TableCell>
              <TableCell>5% trekk</TableCell>
              <TableCell>Provisjon</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Handlinger</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
            {sortedAgents.length > 0 ? (
              sortedAgents.map((agent) => (
                <TableRow key={agent.id}>
                  <TableCell>{agent.name}</TableCell>
                  <TableCell>{agent.salaryModelName}</TableCell>
                  <TableCell>{agent.skadePremium.toLocaleString('no-NO')} kr</TableCell>
                  <TableCell>{agent.livPremium.toLocaleString('no-NO')} kr</TableCell>
                  <TableCell>
                    {(parseFloat(agent.tjenestetorgetDeduction || 0) + 
                      parseFloat(agent.byttDeduction || 0) + 
                      parseFloat(agent.otherDeductions || 0)).toLocaleString('no-NO')} kr
                  </TableCell>
                  <TableCell>
                    {agent.applyFivePercent ? 
                      (agent.fivePercentTrekk || 0).toLocaleString('no-NO') + ' kr' : 
                      'Ikke aktiv'}
                  </TableCell>
                  <TableCell>{renderCommissionAmount(agent)}</TableCell>
                  <TableCell>{renderApprovalStatus(agent)}</TableCell>
                      <TableCell>
                    {!agent.admin_approved && (
                          <Button 
                            variant="contained" 
                            color="primary" 
                            size="small"
                        onClick={() => openBatchApproval(agent)}
                          >
                        Godkjenn provisjon
                          </Button>
                    )}
                      </TableCell>
                    </TableRow>
              ))
              ) : (
                <TableRow>
                <TableCell colSpan={10} align="center">
                  <Typography variant="body1" color="textSecondary">
                    Ingen agenter funnet for dette kontoret
                  </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      
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
                {editingAgent && (
                  <>
                    {editingAgent.monthsEmployed !== null && (
                      <Typography variant="caption" display="block" sx={{ mt: 0.5, mb: 1 }}>
                        {editingAgent.name} har vært ansatt i {editingAgent.monthsEmployed} måneder. 
                        {editingAgent.isNewHire ? 
                          " 5% trekk bør være på for ansatte under 9 måneder." : 
                          " 5% trekk bør være av for ansatte over 9 måneder."}
                      </Typography>
                    )}
                    {editValues.applyFivePercent && (
                      <Alert severity="info" sx={{ mt: 1, fontSize: '0.85rem' }}>
                        5% trekket utgjør ca. {(
                          (editingAgent.skadePremium * (editingAgent.skadeCommissionRate || 0) / 100 + 
                            editingAgent.livPremium * (editingAgent.livCommissionRate || 0) / 100) * 0.05
                        ).toLocaleString('nb-NO')} kr av provisjonen.
                      </Alert>
                    )}
                  </>
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
            onClick={handleSubmitEdit} 
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
