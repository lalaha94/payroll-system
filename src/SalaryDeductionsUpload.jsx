import React, { useState, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";
import { Link } from "react-router-dom";
import * as XLSX from 'xlsx';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  Alert,
  AlertTitle,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import {
  CloudUpload,
  Delete,
  Edit,
  FilterAlt,
  Refresh,
  Search,
  Save,
  Cancel,
  Receipt,
  UploadFile,
  FilePresent,
  InsertDriveFile,
  Close,
} from "@mui/icons-material";
import { useTheme } from "@mui/material/styles";
import NavigationMenu from "./components/NavigationMenu";

function SalaryDeductionsUpload() {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [deductions, setDeductions] = useState([]);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [deductionType, setDeductionType] = useState("");
  
  // Form state for new deduction
  const [newDeduction, setNewDeduction] = useState({
    employee_id: "",
    name: "",
    type: "",
    amount: "",
    percentage: "",
    description: "",
    is_recurring: true,
  });

  // State for edited deduction
  const [editedDeduction, setEditedDeduction] = useState({});

  // Excel upload states
  const [excelFile, setExcelFile] = useState(null);
  const [excelFileName, setExcelFileName] = useState("");
  const [parsedData, setParsedData] = useState([]);
  const [processingUpload, setProcessingUpload] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);

  // Add state for employees list
  const [employees, setEmployees] = useState([]);
  
  // Dialog states
  const [excelDialogOpen, setExcelDialogOpen] = useState(false);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);

  useEffect(() => {
    fetchDeductions();
    fetchEmployees();
  }, []);

  const fetchDeductions = async () => {
    setLoading(true);
    setUploadError(null);
    
    // Retry logikk - prøv opptil 3 ganger med 1 sekunds pause mellom hvert forsøk
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        attempts++;
        const { data, error } = await supabase.from("salary_deductions").select("*");
        
        if (error) {
          throw error;
        }
        
        setDeductions(data || []);
        setLoading(false);
        return; // Vellykket, avslutt funksjonen
        
      } catch (error) {
        console.error(`Forsøk ${attempts}/${maxAttempts} - Error fetching deductions:`, error);
        
        // Hvis dette var siste forsøk, vis feilmelding
        if (attempts === maxAttempts) {
          setUploadError("Kunne ikke hente lønnstrekk data. Vennligst prøv igjen senere.");
          setLoading(false);
          return;
        }
        
        // Vent 1 sekund før neste forsøk
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  };

  // Add function to fetch employees
  const fetchEmployees = async () => {
    setUploadError(null);
    
    // Retry logikk - prøv opptil 3 ganger med 1 sekunds pause mellom hvert forsøk
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        attempts++;
        const { data, error } = await supabase.from("employees").select("id,name,agent_id");
        
        if (error) {
          throw error;
        }
        
        setEmployees(data || []);
        return; // Vellykket, avslutt funksjonen
        
      } catch (error) {
        console.error(`Forsøk ${attempts}/${maxAttempts} - Error fetching employees:`, error);
        
        // Hvis dette var siste forsøk, vis feilmelding
        if (attempts === maxAttempts) {
          setUploadError("Kunne ikke hente ansatte data. Vennligst prøv igjen senere.");
          return;
        }
        
        // Vent 1 sekund før neste forsøk
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewDeduction({
      ...newDeduction,
      [name]: name === "amount" || name === "percentage" ? parseFloat(value) || "" : value,
    });
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditedDeduction({
      ...editedDeduction,
      [name]: name === "amount" || name === "percentage" ? parseFloat(value) || "" : value,
    });
  };

  // Endret funksjon for å hente ansattnavn basert på ID
  const getEmployeeName = (deduction) => {
    // Først prøver vi å finne ansatt via agent_id
    const employee = employees.find(emp => emp.agent_id === deduction.employee_id);
    if (employee) return employee.name;
    
    // Fallback: Prøv å finne ansatt via id
    const employeeById = employees.find(emp => emp.id === deduction.employee_id);
    if (employeeById) return employeeById.name;
    
    // Hvis vi ikke finner noe, returner ID
    return deduction.employee_id;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setUploadSuccess(false);
    setUploadError(null);
    
    // Validate inputs
    if (!newDeduction.employee_id || !newDeduction.type || (!newDeduction.amount && !newDeduction.percentage)) {
      setUploadError("Vennligst fyll inn alle påkrevde felt");
      setLoading(false);
      return;
    }
    
    try {
      // Prepare data for submission - Find the selected employee
      const selectedEmployee = employees.find(emp => emp.name === newDeduction.employee_id);
      
      const deductionData = {
        ...newDeduction,
        // Use the agent_id instead of the employee id when possible
        employee_id: selectedEmployee ? (selectedEmployee.agent_id || selectedEmployee.id) : newDeduction.employee_id,
        // Ensure empty strings are converted to null for numeric fields
        amount: newDeduction.amount || null,
        percentage: newDeduction.percentage || null,
        created_at: new Date(),
      };
      
      console.log("Sending deduction data:", deductionData);
      
      const { data, error } = await supabase
        .from("salary_deductions")
        .insert([deductionData]);
      
      if (error) {
        console.error("Error uploading deduction:", error.message, error.details, error.hint, error);
        setUploadError(`Feil ved opplasting: ${error.message}${error.details ? ` (${error.details})` : ''}`);
      } else {
        setUploadSuccess(true);
        setNewDeduction({
          employee_id: "",
          name: "",
          type: "",
          amount: "",
          percentage: "",
          description: "",
          is_recurring: true,
        });
        fetchDeductions();
        // Lukk dialogen etter vellykket opplasting
        setTimeout(() => {
          setManualDialogOpen(false);
          setUploadSuccess(false);
        }, 1500);
      }
    } catch (e) {
      console.error("Exception during submission:", e);
      setUploadError(`Uventet feil: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (deduction) => {
    setEditingId(deduction.id);
    setEditedDeduction({ ...deduction });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditedDeduction({});
  };

  const saveEdit = async () => {
    setLoading(true);
    
    try {
      // Ensure empty strings are converted to null for numeric fields
      const updatedDeduction = {
        ...editedDeduction,
        amount: editedDeduction.amount || null,
        percentage: editedDeduction.percentage || null
      };
      
      const { data, error } = await supabase
        .from("salary_deductions")
        .update(updatedDeduction)
        .eq("id", editingId);
      
      if (error) {
        console.error("Error updating deduction:", error);
        setUploadError(`Feil ved oppdatering: ${error.message}`);
      } else {
        fetchDeductions();
        setEditingId(null);
        setEditedDeduction({});
      }
    } catch (e) {
      console.error("Exception during update:", e);
      setUploadError(`Uventet feil ved oppdatering: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const deleteDeduction = async (id) => {
    if (window.confirm("Er du sikker på at du vil slette dette lønnstrekket?")) {
      setLoading(true);
      
      const { error } = await supabase
        .from("salary_deductions")
        .delete()
        .eq("id", id);
      
      if (error) {
        console.error("Error deleting deduction:", error);
        setUploadError(`Feil ved sletting: ${error.message}`);
      } else {
        fetchDeductions();
      }
      
      setLoading(false);
    }
  };

  // Excel file handler
  const handleExcelFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check file type
    const fileExt = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(fileExt)) {
      setUploadError('Vennligst last opp en Excel-fil (.xlsx, .xls eller .csv)');
      return;
    }

    setExcelFile(file);
    setExcelFileName(file.name);
    setUploadError(null);
    
    // Start processing the file
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const worksheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[worksheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });
        
        // Process the data
        processExcelData(jsonData);
      } catch (error) {
        console.error("Error parsing Excel file:", error);
        setUploadError(`Kunne ikke lese Excel-filen: ${error.message}`);
      }
    };
    
    reader.onerror = (error) => {
      console.error("Error reading file:", error);
      setUploadError('Feil ved lesing av filen');
    };
    
    reader.readAsBinaryString(file);
  };

  const processExcelData = (jsonData) => {
    try {
      // Find header row - expecting "Setup id", "Avdelingsnr", "Setup name", "Count", "Setup Sum"
      const headerRow = jsonData.findIndex(row => {
        if (!row || row.length < 5) return false;
        
        const headers = row.map(h => String(h).toLowerCase().trim());
        return headers.includes('setup id') && 
              headers.includes('avdelingsnr') && 
              headers.includes('setup name') && 
              headers.includes('count') && 
              headers.includes('setup sum');
      });

      if (headerRow === -1) {
        throw new Error("Kunne ikke finne forventet header-rad i Excel-filen");
      }
      
      const headers = jsonData[headerRow].map(h => String(h).toLowerCase().trim());
      const setupIdIdx = headers.indexOf('setup id');
      const deptIdx = headers.indexOf('avdelingsnr');
      const nameIdx = headers.indexOf('setup name');
      const countIdx = headers.indexOf('count');
      const sumIdx = headers.indexOf('setup sum');
      
      // Extract data rows (skip header)
      const dataRows = jsonData.slice(headerRow + 1).filter(row => 
        row && row.length >= 5 && row[nameIdx] && row[sumIdx]
      );
      
      // Skip TOTAL row if present
      const filteredRows = dataRows.filter(row => 
        String(row[nameIdx]).toLowerCase().trim() !== 'total'
      );
      
      // Transform to our data format
      const parsedDeductions = filteredRows.map((row, index) => ({
        id: `temp-${index}`,
        employee_id: row[nameIdx] || '', // Use name as employee ID for now
        name: `Lønnstrekk ${row[nameIdx]}`,
        type: "Annet", // Default type
        amount: parseFloat(String(row[sumIdx]).replace(/,/g, '.')),
        setup_id: row[setupIdIdx],
        department: row[deptIdx],
        count: row[countIdx],
        description: `Automatisk importert fra Excel. Setup ID: ${row[setupIdIdx]}, Antall: ${row[countIdx]}`,
        is_recurring: false,
        source: "excel-import",
        created_at: new Date()
      }));
      
      // Set the parsed data
      setParsedData(parsedDeductions);
      
      // Show success message
      if (parsedDeductions.length > 0) {
        setUploadSuccess(true);
      } else {
        setUploadError("Ingen gyldige data funnet i filen");
      }
    } catch (error) {
      console.error("Error processing Excel data:", error);
      setUploadError(`Feil ved behandling av data: ${error.message}`);
      setParsedData([]);
    }
  };

  const handleUploadParsedData = async () => {
    if (!parsedData.length) {
      setUploadError("Ingen data å laste opp");
      return;
    }
    
    setProcessingUpload(true);
    setUploadProgress(0);
    
    try {
      // Upload in batches to prevent timeouts and show progress
      const batchSize = 20;
      const totalBatches = Math.ceil(parsedData.length / batchSize);
      
      for (let i = 0; i < parsedData.length; i += batchSize) {
        const batch = parsedData.slice(i, i + batchSize);
        
        // Remove temp IDs before insert and ensure numeric fields are properly handled
        const batchToInsert = batch.map(({ id, ...rest }) => ({
          ...rest,
          amount: rest.amount || null,
          percentage: rest.percentage || null
        }));
        
        // Retry logikk for hver batch
        let batchAttempts = 0;
        const maxBatchAttempts = 3;
        let success = false;
        
        while (batchAttempts < maxBatchAttempts && !success) {
          try {
            batchAttempts++;
            
            const { data, error } = await supabase
              .from("salary_deductions")
              .insert(batchToInsert);
            
            if (error) {
              throw error;
            }
            
            success = true;
          } catch (error) {
            console.error(`Batch ${i/batchSize + 1}/${totalBatches}, forsøk ${batchAttempts}/${maxBatchAttempts} - Error:`, error);
            
            if (batchAttempts === maxBatchAttempts) {
              throw error; // Kast feilen videre etter alle forsøk
            }
            
            // Vent 1 sekund før neste forsøk
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        
        // Update progress
        const progress = Math.round(((i + batch.length) / parsedData.length) * 100);
        setUploadProgress(progress);
      }
      
      // Success
      setUploadSuccess(true);
      setParsedData([]);
      setExcelFile(null);
      setExcelFileName("");
      
      // Refresh the deductions list
      fetchDeductions();

      // Lukk dialogen etter vellykket opplasting
      setTimeout(() => {
        setExcelDialogOpen(false);
        setUploadSuccess(false);
      }, 1500);
      
    } catch (error) {
      console.error("Error uploading deductions:", error);
      setUploadError(`Feil ved opplasting: ${error.message || 'Nettverksfeil - prøv igjen senere'}`);
    } finally {
      setProcessingUpload(false);
      setUploadProgress(0);
    }
  };

  const cancelExcelUpload = () => {
    setParsedData([]);
    setExcelFile(null);
    setExcelFileName("");
    setUploadError(null);
    setUploadSuccess(false);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Filter deductions based on search term and type
  const filteredDeductions = deductions.filter((deduction) => {
    return (
      (searchTerm === "" || 
       (deduction.name && deduction.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
       (deduction.employee_id && deduction.employee_id.toString().includes(searchTerm)) ||
       (deduction.description && deduction.description.toLowerCase().includes(searchTerm.toLowerCase()))
      ) &&
      (deductionType === "" || deduction.type === deductionType)
    );
  });

  // Group deduction types for filter dropdown
  const deductionTypes = [...new Set(deductions.map(d => d.type))].filter(Boolean);

  return (
    <Box sx={{ 
      p: 3, 
      backgroundColor: "#f5f5f5", 
      minHeight: "100vh",
      pt: { xs: 10, sm: 11, md: 12 } // Add padding-top to push content below navigation
    }}>
      <NavigationMenu />

      <Grid container spacing={3}>
        {/* Deductions List */}
        <Grid item xs={12}>
          <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center' }}>
                <Receipt sx={{ mr: 1 }} color="primary" />
                Registrerte lønnstrekk
              </Typography>
              
              <Box>
                <Button 
                  variant="outlined" 
                  startIcon={<UploadFile />} 
                  size="small"
                  sx={{ mr: 1 }}
                  onClick={() => setExcelDialogOpen(true)}
                >
                  Last opp Excel-fil med lønnstrekk
                </Button>

                <Button 
                  variant="outlined" 
                  startIcon={<Receipt />} 
                  size="small"
                  sx={{ mr: 1 }}
                  onClick={() => setManualDialogOpen(true)}
                >
                  Registrer nytt lønnstrekk manuelt
                </Button>

                <Tooltip title="Oppdater data">
                  <IconButton onClick={fetchDeductions} color="primary" size="small">
                    <Refresh />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
            
            {/* Filter controls */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={8}>
                <TextField
                  placeholder="Søk etter navn, ansatt ID eller beskrivelse..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  fullWidth
                  size="small"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search color="action" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Filter etter type</InputLabel>
                  <Select
                    value={deductionType}
                    onChange={(e) => setDeductionType(e.target.value)}
                    label="Filter etter type"
                  >
                    <MenuItem value="">Alle typer</MenuItem>
                    {deductionTypes.map((type) => (
                      <MenuItem key={type} value={type}>
                        {type}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Ansatt ID</TableCell>
                      <TableCell>Navn</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Beløp</TableCell>
                      <TableCell>%</TableCell>
                      <TableCell>Gjentagende</TableCell>
                      <TableCell>Handlinger</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredDeductions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} align="center">
                          Ingen lønnstrekk funnet
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredDeductions.map((deduction) => (
                        <TableRow key={deduction.id}>
                          {editingId === deduction.id ? (
                            // Edit mode
                            <>
                              <TableCell>
                                <TextField
                                  name="employee_id"
                                  value={editedDeduction.employee_id || ""}
                                  onChange={handleEditChange}
                                  size="small"
                                  fullWidth
                                />
                              </TableCell>
                              <TableCell>
                                <TextField
                                  name="name"
                                  value={editedDeduction.name || ""}
                                  onChange={handleEditChange}
                                  size="small"
                                  fullWidth
                                />
                              </TableCell>
                              <TableCell>
                                <FormControl fullWidth size="small">
                                  <Select
                                    name="type"
                                    value={editedDeduction.type || ""}
                                    onChange={handleEditChange}
                                  >
                                    <MenuItem value="Skatt">Skatt</MenuItem>
                                    <MenuItem value="Pensjon">Pensjon</MenuItem>
                                    <MenuItem value="Fagforening">Fagforening</MenuItem>
                                    <MenuItem value="Forsikring">Forsikring</MenuItem>
                                    <MenuItem value="Annet">Annet</MenuItem>
                                  </Select>
                                </FormControl>
                              </TableCell>
                              <TableCell>
                                <TextField
                                  name="amount"
                                  type="number"
                                  value={editedDeduction.amount || ""}
                                  onChange={handleEditChange}
                                  size="small"
                                  fullWidth
                                  InputProps={{
                                    endAdornment: <InputAdornment position="end">kr</InputAdornment>,
                                  }}
                                />
                              </TableCell>
                              <TableCell>
                                <TextField
                                  name="percentage"
                                  type="number"
                                  value={editedDeduction.percentage || ""}
                                  onChange={handleEditChange}
                                  size="small"
                                  fullWidth
                                  InputProps={{
                                    endAdornment: <InputAdornment position="end">%</InputAdornment>,
                                  }}
                                />
                              </TableCell>
                              <TableCell>
                                <FormControl fullWidth size="small">
                                  <Select
                                    name="is_recurring"
                                    value={editedDeduction.is_recurring}
                                    onChange={handleEditChange}
                                  >
                                    <MenuItem value={true}>Ja</MenuItem>
                                    <MenuItem value={false}>Nei</MenuItem>
                                  </Select>
                                </FormControl>
                              </TableCell>
                              <TableCell>
                                <Stack direction="row" spacing={1}>
                                  <IconButton size="small" color="primary" onClick={saveEdit}>
                                    <Save fontSize="small" />
                                  </IconButton>
                                  <IconButton size="small" color="default" onClick={cancelEdit}>
                                    <Cancel fontSize="small" />
                                  </IconButton>
                                </Stack>
                              </TableCell>
                            </>
                          ) : (
                            // View mode
                            <>
                              <TableCell>
                                {getEmployeeName(deduction)}
                              </TableCell>
                              <TableCell>{deduction.name}</TableCell>
                              <TableCell>
                                <Chip 
                                  label={deduction.type} 
                                  size="small" 
                                  color={
                                    deduction.type === "Skatt" ? "error" :
                                    deduction.type === "Pensjon" ? "primary" :
                                    deduction.type === "Fagforening" ? "info" :
                                    deduction.type === "Forsikring" ? "success" :
                                    "default"
                                  }
                                  variant="outlined"
                                />
                              </TableCell>
                              <TableCell>
                                {deduction.amount ? `${deduction.amount.toLocaleString('nb-NO')} kr` : '-'}
                              </TableCell>
                              <TableCell>
                                {deduction.percentage ? `${deduction.percentage}%` : '-'}
                              </TableCell>
                              <TableCell>
                                <Chip 
                                  label={deduction.is_recurring ? "Ja" : "Nei"} 
                                  size="small"
                                  color={deduction.is_recurring ? "success" : "warning"}
                                  variant="outlined"
                                />
                              </TableCell>
                              <TableCell>
                                <Stack direction="row" spacing={1}>
                                  <IconButton size="small" color="primary" onClick={() => startEdit(deduction)}>
                                    <Edit fontSize="small" />
                                  </IconButton>
                                  <IconButton size="small" color="error" onClick={() => deleteDeduction(deduction.id)}>
                                    <Delete fontSize="small" />
                                  </IconButton>
                                </Stack>
                              </TableCell>
                            </>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Grid>
        
        {/* Preview Data */}
        {parsedData.length > 0 && (
          <Grid item xs={12}>
            <Paper elevation={2} sx={{ p: 3, borderRadius: 2, mt: 3 }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ mb: 3, display: 'flex', alignItems: 'center' }}>
                <FilePresent sx={{ mr: 1 }} color="primary" />
                Forhåndsvisning av data fra Excel ({parsedData.length} rader)
              </Typography>
              
              <TableContainer sx={{ maxHeight: 400 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Setup ID</TableCell>
                      <TableCell>Avdeling</TableCell>
                      <TableCell>Ansatt</TableCell>
                      <TableCell align="right">Antall</TableCell>
                      <TableCell align="right">Beløp (kr)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {parsedData.slice(0, 100).map((row) => (
                      <TableRow key={row.id} hover>
                        <TableCell>{row.setup_id}</TableCell>
                        <TableCell>{row.department}</TableCell>
                        <TableCell>{row.employee_id}</TableCell>
                        <TableCell align="right">{row.count}</TableCell>
                        <TableCell align="right">{row.amount.toLocaleString('nb-NO')}</TableCell>
                      </TableRow>
                    ))}
                    {parsedData.length > 100 && (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          <Typography variant="body2" color="text.secondary">
                            Viser 100 av {parsedData.length} rader
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        )}
      </Grid>

      {/* Excel Upload Dialog */}
      <Dialog 
        open={excelDialogOpen} 
        onClose={() => {
          if (!processingUpload) setExcelDialogOpen(false);
        }}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <InsertDriveFile sx={{ mr: 1 }} color="primary" />
            <Typography variant="h6">Last opp Excel-fil med lønnstrekk</Typography>
          </Box>
          <IconButton 
            onClick={() => {
              if (!processingUpload) setExcelDialogOpen(false);
            }}
            disabled={processingUpload}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {uploadSuccess && !parsedData.length && (
            <Alert severity="success" sx={{ mb: 3 }}>
              <AlertTitle>Suksess</AlertTitle>
              Data ble lastet opp og behandlet
            </Alert>
          )}
          
          {uploadError && (
            <Alert severity="error" sx={{ mb: 3 }}>
              <AlertTitle>Feil</AlertTitle>
              {uploadError}
            </Alert>
          )}
          
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <Button
                variant="outlined"
                component="label"
                startIcon={<UploadFile />}
                fullWidth
                sx={{ py: 1.5 }}
                disabled={processingUpload}
              >
                Velg Excel-fil
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  hidden
                  onChange={handleExcelFileUpload}
                />
              </Button>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                {excelFileName ? (
                  <Chip
                    icon={<FilePresent />}
                    label={excelFileName}
                    variant="outlined"
                    onDelete={cancelExcelUpload}
                    sx={{ maxWidth: '100%', overflow: 'hidden' }}
                  />
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Ingen fil valgt
                  </Typography>
                )}
              </Box>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Button
                variant="contained"
                color="primary"
                startIcon={<CloudUpload />}
                fullWidth
                sx={{ py: 1.5 }}
                onClick={handleUploadParsedData}
                disabled={!parsedData.length || processingUpload}
              >
                {processingUpload ? "Laster opp..." : "Last opp data"}
              </Button>
            </Grid>
            
            {processingUpload && (
              <Grid item xs={12}>
                <Box sx={{ width: '100%', mt: 2 }}>
                  <LinearProgress variant="determinate" value={uploadProgress} />
                  <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 1 }}>
                    {`${uploadProgress}% fullført`}
                  </Typography>
                </Box>
              </Grid>
            )}
            
            {parsedData.length > 0 && (
              <Grid item xs={12}>
                <Alert severity="info" sx={{ mt: 2 }}>
                  <AlertTitle>Klargjort for opplasting</AlertTitle>
                  {`${parsedData.length} lønnstrekk funnet i filen.`}
                  <Box sx={{ mt: 1 }}>
                    Klikk på "Last opp data" for å lagre disse i systemet.
                  </Box>
                </Alert>
              </Grid>
            )}
          </Grid>

          {parsedData.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Forhåndsvisning av data ({parsedData.length} rader)
              </Typography>
              <TableContainer sx={{ maxHeight: 300 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Setup ID</TableCell>
                      <TableCell>Avdeling</TableCell>
                      <TableCell>Ansatt</TableCell>
                      <TableCell align="right">Antall</TableCell>
                      <TableCell align="right">Beløp (kr)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {parsedData.slice(0, 100).map((row) => (
                      <TableRow key={row.id} hover>
                        <TableCell>{row.setup_id}</TableCell>
                        <TableCell>{row.department}</TableCell>
                        <TableCell>{row.employee_id}</TableCell>
                        <TableCell align="right">{row.count}</TableCell>
                        <TableCell align="right">{row.amount.toLocaleString('nb-NO')}</TableCell>
                      </TableRow>
                    ))}
                    {parsedData.length > 100 && (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          <Typography variant="body2" color="text.secondary">
                            Viser 100 av {parsedData.length} rader
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button 
            onClick={() => {
              if (!processingUpload) {
                setExcelDialogOpen(false);
                cancelExcelUpload();
              }
            }} 
            disabled={processingUpload}
          >
            Avbryt
          </Button>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={handleUploadParsedData}
            disabled={!parsedData.length || processingUpload}
          >
            {processingUpload ? "Laster opp..." : "Last opp data"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Manual Registration Dialog */}
      <Dialog 
        open={manualDialogOpen} 
        onClose={() => {
          if (!loading) setManualDialogOpen(false);
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Receipt sx={{ mr: 1 }} color="primary" />
            <Typography variant="h6">Registrer nytt lønnstrekk manuelt</Typography>
          </Box>
          <IconButton 
            onClick={() => {
              if (!loading) setManualDialogOpen(false);
            }}
            disabled={loading}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {uploadSuccess && (
            <Alert severity="success" sx={{ mb: 3 }}>
              <AlertTitle>Suksess</AlertTitle>
              Lønnstrekk ble registrert
            </Alert>
          )}
          
          {uploadError && (
            <Alert severity="error" sx={{ mb: 3 }}>
              <AlertTitle>Feil</AlertTitle>
              {uploadError}
            </Alert>
          )}
          
          <form id="manual-form" onSubmit={handleSubmit}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControl fullWidth size="small" required>
                  <InputLabel>Ansatt</InputLabel>
                  <Select
                    name="employee_id"
                    value={newDeduction.employee_id}
                    onChange={handleInputChange}
                    label="Ansatt"
                  >
                    {employees.map((employee) => (
                      <MenuItem key={employee.id} value={employee.name}>
                        {employee.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  label="Navn på lønnstrekk"
                  name="name"
                  value={newDeduction.name}
                  onChange={handleInputChange}
                  fullWidth
                  required
                  size="small"
                />
              </Grid>
              
              <Grid item xs={12}>
                <FormControl fullWidth size="small" required>
                  <InputLabel>Type trekk</InputLabel>
                  <Select
                    name="type"
                    value={newDeduction.type}
                    onChange={handleInputChange}
                    label="Type trekk"
                  >
                    <MenuItem value="Skatt">Skatt</MenuItem>
                    <MenuItem value="Pensjon">Pensjon</MenuItem>
                    <MenuItem value="Fagforening">Fagforening</MenuItem>
                    <MenuItem value="Forsikring">Forsikring</MenuItem>
                    <MenuItem value="Annet">Annet</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={6}>
                <TextField
                  label="Beløp (kr)"
                  name="amount"
                  type="number"
                  value={newDeduction.amount}
                  onChange={handleInputChange}
                  fullWidth
                  size="small"
                  InputProps={{
                    endAdornment: <InputAdornment position="end">kr</InputAdornment>,
                  }}
                />
              </Grid>
              
              <Grid item xs={6}>
                <TextField
                  label="Prosent (%)"
                  name="percentage"
                  type="number"
                  value={newDeduction.percentage}
                  onChange={handleInputChange}
                  fullWidth
                  size="small"
                  InputProps={{
                    endAdornment: <InputAdornment position="end">%</InputAdornment>,
                  }}
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  label="Beskrivelse"
                  name="description"
                  value={newDeduction.description}
                  onChange={handleInputChange}
                  fullWidth
                  multiline
                  rows={2}
                  size="small"
                />
              </Grid>
              
              <Grid item xs={12}>
                <FormControl fullWidth size="small">
                  <InputLabel>Gjentagende</InputLabel>
                  <Select
                    name="is_recurring"
                    value={newDeduction.is_recurring}
                    onChange={handleInputChange}
                    label="Gjentagende"
                  >
                    <MenuItem value={true}>Ja</MenuItem>
                    <MenuItem value={false}>Nei (engangstrekk)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </form>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button 
            onClick={() => {
              if (!loading) setManualDialogOpen(false);
            }} 
            disabled={loading}
          >
            Avbryt
          </Button>
          <Button 
            type="submit"
            form="manual-form"
            variant="contained" 
            color="primary" 
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : <CloudUpload />}
          >
            {loading ? "Lagrer..." : "Registrer lønnstrekk"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default SalaryDeductionsUpload;
