import React, { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "./supabaseClient";
import { Link } from "react-router-dom";
import {
  Container,
  Typography,
  Paper,
  Button,
  TextField,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Grid as MuiGrid,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,  // Added this import
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  Stack,
  Alert,
  AlertTitle,
  Chip,
  InputAdornment,
  CircularProgress,
} from "@mui/material";
import {
  Add,
  CloudUpload,
  Delete,
  Edit,
  Refresh,
  Search,
  Save,
  Cancel,
  Person,
  Group,
  UploadFile,
  Business,
} from "@mui/icons-material";
import { useTheme } from "@mui/material/styles";
import NavigationMenu from "./components/NavigationMenu";

function Employees() {
  const theme = useTheme();
  // Data og state
  const [employees, setEmployees] = useState([]);
  const [salaryModels, setSalaryModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDepartment, setSelectedDepartment] = useState("Alle");
  const [searchTerm, setSearchTerm] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  // For manuell oppretting av ansatt
  const [newEmployee, setNewEmployee] = useState({
    name: "",
    agent_id: "",
    agent_company: "",
    position: "",
    start_date: "",
    salary_model_id: "",
  });

  // For filopplasting (import)
  const [file, setFile] = useState(null);
  const [importMessage, setImportMessage] = useState("");
  const [fileName, setFileName] = useState("");

  // For redigeringsdialog
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);

  // Hent ansatte fra Supabase
  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("employees").select("*");
    if (error) {
      console.error("Feil ved henting av ansatte:", error);
      setUploadError("Kunne ikke hente ansatte data");
    } else {
      setEmployees(data || []);
    }
    setLoading(false);
  };

  // Hent lønnstrinn fra Supabase
  useEffect(() => {
    async function fetchSalaryModels() {
      const { data, error } = await supabase.from("salary_models").select("*");
      if (error) {
        console.error("Feil ved henting av lønnstrinn:", error);
        setUploadError("Kunne ikke hente lønnstrinn data");
      } else {
        setSalaryModels(data);
      }
    }
    fetchSalaryModels();
  }, []);

  // Filtrer ansatte basert på valgt avdeling og søketerm
  const departments = [
    "Alle",
    ...new Set(employees.map((emp) => emp.agent_company).filter(Boolean)),
  ];
  
  const filteredEmployees = employees.filter((emp) => {
    const matchesDepartment = selectedDepartment === "Alle" || emp.agent_company === selectedDepartment;
    const matchesSearch = 
      searchTerm === "" || 
      (emp.name && emp.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (emp.agent_id && emp.agent_id.toString().includes(searchTerm)) ||
      (emp.position && emp.position.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return matchesDepartment && matchesSearch;
  });

  // Manuell oppretting av ansatt
  const handleAddEmployee = async () => {
    if (!newEmployee.name || !newEmployee.agent_id || !newEmployee.agent_company) {
      setUploadError("Fyll ut minst Name, Agent ID og Avdeling!");
      return;
    }
    
    setLoading(true);
    setUploadSuccess(false);
    setUploadError(null);
    
    const { data, error } = await supabase
      .from("employees")
      .insert([newEmployee])
      .select();
      
    if (error) {
      console.error("Innsetting feilet:", error);
      setUploadError("Innsetting feilet: " + error.message);
    } else if (data) {
      setEmployees([...employees, ...data]);
      setNewEmployee({
        name: "",
        agent_id: "",
        agent_company: "",
        position: "",
        start_date: "",
        salary_model_id: "",
      });
      setUploadSuccess(true);
    }
    
    setLoading(false);
  };

  // Filopplasting for import
  const handleFileUpload = (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;
    
    // Check file type
    const fileExt = uploadedFile.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(fileExt)) {
      setUploadError('Vennligst last opp en Excel-fil (.xlsx, .xls eller .csv)');
      return;
    }
    
    setFile(uploadedFile);
    setFileName(uploadedFile.name);
    setUploadError(null);
  };

  const handleImport = async () => {
    if (!file) {
      setUploadError("Vennligst velg en fil først.");
      return;
    }
    
    setLoading(true);
    setUploadSuccess(false);
    setUploadError(null);
    
    try {
      const fileData = await file.arrayBuffer();
      const workbook = XLSX.read(fileData, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (jsonData.length < 2) {
        setUploadError("Filen er tom eller mangler header.");
        setLoading(false);
        return;
      }
      
      const headers = jsonData[0].map((h) => String(h).trim());
      const rows = jsonData.slice(1);
      const imported = rows.map((row) => {
        const emp = {};
        headers.forEach((header, index) => {
          emp[header] = row[index];
        });
        return emp;
      });
      
      // Filtrer ut rader som mangler name eller agent_id
      const validEmployees = imported.filter(
        (emp) => emp.name && emp.agent_id
      );
      
      // Fjern duplikater basert på name (siste rad "vinner")
      const uniqueByName = Array.from(
        new Map(validEmployees.map((emp) => [emp.name, emp])).values()
      );
      
      const { data: upsertData, error } = await supabase
        .from("employees")
        .upsert(uniqueByName, { onConflict: "name" })
        .select();
        
      if (error) {
        console.error("Import feilet:", error);
        setUploadError("Import feilet: " + error.message);
      } else {
        setEmployees([...employees, ...upsertData]);
        setUploadSuccess(true);
        setImportMessage(`Import vellykket: ${upsertData.length} oppføringer behandlet.`);
        setFile(null);
        setFileName("");
      }
    } catch (err) {
      console.error("Feil under import:", err);
      setUploadError("Feil under import: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const cancelFileUpload = () => {
    setFile(null);
    setFileName("");
    setUploadError(null);
    setImportMessage("");
  };

  // Redigeringsdialog
  const handleOpenEditDialog = (emp) => {
    setEditingEmployee({...emp});
    setOpenEditDialog(true);
  };

  const handleCloseEditDialog = () => {
    setEditingEmployee(null);
    setOpenEditDialog(false);
  };

  const handleUpdateEmployee = async () => {
    if (!editingEmployee) return;
    
    setLoading(true);
    
    const { data, error } = await supabase
      .from("employees")
      .update({
        name: editingEmployee.name,
        agent_id: editingEmployee.agent_id,
        agent_company: editingEmployee.agent_company,
        position: editingEmployee.position,
        start_date: editingEmployee.start_date,
        salary_model_id: editingEmployee.salary_model_id,
      })
      .eq("id", editingEmployee.id)
      .select();
      
    if (error) {
      console.error("Oppdatering feilet:", error);
      setUploadError("Oppdatering feilet: " + error.message);
    } else if (data) {
      setEmployees(
        employees.map((emp) =>
          emp.id === editingEmployee.id ? data[0] : emp
        )
      );
      setUploadSuccess(true);
    }
    
    handleCloseEditDialog();
    setLoading(false);
  };

  const handleDeleteEmployee = async (id) => {
    if (window.confirm("Er du sikker på at du vil slette denne ansatte?")) {
      setLoading(true);
      
      const { error } = await supabase.from("employees").delete().eq("id", id);
      
      if (error) {
        console.error("Sletting feilet:", error);
        setUploadError("Sletting feilet: " + error.message);
      } else {
        setEmployees(employees.filter((emp) => emp.id !== id));
      }
      
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3, backgroundColor: "#f5f5f5", minHeight: "100vh" }}>
      <NavigationMenu />

      <MuiGrid container spacing={3}>
        {/* File Import Section */}
        <MuiGrid item xs={12}>
          <Paper elevation={2} sx={{ p: 3, borderRadius: 2, mb: 3 }}>
            <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ mb: 3, display: 'flex', alignItems: 'center' }}>
              <UploadFile sx={{ mr: 1 }} color="primary" />
              Importer ansatte fra fil
            </Typography>
            
            {uploadSuccess && !file && (
              <Alert severity="success" sx={{ mb: 3 }}>
                <AlertTitle>Suksess</AlertTitle>
                {importMessage || "Data ble lastet opp og behandlet"}
              </Alert>
            )}
            
            {uploadError && (
              <Alert severity="error" sx={{ mb: 3 }}>
                <AlertTitle>Feil</AlertTitle>
                {uploadError}
              </Alert>
            )}
            
            <MuiGrid container spacing={2} alignItems="center">
              <MuiGrid item xs={12} md={4}>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<UploadFile />}
                  fullWidth
                  sx={{ py: 1.5 }}
                  disabled={loading}
                >
                  Velg Excel-fil
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    hidden
                    onChange={handleFileUpload}
                  />
                </Button>
              </MuiGrid>
              
              <MuiGrid item xs={12} md={4}>
                <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                  {fileName ? (
                    <Chip
                      icon={<Business />}
                      label={fileName}
                      variant="outlined"
                      onDelete={cancelFileUpload}
                      sx={{ maxWidth: '100%', overflow: 'hidden' }}
                    />
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Ingen fil valgt
                    </Typography>
                  )}
                </Box>
              </MuiGrid>
              
              <MuiGrid item xs={12} md={4}>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<CloudUpload />}
                  fullWidth
                  sx={{ py: 1.5 }}
                  onClick={handleImport}
                  disabled={!file || loading}
                >
                  {loading ? "Importerer..." : "Importer"}
                </Button>
              </MuiGrid>
            </MuiGrid>
          </Paper>
        </MuiGrid>
        
        {/* Add New Employee Form */}
        <MuiGrid item xs={12} md={4}>
          <Paper elevation={2} sx={{ p: 3, borderRadius: 2, height: '100%' }}>
            <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ mb: 3, display: 'flex', alignItems: 'center' }}>
              <Person sx={{ mr: 1 }} color="primary" />
              Legg til ny ansatt
            </Typography>
            
            <MuiGrid container spacing={2}>
              <MuiGrid item xs={12}>
                <TextField
                  label="Navn"
                  value={newEmployee.name}
                  onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                  fullWidth
                  required
                  size="small"
                />
              </MuiGrid>
              
              <MuiGrid item xs={12}>
                <TextField
                  label="Agent ID"
                  value={newEmployee.agent_id}
                  onChange={(e) => setNewEmployee({ ...newEmployee, agent_id: e.target.value })}
                  fullWidth
                  required
                  size="small"
                />
              </MuiGrid>
              
              <MuiGrid item xs={12}>
                <TextField
                  label="Avdeling"
                  value={newEmployee.agent_company}
                  onChange={(e) => setNewEmployee({ ...newEmployee, agent_company: e.target.value })}
                  fullWidth
                  required
                  size="small"
                />
              </MuiGrid>
              
              <MuiGrid item xs={12}>
                <TextField
                  label="Stilling"
                  value={newEmployee.position}
                  onChange={(e) => setNewEmployee({ ...newEmployee, position: e.target.value })}
                  fullWidth
                  size="small"
                />
              </MuiGrid>
              
              <MuiGrid item xs={12}>
                <TextField
                  label="Startdato"
                  type="date"
                  InputLabelProps={{ shrink: true }}
                  value={newEmployee.start_date}
                  onChange={(e) => setNewEmployee({ ...newEmployee, start_date: e.target.value })}
                  fullWidth
                  size="small"
                />
              </MuiGrid>
              
              <MuiGrid item xs={12}>
                <TextField
                  select
                  label="Velg lønnstrinn"
                  value={newEmployee.salary_model_id}
                  onChange={(e) => setNewEmployee({
                    ...newEmployee,
                    salary_model_id: Number(e.target.value),
                  })}
                  fullWidth
                  size="small"
                >
                  <MenuItem value="">Velg lønnstrinn</MenuItem>
                  {salaryModels.map((model) => (
                    <MenuItem key={model.id} value={model.id}>
                      {model.name}
                    </MenuItem>
                  ))}
                </TextField>
              </MuiGrid>
              
              <MuiGrid item xs={12}>
                <Button
                  variant="contained"
                  fullWidth
                  disabled={loading}
                  startIcon={<Add />}
                  onClick={handleAddEmployee}
                  sx={{ mt: 1 }}
                >
                  {loading ? "Lagrer..." : "Legg til ansatt"}
                </Button>
              </MuiGrid>
            </MuiGrid>
          </Paper>
        </MuiGrid>
        
        {/* Employees List */}
        <MuiGrid item xs={12} md={8}>
          <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center' }}>
                <Group sx={{ mr: 1 }} color="primary" />
                Ansatte oversikt
              </Typography>
              
              <Box>
                <Tooltip title="Oppdater data">
                  <IconButton onClick={fetchEmployees} color="primary" size="small">
                    <Refresh />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
            
            {/* Search and Filter controls */}
            <MuiGrid container spacing={2} sx={{ mb: 3 }}>
              <MuiGrid item xs={12}>
                <TextField
                  placeholder="Søk etter navn, agent ID eller stilling..."
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
              </MuiGrid>
            </MuiGrid>
            
            {/* Department Tabs */}
            <Paper sx={{ mb: 3 }}>
              <Tabs 
                value={selectedDepartment} 
                onChange={(e, value) => setSelectedDepartment(value)} 
                variant="scrollable" 
                scrollButtons="auto"
              >
                {departments.map((dept, index) => (
                  <Tab key={index} label={dept} value={dept} />
                ))}
              </Tabs>
            </Paper>
            
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>ID</TableCell>
                      <TableCell>Navn</TableCell>
                      <TableCell>Agent ID</TableCell>
                      <TableCell>Avdeling</TableCell>
                      <TableCell>Stilling</TableCell>
                      <TableCell>Lønnstrinn</TableCell>
                      <TableCell>Handlinger</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredEmployees.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} align="center">
                          Ingen ansatte funnet
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredEmployees.map((emp) => {
                        const model = salaryModels.find(
                          (m) => Number(m.id) === Number(emp.salary_model_id)
                        );
                        return (
                          <TableRow key={emp.id}>
                            <TableCell>{emp.id}</TableCell>
                            <TableCell>{emp.name}</TableCell>
                            <TableCell>{emp.agent_id || "Ikke angitt"}</TableCell>
                            <TableCell>
                              {emp.agent_company ? (
                                <Chip 
                                  label={emp.agent_company} 
                                  size="small" 
                                  variant="outlined"
                                  color="primary"
                                />
                              ) : "Ikke angitt"}
                            </TableCell>
                            <TableCell>{emp.position || "Ikke angitt"}</TableCell>
                            <TableCell>
                              {model ? (
                                <Chip 
                                  label={model.name} 
                                  size="small"
                                  variant="outlined"
                                  color="success"
                                />
                              ) : "Ikke angitt"}
                            </TableCell>
                            <TableCell>
                              <Stack direction="row" spacing={1}>
                                <IconButton size="small" color="primary" onClick={() => handleOpenEditDialog(emp)}>
                                  <Edit fontSize="small" />
                                </IconButton>
                                <IconButton size="small" color="error" onClick={() => handleDeleteEmployee(emp.id)}>
                                  <Delete fontSize="small" />
                                </IconButton>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </MuiGrid>
      </MuiGrid>
      
      {/* Edit Employee Dialog */}
      <Dialog open={openEditDialog} onClose={handleCloseEditDialog} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
          <Edit sx={{ mr: 1 }} color="primary" fontSize="small" />
          Rediger ansatt
        </DialogTitle>
        <DialogContent>
          <MuiGrid container spacing={2} sx={{ mt: 1 }}>
            <MuiGrid item xs={12}>
              <TextField
                label="Navn"
                fullWidth
                value={editingEmployee?.name || ""}
                onChange={(e) =>
                  setEditingEmployee({ ...editingEmployee, name: e.target.value })
                }
                size="small"
              />
            </MuiGrid>
            <MuiGrid item xs={12} sm={6}>
              <TextField
                label="Agent ID"
                fullWidth
                value={editingEmployee?.agent_id || ""}
                onChange={(e) =>
                  setEditingEmployee({ ...editingEmployee, agent_id: e.target.value })
                }
                size="small"
              />
            </MuiGrid>
            <MuiGrid item xs={12} sm={6}>
              <TextField
                label="Avdeling"
                fullWidth
                value={editingEmployee?.agent_company || ""}
                onChange={(e) =>
                  setEditingEmployee({ ...editingEmployee, agent_company: e.target.value })
                }
                size="small"
              />
            </MuiGrid>
            <MuiGrid item xs={12}>
              <TextField
                label="Stilling"
                fullWidth
                value={editingEmployee?.position || ""}
                onChange={(e) =>
                  setEditingEmployee({ ...editingEmployee, position: e.target.value })
                }
                size="small"
              />
            </MuiGrid>
            <MuiGrid item xs={12} sm={6}>
              <TextField
                label="Startdato"
                type="date"
                InputLabelProps={{ shrink: true }}
                fullWidth
                value={editingEmployee?.start_date || ""}
                onChange={(e) =>
                  setEditingEmployee({ ...editingEmployee, start_date: e.target.value })
                }
                size="small"
              />
            </MuiGrid>
            <MuiGrid item xs={12} sm={6}>
              <TextField
                select
                label="Velg lønnstrinn"
                fullWidth
                value={editingEmployee?.salary_model_id || ""}
                onChange={(e) =>
                  setEditingEmployee({
                    ...editingEmployee,
                    salary_model_id: Number(e.target.value),
                  })
                }
                size="small"
              >
                <MenuItem value="">Ingen lønnstrinn</MenuItem>
                {salaryModels.map((model) => (
                  <MenuItem key={model.id} value={model.id}>
                    {model.name}
                  </MenuItem>
                ))}
              </TextField>
            </MuiGrid>
          </MuiGrid>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={handleCloseEditDialog} 
            startIcon={<Cancel />}
            size="small"
          >
            Avbryt
          </Button>
          <Button 
            onClick={handleUpdateEmployee} 
            variant="contained" 
            startIcon={<Save />}
            size="small"
          >
            Lagre endringer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Employees;
