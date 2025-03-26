import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  InputAdornment,
} from '@mui/material';
import {
  History,
  Info,
  Search,
  Add,
  Edit,
  Delete,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import NavigationMenu from './components/NavigationMenu';

function SalaryModelHistory() {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [salaryModels, setSalaryModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [error, setError] = useState(null);
  
  useEffect(() => {
    fetchSalaryModels();
  }, []);
  
  useEffect(() => {
    if (selectedModel) {
      fetchHistory(selectedModel);
    } else {
      setHistory([]);
    }
  }, [selectedModel]);
  
  const fetchSalaryModels = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('salary_models')
        .select('*')
        .order('name');
        
      if (error) throw error;
      
      setSalaryModels(data || []);
      
      // Also fetch all history for initial view
      const { data: historyData, error: historyError } = await supabase
        .from('salary_step_history')
        .select('*')
        .order('changed_at', { ascending: false })
        .limit(50);
        
      if (historyError) throw historyError;
      
      setHistory(historyData || []);
      
    } catch (error) {
      console.error("Error fetching salary models:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchHistory = async (modelId) => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('salary_step_history')
        .select('*')
        .eq('salary_model_id', modelId)
        .order('changed_at', { ascending: false });
        
      if (error) throw error;
      
      setHistory(data || []);
      
    } catch (error) {
      console.error("Error fetching history:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Format date for display
  const formatDate = (dateStr) => {
    if (!dateStr) return "Unknown";
    
    const date = new Date(dateStr);
    return date.toLocaleString('nb-NO', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  
  // Get color and icon for operation type
  const getOperationDetails = (operation) => {
    switch (operation) {
      case 'INSERT':
        return { color: 'success', label: 'Opprettet', icon: <Add fontSize="small" /> };
      case 'UPDATE':
        return { color: 'primary', label: 'Oppdatert', icon: <Edit fontSize="small" /> };
      case 'DELETE':
        return { color: 'error', label: 'Slettet', icon: <Delete fontSize="small" /> };
      default:
        return { color: 'default', label: operation, icon: <Info fontSize="small" /> };
    }
  };

  return (
    <Box sx={{ p: 3, backgroundColor: "#f5f5f5", minHeight: "100vh" }}>
      <NavigationMenu />
      
      <Paper elevation={2} sx={{ p: 3, borderRadius: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center' }}>
            <History sx={{ mr: 1 }} color="primary" />
            Lønnstrinn Historikk
          </Typography>
        </Box>
        
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
        )}
        
        {/* Filter controls */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Velg lønnstrinn</InputLabel>
              <Select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                label="Velg lønnstrinn"
                startAdornment={
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                }
              >
                <MenuItem value="">Vis alle historikken</MenuItem>
                {salaryModels.map(model => (
                  <MenuItem key={model.id} value={model.id}>{model.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
        
        {/* History table */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : history.length === 0 ? (
          <Alert severity="info">Ingen historikk funnet</Alert>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Lønnstrinn</TableCell>
                  <TableCell>Endret av</TableCell>
                  <TableCell>Tidspunkt</TableCell>
                  <TableCell>Operasjon</TableCell>
                  <TableCell>Grunnlønn</TableCell>
                  <TableCell>Provisjon Liv</TableCell>
                  <TableCell>Provisjon Skade</TableCell>
                  <TableCell>Bonus</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {history.map((item) => {
                  const opDetails = getOperationDetails(item.operation);
                  return (
                    <TableRow key={item.id} hover>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{item.changed_by}</TableCell>
                      <TableCell>{formatDate(item.changed_at)}</TableCell>
                      <TableCell>
                        <Chip 
                          icon={opDetails.icon}
                          label={opDetails.label}
                          color={opDetails.color}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>{item.base_salary?.toLocaleString('nb-NO')} kr</TableCell>
                      <TableCell>{item.commission_liv}%</TableCell>
                      <TableCell>{item.commission_skade}%</TableCell>
                      <TableCell>
                        {item.bonus_enabled ? (
                          <Tooltip title={`Terskel: ${item.bonus_threshold?.toLocaleString('nb-NO')} kr, Liv: +${item.bonus_percentage_liv}%, Skade: +${item.bonus_percentage_skade}%`}>
                            <Chip 
                              label="Aktivert"
                              color="warning"
                              size="small"
                              variant="outlined"
                            />
                          </Tooltip>
                        ) : (
                          <Chip 
                            label="Ikke aktivert"
                            color="default"
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
}

export default SalaryModelHistory;
