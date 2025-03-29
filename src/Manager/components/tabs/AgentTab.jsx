import React, { useState } from 'react';
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
  Alert
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
import { useTheme } from '@mui/material/styles';
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
          apply_five_percent_deduction: editValues.applyFivePercent 
        })
        .eq('id', employeeData.id);
      
      if (updateError) {
        throw new Error(`Kunne ikke oppdatere 5% trekk: ${updateError.message}`);
      }
      
      const updatedAgentPerformance = agentPerformance.map(agent => 
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
              sickLeave: editValues.sickLeave || ""
            } 
          : agent
      );
      
      if (updateAgentPerformance) {
        updateAgentPerformance(updatedAgentPerformance);
      }
      
      console.log("Changes saved successfully for agent:", editingAgent.name);
      console.log("Updated values:", editValues);
      
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
      
      const updatedAgentPerformance = agentPerformance.map(a => 
        a.name === agent.name ? { ...a, applyFivePercent: !currentValue } : a
      );
      
      if (updateAgentPerformance) {
        updateAgentPerformance(updatedAgentPerformance);
      }
      
      console.log(`5% deduction for ${agent.name} changed to: ${!currentValue}`);
    } catch (error) {
      console.error('Error toggling 5% deduction:', error);
    }
  };

  const sortedAgents = () => {
    if (!agentPerformance || agentPerformance.length === 0) {
      return [];
    }
    
    const filteredAgents = agentPerformance.filter(agent => {
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

  // Calculate total commission for an agent
  const calculateTotalCommission = (agent) => {
    // Calculate base commissions
    const skadeCommission = agent.skadePremium * (agent.skadeCommissionRate || 0) / 100;
    const livCommission = agent.livPremium * (agent.livCommissionRate || 0) / 100;
    
    // Calculate total base commission
    const baseCommission = skadeCommission + livCommission;
    
    // Apply 5% deduction if enabled
    const fivePercentDeduction = agent.applyFivePercent ? baseCommission * 0.05 : 0;
    
    // Other deductions
    const otherDeductions = 
      (agent.tjenestetorgetDeduction || 0) + 
      (agent.byttDeduction || 0) + 
      (agent.otherDeductions || 0);
    
    // Calculate final commission amount
    const totalCommission = baseCommission - fivePercentDeduction - otherDeductions;
    
    return {
      livCommission,
      skadeCommission,
      baseCommission,
      fivePercentDeduction,
      otherDeductions,
      totalCommission
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
      
      <TableContainer sx={{ maxHeight: 600 }}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell onClick={() => requestSort('ranking')} sx={{ cursor: 'pointer' }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  #
                  {getSortIcon('ranking')}
                </Box>
              </TableCell>
              
              <TableCell onClick={() => requestSort('salaryModelName')} sx={{ cursor: 'pointer', minWidth: 120 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  Lønnstrinn / Stilling
                  {getSortIcon('salaryModelName')}
                </Box>
              </TableCell>
              
              <TableCell onClick={() => requestSort('name')} sx={{ cursor: 'pointer', minWidth: 150 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  Navn
                  {getSortIcon('name')}
                </Box>
              </TableCell>
              
              <TableCell onClick={() => requestSort('skadePremium')} align="right" sx={{ cursor: 'pointer' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                  Skadesalg
                  {getSortIcon('skadePremium')}
                </Box>
              </TableCell>
              
              <TableCell onClick={() => requestSort('livPremium')} align="right" sx={{ cursor: 'pointer' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                  Livsalg
                  {getSortIcon('livPremium')}
                </Box>
              </TableCell>
              
              <TableCell align="right" sx={{ minWidth: 120 }}>
                Skadeprovisjon %
              </TableCell>
              
              <TableCell align="right" sx={{ minWidth: 120 }}>
                Livprovisjon %
              </TableCell>
              
              <TableCell align="right">
                Anbud Tjenestetorget
              </TableCell>
              
              <TableCell align="right">
                Anbud Bytt
              </TableCell>
              
              <TableCell align="right">
                Andre anbud
              </TableCell>
              
              <TableCell onClick={() => requestSort('totalCommission')} align="right" sx={{ cursor: 'pointer', minWidth: 140 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                  Total provisjon
                  {getSortIcon('totalCommission')}
                </Box>
              </TableCell>
              
              <TableCell align="right">
                Fastlønn
              </TableCell>
              
              <TableCell align="right">
                Bonus
              </TableCell>
              
              <TableCell align="center">
                Egenmelding
              </TableCell>
              
              <TableCell align="center">
                5% trekk
              </TableCell>
              
              <TableCell align="center">
                Handlinger
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedAgents().length === 0 ? (
              <TableRow>
                <TableCell colSpan={16} align="center">
                  Ingen agenter funnet
                </TableCell>
              </TableRow>
            ) : (
              sortedAgents().map(agent => {
                const isSkadeRateOverridden = agent.overriddenSkadeRate;
                const isLivRateOverridden = agent.overriddenLivRate;
                const isDeductionsOverridden = agent.overriddenDeductions;
                
                const commissionDetails = calculateTotalCommission(agent);
                
                return (
                  <TableRow key={agent.id} hover>
                    <TableCell>
                      <Chip 
                        size="small" 
                        label={agent.ranking} 
                        color={
                          agent.ranking === 1 ? "success" :
                          agent.ranking === 2 ? "primary" :
                          agent.ranking === 3 ? "secondary" : 
                          "default"
                        }
                        variant="filled"
                        sx={{ 
                          minWidth: '30px', 
                          fontWeight: 'bold',
                          ...(agent.ranking <= 3 ? { color: 'white' } : {})
                        }}
                      />
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
                    
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Avatar sx={{ 
                          width: 32, 
                          height: 32, 
                          mr: 1, 
                          bgcolor: agent.ranking <= 3 
                            ? CHART_COLORS[agent.ranking - 1] 
                            : '#bdbdbd'
                        }}>
                          {agent.name.substring(0, 1)}
                        </Avatar>
                        {agent.name}
                      </Box>
                    </TableCell>
                    
                    <TableCell align="right">
                      {(agent.skadePremium || 0).toLocaleString('nb-NO')} kr
                    </TableCell>
                    
                    <TableCell align="right">
                      {(agent.livPremium || 0).toLocaleString('nb-NO')} kr
                    </TableCell>
                    
                    <TableCell align="right">
                      <Box sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'flex-end',
                        color: isSkadeRateOverridden ? theme.palette.error.main : 'inherit',
                        fontWeight: isSkadeRateOverridden ? 'bold' : 'normal',
                      }}>
                        {agent.skadeCommissionRate || "-"}%
                        {isSkadeRateOverridden && 
                          <Tooltip title="Overstyrt verdi">
                            <Warning fontSize="small" color="error" sx={{ ml: 0.5 }} />
                          </Tooltip>
                        }
                      </Box>
                    </TableCell>
                    
                    <TableCell align="right">
                      <Box sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'flex-end',
                        color: isLivRateOverridden ? theme.palette.error.main : 'inherit',
                        fontWeight: isLivRateOverridden ? 'bold' : 'normal',
                      }}>
                        {agent.livCommissionRate || "-"}%
                        {isLivRateOverridden && 
                          <Tooltip title="Overstyrt verdi">
                            <Warning fontSize="small" color="error" sx={{ ml: 0.5 }} />
                          </Tooltip>
                        }
                      </Box>
                    </TableCell>
                    
                    <TableCell align="right">
                      {(agent.tjenestetorgetDeduction || 0).toLocaleString('nb-NO')} kr
                    </TableCell>
                    
                    <TableCell align="right">
                      {(agent.byttDeduction || 0).toLocaleString('nb-NO')} kr
                    </TableCell>
                    
                    <TableCell align="right">
                      <Box sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'flex-end',
                        color: isDeductionsOverridden ? theme.palette.error.main : 'inherit',
                        fontWeight: isDeductionsOverridden ? 'bold' : 'normal',
                      }}>
                        {(agent.otherDeductions || 0).toLocaleString('nb-NO')} kr
                        {isDeductionsOverridden && 
                          <Tooltip title="Overstyrt verdi">
                            <Warning fontSize="small" color="error" sx={{ ml: 0.5 }} />
                          </Tooltip>
                        }
                      </Box>
                    </TableCell>
                    
                    <TableCell align="right" sx={{ fontWeight: 'bold', color: theme.palette.success.main }}>
                      <Box>
                        {commissionDetails.totalCommission.toLocaleString('nb-NO')} kr
                        
                        {agent.applyFivePercent && commissionDetails.fivePercentDeduction > 0 && (
                          <Typography 
                            variant="caption" 
                            display="block" 
                            color="text.secondary"
                            sx={{ fontSize: '0.7rem' }}
                          >
                            (-5%: {commissionDetails.fivePercentDeduction.toLocaleString('nb-NO')} kr)
                          </Typography>
                        )}
                      </Box>
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
