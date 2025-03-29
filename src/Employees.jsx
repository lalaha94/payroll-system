import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import * as XLSX from "xlsx";
import {
  Box,
  Typography,
  Paper,
  Button,
  IconButton,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid as MuiGrid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Alert,
  AlertTitle,
  InputAdornment,
  CircularProgress,
  Tabs,
  Tab,
  Tooltip,
  Stack,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Close,
  Refresh,
  Search,
  Save,
  Cancel,
  Person,
  Group,
  UploadFile,
  Business,
  CloudUpload,
  ToggleOn,
  ToggleOff,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import NavigationMenu from './components/NavigationMenu';
import { format, differenceInMonths } from 'date-fns';

// Fallback functions in case date-fns doesn't load
const formatDate = (date, formatString) => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  
  // Simple ISO format YYYY-MM-DD if date-fns format is not available
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const calculateMonthsDiff = (startDate, endDate = new Date()) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime())) return null;
  
  const years = end.getFullYear() - start.getFullYear();
  const months = end.getMonth() - start.getMonth();
  return years * 12 + months;
};

function Employees() {
  const theme = useTheme();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [salaryModels, setSalaryModels] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    email: '',
    agent_id: '',
    agent_company: '',
    position: '',
    salary_model_id: '',
    role: 'user',
    new_agent_company: '',
    hire_date: (format ? format(new Date(), 'yyyy-MM-dd') : formatDate(new Date())),
    apply_five_percent_deduction: true,
  });
  const [editMode, setEditMode] = useState(false);
  const [userRole, setUserRole] = useState('user');
  const [userOffice, setUserOffice] = useState(null);
  const [departments, setDepartments] = useState([]);
  
  // For file uploads (import)
  const [file, setFile] = useState(null);
  const [importMessage, setImportMessage] = useState("");
  const [fileName, setFileName] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  
  // For filtering by department/office
  const [selectedDepartment, setSelectedDepartment] = useState("Alle");
  
  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const session = await supabase.auth.getSession();
      const user = session.data?.session?.user;
      
      if (!user) return;
      
      // Determine user's role and office
      const { data: employeeData, error: employeeError } = await supabase
        .from('employees')
        .select('*')
        .eq('email', user.email)
        .single();
      
      if (employeeData) {
        // Get role from metadata first, then fallback to DB
        const metadataRole = user.user_metadata?.role || employeeData.role || 'user';
        setUserRole(metadataRole);
        setUserOffice(employeeData.agent_company);
        
        console.log("User role and office:", metadataRole, employeeData.agent_company);
      }
      
      // Load employees after determining user role/office
      fetchEmployees();
      fetchSalaryModels();
    } catch (error) {
      console.error("Error fetching current user:", error);
    }
  };

  const fetchEmployees = async () => {
    setLoading(true);
    setError(null);
    
    try {
      let query = supabase.from('employees').select('*');
      
      // Filter by office if user is a manager
      if (userRole === 'manager' && userOffice) {
        query = query.eq('agent_company', userOffice);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      const enrichedEmployees = data.map(emp => {
        if (!emp.hire_date) return { ...emp, apply_five_percent_deduction: emp.apply_five_percent_deduction ?? true };
        
        const hireDate = new Date(emp.hire_date);
        const monthsEmployed = differenceInMonths ? 
          differenceInMonths(new Date(), hireDate) : 
          calculateMonthsDiff(hireDate);
        
        const deductionValue = emp.apply_five_percent_deduction !== null
          ? emp.apply_five_percent_deduction
          : monthsEmployed < 9;
          
        return { ...emp, apply_five_percent_deduction: deductionValue };
      });
      
      setEmployees(enrichedEmployees);

      // Extract unique departments (agent_company values)
      const uniqueDepartments = Array.from(
        new Set(data.filter(emp => emp.agent_company).map(emp => emp.agent_company))
      ).sort();
      
      setDepartments(uniqueDepartments);
    } catch (error) {
      console.error('Error fetching employees:', error);
      setError('Failed to fetch employees: ' + error.message);
      setUploadError('Failed to fetch employees: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSalaryModels = async () => {
    try {
      const { data, error } = await supabase.from('salary_models').select('*');
      
      if (error) throw error;
      
      setSalaryModels(data || []);
    } catch (error) {
      console.error('Error fetching salary models:', error);
      setError('Failed to fetch salary models: ' + error.message);
      setUploadError('Failed to fetch salary models: ' + error.message);
    }
  };

  const handleOpenDialog = (employee = null) => {
    if (employee) {
      setNewEmployee({
        id: employee.id,
        name: employee.name || '',
        email: employee.email || '',
        agent_id: employee.agent_id || '',
        agent_company: employee.agent_company || '',
        position: employee.position || '',
        salary_model_id: employee.salary_model_id || '',
        role: employee.role || 'user',
        new_agent_company: '',
        hire_date: employee.hire_date || (format ? format(new Date(), 'yyyy-MM-dd') : formatDate(new Date())),
        apply_five_percent_deduction: employee.apply_five_percent_deduction ?? true,
      });
      setEditMode(true);
    } else {
      setNewEmployee({
        name: '',
        email: '',
        agent_id: '',
        agent_company: userRole === 'manager' ? userOffice : '',
        position: 'Rådgiver', // Default position
        salary_model_id: '',
        role: 'user',
        new_agent_company: '',
        hire_date: (format ? format(new Date(), 'yyyy-MM-dd') : formatDate(new Date())),
        apply_five_percent_deduction: true,
      });
      setEditMode(false);
    }
    
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setNewEmployee({
      ...newEmployee,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleDeleteEmployee = async (id) => {
    try {
      // For managers, verify the employee belongs to their office before deletion
      if (userRole === 'manager') {
        const employeeToDelete = employees.find(emp => emp.id === id);
        if (!employeeToDelete || employeeToDelete.agent_company !== userOffice) {
          setError('You can only delete employees from your own office');
          setUploadError('You can only delete employees from your own office');
          return;
        }
      }
      
      if (!window.confirm('Er du sikker på at du vil slette denne ansatte?')) {
        return;
      }
      
      const { error } = await supabase.from('employees').delete().eq('id', id);
      
      if (error) throw error;
      
      setEmployees(employees.filter(emp => emp.id !== id));
      setSuccess('Employee deleted successfully');
      setUploadSuccess(true);
      
      setTimeout(() => {
        setSuccess(null);
        setUploadSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('Error deleting employee:', error);
      setError('Failed to delete employee: ' + error.message);
      setUploadError('Failed to delete employee: ' + error.message);
    }
  };

  const handleSaveEmployee = async (e) => {
    e.preventDefault();
    
    try {
      setError(null);
      setUploadError(null);
      setLoading(true);
      
      // Process the actual company name if "new_department" was selected
      let finalCompany = newEmployee.agent_company;
      if (newEmployee.agent_company === 'new_department' && newEmployee.new_agent_company) {
        finalCompany = newEmployee.new_agent_company.trim();
      }
      
      // If manager, ensure they can only create/edit employees in their own office
      if (userRole === 'manager') {
        finalCompany = userOffice;
        
        // Managers can only create regular users, not other managers or admins
        if (editMode === false) {
          newEmployee.role = 'user';
        }
      }
      
      const employeeData = {
        ...newEmployee,
        agent_company: finalCompany
      };
      
      // Remove any temporary fields
      delete employeeData.new_agent_company;
      
      if (editMode) {
        const { id, ...updateData } = employeeData;
        const { error } = await supabase.from('employees').update(updateData).eq('id', id);
        
        if (error) throw error;
        
        setEmployees(employees.map(emp => (emp.id === id ? { ...emp, ...updateData } : emp)));
        setSuccess('Employee updated successfully');
        setUploadSuccess(true);
      } else {
        const { data, error } = await supabase.from('employees').insert([employeeData]).select();
        
        if (error) throw error;
        
        setEmployees([...employees, data[0]]);
        setSuccess('Employee added successfully');
        setUploadSuccess(true);
        
        // If a new department was added, update the departments list
        if (finalCompany && !departments.includes(finalCompany)) {
          setDepartments([...departments, finalCompany].sort());
        }
      }
      
      setTimeout(() => {
        setSuccess(null);
        setUploadSuccess(false);
      }, 3000);
      
      handleCloseDialog();
    } catch (error) {
      console.error('Error saving employee:', error);
      setError('Failed to save employee: ' + error.message);
      setUploadError('Failed to save employee: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleDeduction = async (id, currentValue) => {
    try {
      const { error } = await supabase
        .from('employees')
        .update({ apply_five_percent_deduction: !currentValue })
        .eq('id', id);
      
      if (error) throw error;
      
      setEmployees(employees.map(emp => 
        emp.id === id ? { ...emp, apply_five_percent_deduction: !currentValue } : emp
      ));
    } catch (error) {
      console.error('Error toggling deduction:', error);
    }
  };

  // File upload handling for import
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
      
      // If manager, ensure all employees are assigned to manager's office
      if (userRole === 'manager' && userOffice) {
        uniqueByName.forEach(emp => {
          emp.agent_company = userOffice;
          emp.role = 'user';  // Ensure only user role is set
        });
      }
      
      const { data: upsertData, error } = await supabase
        .from("employees")
        .upsert(uniqueByName, { onConflict: "name" })
        .select();
        
      if (error) {
        console.error("Import feilet:", error);
        setUploadError("Import feilet: " + error.message);
      } else {
        setEmployees([...employees.filter(e => !upsertData.some(u => u.id === e.id)), ...upsertData]);
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

  // Extract unique department names
  const allDepartments = [
    "Alle",
    ...Array.from(new Set(employees.filter(emp => emp.agent_company).map(emp => emp.agent_company)))
  ];

  // Filter employees based on search and selected department
  const filteredEmployees = employees.filter(employee => {
    const matchesDepartment = selectedDepartment === "Alle" || employee.agent_company === selectedDepartment;
    const searchFields = [
      employee.name,
      employee.email,
      employee.agent_id,
      employee.agent_company,
      employee.position
    ].filter(Boolean).join(' ').toLowerCase();
    
    const matchesSearch = searchTerm === "" || searchFields.includes(searchTerm.toLowerCase());
    
    return matchesDepartment && matchesSearch;
  });

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
                {importMessage || success || "Data ble lastet opp og behandlet"}
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
                  name="name"
                  value={newEmployee.name}
                  onChange={handleInputChange}
                  fullWidth
                  required
                  size="small"
                />
              </MuiGrid>
              
              <MuiGrid item xs={12}>
                <TextField
                  label="Email"
                  name="email"
                  type="email"
                  value={newEmployee.email}
                  onChange={handleInputChange}
                  fullWidth
                  required
                  size="small"
                />
              </MuiGrid>
              
              <MuiGrid item xs={12}>
                <TextField
                  label="Agent ID"
                  name="agent_id"
                  value={newEmployee.agent_id}
                  onChange={handleInputChange}
                  fullWidth
                  required
                  size="small"
                />
              </MuiGrid>
              
              <MuiGrid item xs={12}>
                <FormControl fullWidth size="small">
                  <InputLabel>Kontor</InputLabel>
                  <Select
                    label="Kontor"
                    name="agent_company"
                    value={userRole === 'manager' ? userOffice : newEmployee.agent_company}
                    onChange={handleInputChange}
                    required
                    disabled={userRole === 'manager'}
                  >
                    {departments.length > 0 ? (
                      departments.map(dept => (
                        <MenuItem key={dept} value={dept}>
                          {dept}
                        </MenuItem>
                      ))
                    ) : (
                      <MenuItem value="" disabled>
                        Ingen kontorer funnet
                      </MenuItem>
                    )}
                    {userRole === 'admin' && (
                      <MenuItem value="new_department">
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Add fontSize="small" sx={{ mr: 1 }} />
                          Angi nytt kontor
                        </Box>
                      </MenuItem>
                    )}
                  </Select>
                </FormControl>
                {userRole === 'admin' && newEmployee.agent_company === 'new_department' && (
                  <TextField
                    fullWidth
                    label="Nytt kontor"
                    value={newEmployee.new_agent_company || ''}
                    onChange={(e) => setNewEmployee({
                      ...newEmployee,
                      new_agent_company: e.target.value
                    })}
                    size="small"
                    margin="dense"
                    required
                  />
                )}
              </MuiGrid>
              
              <MuiGrid item xs={12}>
                <TextField
                  label="Stilling"
                  name="position"
                  value={newEmployee.position}
                  onChange={handleInputChange}
                  fullWidth
                  size="small"
                />
              </MuiGrid>
              
              <MuiGrid item xs={12}>
                <TextField
                  select
                  label="Velg lønnstrinn"
                  name="salary_model_id"
                  value={newEmployee.salary_model_id}
                  onChange={handleInputChange}
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
                <FormControl fullWidth size="small">
                  <InputLabel>5% trekk</InputLabel>
                  <Select
                    name="apply_five_percent_deduction"
                    value={newEmployee.apply_five_percent_deduction ? "true" : "false"}
                    onChange={(e) => setNewEmployee({
                      ...newEmployee,
                      apply_five_percent_deduction: e.target.value === "true"
                    })}
                  >
                    <MenuItem value="true">Ja</MenuItem>
                    <MenuItem value="false">Nei</MenuItem>
                  </Select>
                </FormControl>
              </MuiGrid>
              
              {/* Only show role selector for admins */}
              {userRole === 'admin' && (
                <MuiGrid item xs={12}>
                  <TextField
                    select
                    label="Rolle"
                    name="role"
                    value={newEmployee.role}
                    onChange={handleInputChange}
                    fullWidth
                    size="small"
                  >
                    <MenuItem value="user">Bruker</MenuItem>
                    <MenuItem value="manager">Kontorleder</MenuItem>
                    <MenuItem value="admin">Administrator</MenuItem>
                  </TextField>
                </MuiGrid>
              )}
              
              <MuiGrid item xs={12}>
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  fullWidth
                  onClick={handleSaveEmployee}
                  disabled={loading}
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
                {userRole === 'manager' && (
                  <Chip
                    label={userOffice || 'Ditt kontor'}
                    size="small"
                    color="primary"
                    sx={{ ml: 2 }}
                  />
                )}
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
                {allDepartments.map((dept, index) => (
                  <Tab key={index} label={dept} value={dept} />
                ))}
              </Tabs>
            </Paper>
            
            {/* Manager info alert */}
            {userRole === 'manager' && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Som kontorleder kan du administrere ansatte ved ditt kontor ({userOffice}). 
                Nye ansatte du registrerer vil automatisk bli tilknyttet dette kontoret.
              </Alert>
            )}
            
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Navn</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Agent ID</TableCell>
                      <TableCell>Avdeling</TableCell>
                      <TableCell>Stilling</TableCell>
                      <TableCell>Lønnstrinn</TableCell>
                      <TableCell>Ansettelsesdato</TableCell>
                      <TableCell>Ansettelsestid</TableCell>
                      <TableCell>5% trekk</TableCell>
                      {userRole === 'admin' && <TableCell>Rolle</TableCell>}
                      <TableCell>Handlinger</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredEmployees.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={userRole === 'admin' ? 9 : 8} align="center">
                          Ingen ansatte funnet
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredEmployees.map((emp) => {
                        const salaryModel = salaryModels.find(model => model.id === emp.salary_model_id);
                        const hireDate = emp.hire_date ? new Date(emp.hire_date) : null;
                        const monthsEmployed = hireDate ? (differenceInMonths ? differenceInMonths(new Date(), hireDate) : calculateMonthsDiff(hireDate)) : null;
                        
                        return (
                          <TableRow key={emp.id} hover>
                            <TableCell>{emp.name}</TableCell>
                            <TableCell>{emp.email}</TableCell>
                            <TableCell>{emp.agent_id || "Ikke angitt"}</TableCell>
                            <TableCell>
                              <Chip 
                                label={emp.agent_company || 'Not assigned'} 
                                size="small"
                                variant="outlined"
                                color="primary"
                              />
                            </TableCell>
                            <TableCell>{emp.position}</TableCell>
                            <TableCell>
                              {salaryModel ? (
                                <Chip 
                                  label={salaryModel.name} 
                                  size="small"
                                  variant="outlined"
                                  color="success"
                                />
                              ) : "Ikke angitt"}
                            </TableCell>
                            <TableCell>{emp.hire_date || "Ikke angitt"}</TableCell>
                            <TableCell>
                              {monthsEmployed !== null ? `${monthsEmployed} måneder` : 'Ukjent'}
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <Chip
                                  label={emp.apply_five_percent_deduction ? 'Ja' : 'Nei'}
                                  color={emp.apply_five_percent_deduction ? 'primary' : 'default'}
                                  size="small"
                                  sx={{ mr: 1 }}
                                />
                                <IconButton 
                                  size="small"
                                  onClick={() => toggleDeduction(emp.id, emp.apply_five_percent_deduction)}
                                  color={emp.apply_five_percent_deduction ? 'primary' : 'default'}
                                >
                                  {emp.apply_five_percent_deduction ? <ToggleOn /> : <ToggleOff />}
                                </IconButton>
                              </Box>
                            </TableCell>
                            {userRole === 'admin' && (
                              <TableCell>
                                <Chip 
                                  label={emp.role || 'user'} 
                                  size="small" 
                                  color={
                                    emp.role === 'admin' ? 'error' :
                                    emp.role === 'manager' ? 'warning' :
                                    'default'
                                  }
                                  variant="outlined"
                                />
                              </TableCell>
                            )}
                            <TableCell>
                              <Stack direction="row" spacing={1}>
                                <IconButton 
                                  size="small" 
                                  color="primary" 
                                  onClick={() => handleOpenDialog(emp)}
                                >
                                  <Edit fontSize="small" />
                                </IconButton>
                                <IconButton 
                                  size="small" 
                                  color="error" 
                                  onClick={() => handleDeleteEmployee(emp.id)}
                                >
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
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
          <Edit sx={{ mr: 1 }} color="primary" fontSize="small" />
          {editMode ? 'Rediger ansatt' : 'Legg til ny ansatt'}
          <IconButton
            aria-label="close"
            onClick={handleCloseDialog}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <form onSubmit={handleSaveEmployee}>
          <DialogContent dividers>
            <MuiGrid container spacing={2}>
              <MuiGrid item xs={12}>
                <TextField
                  fullWidth
                  label="Navn"
                  name="name"
                  value={newEmployee.name}
                  onChange={handleInputChange}
                  required
                  size="small"
                />
              </MuiGrid>
              
              <MuiGrid item xs={12}>
                <TextField
                  fullWidth
                  label="Email"
                  name="email"
                  type="email"
                  value={newEmployee.email}
                  onChange={handleInputChange}
                  required
                  size="small"
                />
              </MuiGrid>
              
              <MuiGrid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Agent ID"
                  name="agent_id"
                  value={newEmployee.agent_id}
                  onChange={handleInputChange}
                  size="small"
                />
              </MuiGrid>
              
              <MuiGrid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Stilling"
                  name="position"
                  value={newEmployee.position}
                  onChange={handleInputChange}
                  size="small"
                />
              </MuiGrid>
              
              <MuiGrid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Kontor</InputLabel>
                  <Select
                    label="Kontor"
                    name="agent_company"
                    value={userRole === 'manager' ? userOffice : newEmployee.agent_company}
                    onChange={handleInputChange}
                    required
                    disabled={userRole === 'manager'}
                  >
                    {departments.length > 0 ? (
                      departments.map(dept => (
                        <MenuItem key={dept} value={dept}>
                          {dept}
                        </MenuItem>
                      ))
                    ) : (
                      <MenuItem value="" disabled>
                        Ingen kontorer funnet
                      </MenuItem>
                    )}
                    {userRole === 'admin' && (
                      <MenuItem value="new_department">
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Add fontSize="small" sx={{ mr: 1 }} />
                          Angi nytt kontor
                        </Box>
                      </MenuItem>
                    )}
                  </Select>
                </FormControl>
                {userRole === 'admin' && newEmployee.agent_company === 'new_department' && (
                  <TextField
                    fullWidth
                    label="Nytt kontor"
                    value={newEmployee.new_agent_company || ''}
                    onChange={(e) => setNewEmployee({
                      ...newEmployee,
                      new_agent_company: e.target.value
                    })}
                    size="small"
                    margin="dense"
                    required
                  />
                )}
              </MuiGrid>
              
              <MuiGrid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Lønnstrinn</InputLabel>
                  <Select
                    label="Lønnstrinn"
                    name="salary_model_id"
                    value={newEmployee.salary_model_id}
                    onChange={handleInputChange}
                  >
                    <MenuItem value="">Ikke angitt</MenuItem>
                    {salaryModels.map(model => (
                      <MenuItem key={model.id} value={model.id}>
                        {model.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </MuiGrid>
              
              <MuiGrid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>5% trekk</InputLabel>
                  <Select
                    name="apply_five_percent_deduction"
                    value={newEmployee.apply_five_percent_deduction ? "true" : "false"}
                    onChange={(e) => setNewEmployee({
                      ...newEmployee,
                      apply_five_percent_deduction: e.target.value === "true"
                    })}
                  >
                    <MenuItem value="true">Ja</MenuItem>
                    <MenuItem value="false">Nei</MenuItem>
                  </Select>
                </FormControl>
              </MuiGrid>
              
              {/* Only show role selector for admins */}
              {userRole === 'admin' && (
                <MuiGrid item xs={12}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Rolle</InputLabel>
                    <Select
                      label="Rolle"
                      name="role"
                      value={newEmployee.role}
                      onChange={handleInputChange}
                    >
                      <MenuItem value="user">Bruker</MenuItem>
                      <MenuItem value="manager">Kontorleder</MenuItem>
                      <MenuItem value="admin">Administrator</MenuItem>
                    </Select>
                  </FormControl>
                </MuiGrid>
              )}
              
              {userRole === 'manager' && !editMode && (
                <MuiGrid item xs={12}>
                  <Alert severity="info">
                    Nye ansatte får automatisk brukerrollen 'user'. Bare administratorer kan endre brukerroller.
                  </Alert>
                </MuiGrid>
              )}
            </MuiGrid>
          </DialogContent>
          <DialogActions>
            <Button 
              onClick={handleCloseDialog}
              startIcon={<Cancel />}
              size="small"
            >
              Avbryt
            </Button>
            <Button 
              type="submit"
              variant="contained"
              color="primary"
              startIcon={<Save />}
              size="small"
              disabled={loading}
            >
              {editMode ? 'Lagre endringer' : 'Legg til'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}

export default Employees;
