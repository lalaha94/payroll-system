import React, { useState, useEffect } from 'react';
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
  Warning
} from '@mui/icons-material';
import { useTheme, alpha } from '@mui/material/styles';
import { format, differenceInMonths } from 'date-fns';
import { supabase } from '../../../supabaseClient';

const AgentTab = ({ agentPerformance, updateAgentPerformance, CHART_COLORS, salaryModels }) => {
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

  useEffect(() => {
    if (agentPerformance && agentPerformance.length > 0) {
      if (isInitialLoad || 
          !localAgentData.length || 
          !agentPerformance.every(agent => 
            localAgentData.some(localAgent => localAgent.id === agent.id)
          )) {
        fetchAgentDetails();
      } else {
        const mergedData = agentPerformance.map(agent => {
          const existingAgent = localAgentData.find(a => a.id === agent.id || a.name === agent.name);
          if (existingAgent) {
            return {
              ...agent,
              skadeCommissionRate: existingAgent.skadeCommissionRate || agent.skadeCommissionRate,
              livCommissionRate: existingAgent.livCommissionRate || agent.livCommissionRate,
              tjenestetorgetDeduction: existingAgent.tjenestetorgetDeduction || agent.tjenestetorgetDeduction || 0,
              byttDeduction: existingAgent.byttDeduction || agent.byttDeduction || 0,
              otherDeductions: existingAgent.otherDeductions || agent.otherDeductions || 0,
              baseSalary: existingAgent.baseSalary || agent.baseSalary || 0,
              bonus: existingAgent.bonus || agent.bonus || 0,
              sickLeave: existingAgent.sickLeave || agent.sickLeave || "",
              applyFivePercent: existingAgent.applyFivePercent !== undefined ? existingAgent.applyFivePercent : agent.applyFivePercent
            };
          }
          return agent;
        });
        setLocalAgentData(mergedData);
        
        if (updateAgentPerformance) {
          updateAgentPerformance(mergedData);
        }
      }
    }
  }, [agentPerformance]);

  const fetchAgentDetails = async () => {
    try {
      const { data: employees, error } = await supabase
        .from('employees')
        .select('*');
      
      if (error) {
        console.error('Error fetching employee details:', error);
        return;
      }
      
      const mergedData = agentPerformance.map(agent => {
        const employeeMatch = employees.find(emp => 
          emp.name === agent.name || emp.agent_id === agent.agent_id
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
                true)
          };
        }
        return agent;
      });
      
      setLocalAgentData(mergedData);
      
      if (updateAgentPerformance) {
        updateAgentPerformance(mergedData);
      }
      
      setIsInitialLoad(false);
    } catch (err) {
      console.error('Error processing agent details:', err);
    }
  };

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
      
      if (updateAgentPerformance) {
        updateAgentPerformance(updatedAgentPerformance);
      }
      
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
      
      if (updateAgentPerformance) {
        updateAgentPerformance(updatedAgentPerformance);
      }
      
      console.log(`5% deduction for ${agent.name} changed to: ${!currentValue}`);
    } catch (error) {
      console.error('Error toggling 5% deduction:', error);
    }
  };

  const sortedAgents = () => {
    if (!localAgentData || localAgentData.length === 0) {
      return [];
    }
    
    const filteredAgents = localAgentData.filter(agent => {
      if (!agent || !agent.name) return false;
      return agent.name.toLowerCase().includes(searchTerm.toLowerCase());
    });
    
    return [...filteredAgents].sort((a, b) => {
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

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" fontWeight="bold">
          
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
                        <IconButton 
                          size="small" 
                          color="primary" 
                          onClick={() => handleOpenEditDialog(agent)}
                        >
                          <Edit fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={16} align="center">
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
