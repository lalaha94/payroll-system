import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import * as XLSX from "xlsx";
import ExcelJS from 'exceljs';
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
import { useLocation } from 'react-router-dom';
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
  const location = useLocation();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [salaryModels, setSalaryModels] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
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
    
    // Nye felt
    mentor: '',  // Fadder/Ansvarlig rådgiver
    signature: '',  // Signatur
    status: 'Ny',  // Status (f.eks. Ny, Aktiv)
    personal_id: '',  // Personnummer
    end_date: '',  // Sluttdato
    work_phone: '',  // Jobbtelefonnummer
    private_phone: '',  // Privat telefonnummer
    higher_education: false,  // Allmennstudiekompetanse eller høyere
    business_insurance: false,  // Næringsforsikring
    f2100_access: '',  // Tilgangsnivå i F2100
    access_package: '',  // Bestilt tilgangspakke
    tff: false,  // TFF
    property_register: false,  // Løsøreregister
    cv_reference: false,  // CV/referat/innstilling
    population_register: false,  // Folkeregisteret
    police_certificate: false,  // Politiattest
    basic_training: false,  // Gjennomført grunnopplæring
    gos_ais: false  // GOS/AIS
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
    console.log("Employees component mounted/updated, fetching data...");
    fetchCurrentUser();
  }, [location.pathname]);

  const fetchCurrentUser = async () => {
    try {
      setLoading(true);
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
      
      // Sorter lønnstrinn slik at lønnstrinn 1 kommer først
      const sortedModels = data.sort((a, b) => {
        if (a.id === 1) return -1;
        if (b.id === 1) return 1;
        return a.name.localeCompare(b.name);
      });
      
      setSalaryModels(sortedModels || []);
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
        
        // Nye felt
        mentor: employee.mentor || '',
        signature: employee.signature || '',
        status: employee.status || 'Ny',
        personal_id: employee.personal_id || '',
        end_date: employee.end_date || '',
        work_phone: employee.work_phone || '',
        private_phone: employee.private_phone || '',
        higher_education: employee.higher_education ?? false,
        business_insurance: employee.business_insurance ?? false,
        f2100_access: employee.f2100_access || '',
        access_package: employee.access_package || '',
        tff: employee.tff ?? false,
        property_register: employee.property_register ?? false,
        cv_reference: employee.cv_reference ?? false,
        population_register: employee.population_register ?? false,
        police_certificate: employee.police_certificate ?? false,
        basic_training: employee.basic_training ?? false,
        gos_ais: employee.gos_ais ?? false
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
        
        // Nye felt
        mentor: '',
        signature: '',
        status: 'Ny',
        personal_id: '',
        end_date: '',
        work_phone: '',
        private_phone: '',
        higher_education: false,
        business_insurance: false,
        f2100_access: '',
        access_package: '',
        tff: false,
        property_register: false,
        cv_reference: false,
        population_register: false,
        police_certificate: false,
        basic_training: false,
        gos_ais: false
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
      
      // Validering av påkrevde felt
      if (!newEmployee.name || !newEmployee.email) {
        setUploadError('Navn og e-post er påkrevd');
        return;
      }

      // Hvis lønnstrinn ikke er valgt, sett det til 1
      const salary_model_id = newEmployee.salary_model_id || '1';

      // Håndter tomme datofelt - fjern dem fra objektet hvis de er tomme
      const employeeData = {
        ...newEmployee,
        salary_model_id,
        agent_company: newEmployee.agent_company === 'new_department' 
          ? newEmployee.new_agent_company 
          : newEmployee.agent_company
      };
      
      // Remove any temporary fields
      delete employeeData.new_agent_company;
      
      // Håndter tomme datoer slik at de ikke sender ugyldig verdi til databasen
      if (!employeeData.hire_date) {
        employeeData.hire_date = null;
      }
      
      if (!employeeData.end_date) {
        employeeData.end_date = null;
      }
      
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
        if (employeeData.agent_company && !departments.includes(employeeData.agent_company)) {
          setDepartments([...departments, employeeData.agent_company].sort());
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
          // Mapper kolonnehoder til riktige feltnavn i databasen
          const value = row[index];
          
          switch(header.toLowerCase()) {
            case 'navn':
              emp.name = value;
              break;
            case 'stilling':
            case 'stilling/funksjon':
              emp.position = value !== undefined ? value : null;
              break;
            case 'avdeling':
              emp.agent_company = value !== undefined ? value : null;
              break;
            case 'fadder':
            case 'ansvarlig rådgiver':
            case 'fadder/ansvarlig rådgiver':
              emp.mentor = value !== undefined ? value : null;
              break;
            case 'signatur':
              emp.signature = value !== undefined ? value : null;
              break;
            case 'status':
              emp.status = value !== undefined ? value : null;
              break;
            case 'personnummer':
              emp.personal_id = value !== undefined ? value : null;
              break;
            case 'sluttdato':
            case 'slutt dato':
              emp.end_date = value !== undefined ? value : null;
              break;
            case 'startdato':
            case 'start dato':
              emp.hire_date = value !== undefined ? value : null;
              break;
            case 'telefon':
            case 'jobbtelefon':
            case 'jobb telefonnummer':
            case 'jobb telefon':
              emp.work_phone = value !== undefined ? value : null;
              break;
            case 'privattelefon':
            case 'privat telefonnummer':
            case 'privat telefon':
              emp.private_phone = value !== undefined ? value : null;
              break;
            case 'allmennstudiekompetanse':
            case 'allmennstudiekompetanse eller høyere':
              emp.higher_education = value === 'Ja' || value === 'ja' || value === 'JA' || value === true;
              break;
            case 'næringsforsikring':
              emp.business_insurance = value === 'Ja' || value === 'ja' || value === 'JA' || value === true;
              break;
            case 'tilgangsnivå i f2100':
            case 'f2100':
              emp.f2100_access = value !== undefined ? value : null;
              break;
            case 'bestilt tilgangspakke':
            case 'tilgangspakke':
              emp.access_package = value !== undefined ? value : null;
              break;
            case 'tff':
              emp.tff = value === 'Ja' || value === 'ja' || value === 'JA' || value === true;
              break;
            case 'løsøreregister':
              emp.property_register = value === 'Ja' || value === 'ja' || value === 'JA' || value === true;
              break;
            case 'cv/referat/innstilling':
            case 'cv':
              emp.cv_reference = value === 'Ja' || value === 'ja' || value === 'JA' || value === true;
              break;
            case 'folkeregisteret':
              emp.population_register = value === 'Ja' || value === 'ja' || value === 'JA' || value === true;
              break;
            case 'politiattest':
              emp.police_certificate = value === 'Ja' || value === 'ja' || value === 'JA' || value === true;
              break;
            case 'gjennomført grunnopplæring':
            case 'grunnopplæring':
              emp.basic_training = value === 'Ja' || value === 'ja' || value === 'JA' || value === true;
              break;
            case 'gos/ais':
            case 'gos':
            case 'ais':
              emp.gos_ais = value === 'Ja' || value === 'ja' || value === 'JA' || value === true;
              break;
            case 'agent id':
            case 'id':
              emp.agent_id = value !== undefined ? value : null;
              break;
            case 'email':
            case 'e-post':
              emp.email = value !== undefined ? value : null;
              break;
            default:
              // For andre kolonner, bruk header som feltnavn
              emp[header] = value !== undefined ? value : null;
          }
        });
        return emp;
      });
      
      // Filtrer ut rader som mangler name
      const validEmployees = imported.filter(
        (emp) => emp.name
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
      
      // Konverter dato-verdier til riktig format
      uniqueByName.forEach(emp => {
        // Sett standard for rolle-felt
        emp.role = emp.role || 'user';
        
        // Håndter tomme datoer
        if (emp.hire_date === null || emp.hire_date === '') {
          emp.hire_date = null;
        } else if (emp.hire_date && typeof emp.hire_date === 'string') {
          // Håndterer ulike datoformater
          try {
            const parsedDate = new Date(emp.hire_date);
            if (!isNaN(parsedDate)) {
              emp.hire_date = format 
                ? format(parsedDate, 'yyyy-MM-dd') 
                : formatDate(parsedDate);
            }
          } catch (err) {
            console.warn('Kunne ikke parse dato: ', emp.hire_date);
            emp.hire_date = null;
          }
        }
        
        if (emp.end_date === null || emp.end_date === '') {
          emp.end_date = null;
        } else if (emp.end_date && typeof emp.end_date === 'string') {
          try {
            const parsedDate = new Date(emp.end_date);
            if (!isNaN(parsedDate)) {
              emp.end_date = format 
                ? format(parsedDate, 'yyyy-MM-dd') 
                : formatDate(parsedDate);
            }
          } catch (err) {
            console.warn('Kunne ikke parse sluttdato: ', emp.end_date);
            emp.end_date = null;
          }
        }
      });
      
      console.log('Data som skal importeres:', uniqueByName);
      
      // For hver ansatt, hent først eksisterende data og oppdater kun angitte felter
      const updatedEmployees = [];
      for (const emp of uniqueByName) {
        // Sjekk om ansatt finnes fra før
        const { data: existingEmployee, error: fetchError } = await supabase
          .from('employees')
          .select('*')
          .eq('name', emp.name)
          .maybeSingle();
          
        if (fetchError) {
          console.error("Feil ved henting av eksisterende ansatt:", fetchError);
          continue;
        }
        
        if (existingEmployee) {
          // Ansatt finnes, oppdater med ID
          const { data: updatedData, error: updateError } = await supabase
            .from('employees')
            .update(emp)
            .eq('id', existingEmployee.id)
            .select();
          
          if (updateError) {
            console.error("Feil ved oppdatering av ansatt:", updateError);
          } else if (updatedData) {
            updatedEmployees.push(updatedData[0]);
          }
        } else {
          // Ansatt finnes ikke, opprett ny
          const { data: newData, error: insertError } = await supabase
            .from('employees')
            .insert([emp])
            .select();
          
          if (insertError) {
            console.error("Feil ved oppretting av ansatt:", insertError);
          } else if (newData) {
            updatedEmployees.push(newData[0]);
          }
        }
      }
        
      if (updatedEmployees.length > 0) {
        // Oppdaterer employees-staten med de nye oppdaterte ansatte
        setEmployees(prev => {
          // Fjern de som ble oppdatert fra listen
          const filteredEmployees = prev.filter(emp => 
            !updatedEmployees.some(updated => updated.id === emp.id)
          );
          // Legg til de oppdaterte ansatte
          return [...filteredEmployees, ...updatedEmployees];
        });
        
        setUploadSuccess(true);
        setImportMessage(`Import vellykket: ${updatedEmployees.length} oppføringer behandlet.`);
        setFile(null);
        setFileName("");
      } else {
        setUploadError("Ingen ansatte ble importert.");
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
  }).sort((a, b) => a.name.localeCompare(b.name, 'nb'));

  const openEmployeeDetails = (employee) => {
    setSelectedEmployee(employee);
    setDetailDialogOpen(true);
  };

  const closeEmployeeDetails = () => {
    setDetailDialogOpen(false);
    setSelectedEmployee(null);
  };

  return (
    <Box sx={{ 
      p: 3, 
      backgroundColor: "#f5f5f5", 
      minHeight: "100vh",
      pt: { xs: 10, sm: 11, md: 12 } // Add padding-top to push content below navigation
    }}>
      <NavigationMenu />
      
      <MuiGrid container spacing={3}>
        {/* Employees List */}
        <MuiGrid item xs={12}>
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
                <Button 
                  variant="outlined" 
                  startIcon={<Add />} 
                  onClick={() => handleOpenDialog(null)}
                  size="small"
                  sx={{ mr: 1 }}
                >
                  Legg til ansatt
                </Button>

                <Button 
                  variant="outlined" 
                  startIcon={<UploadFile />} 
                  onClick={() => setImportDialogOpen(true)}
                  size="small"
                  sx={{ mr: 1 }}
                >
                  Importer fra fil
                </Button>

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
                      <TableCell>Avdeling</TableCell>
                      <TableCell>Telefon</TableCell>
                      <TableCell>Lønnstrinn</TableCell>
                      <TableCell>Handlinger</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredEmployees.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          Ingen ansatte funnet
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredEmployees.map((emp) => {
                        const salaryModel = salaryModels.find(model => model.id === emp.salary_model_id);
                        
                        return (
                          <TableRow 
                            key={emp.id} 
                            hover
                            onClick={() => openEmployeeDetails(emp)} 
                            sx={{ cursor: 'pointer' }}
                          >
                            <TableCell>{emp.name}</TableCell>
                            <TableCell>
                              <Chip 
                                label={emp.agent_company || 'Ikke angitt'} 
                                size="small"
                                variant="outlined"
                                color="primary"
                              />
                            </TableCell>
                            <TableCell>{emp.work_phone || 'Ikke angitt'}</TableCell>
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
                            <TableCell>
                              <Stack direction="row" spacing={1}>
                                <IconButton 
                                  size="small" 
                                  color="primary" 
                                  onClick={(e) => {
                                    e.stopPropagation(); // Hindrer at raden trigges
                                    handleOpenDialog(emp);
                                  }}
                                >
                                  <Edit fontSize="small" />
                                </IconButton>
                                <IconButton 
                                  size="small" 
                                  color="error" 
                                  onClick={(e) => {
                                    e.stopPropagation(); // Hindrer at raden trigges
                                    handleDeleteEmployee(emp.id);
                                  }}
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
      
      {/* Employee Details Dialog */}
      <Dialog
        open={detailDialogOpen}
        onClose={closeEmployeeDetails}
        maxWidth="md"
        fullWidth
      >
        {selectedEmployee && (
          <>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Person sx={{ mr: 1 }} color="primary" />
                <Typography variant="h6">{selectedEmployee.name}</Typography>
              </Box>
              <Box>
                <IconButton size="small" color="primary" onClick={() => {
                  closeEmployeeDetails();
                  handleOpenDialog(selectedEmployee);
                }}>
                  <Edit />
                </IconButton>
                <IconButton
                  aria-label="close"
                  onClick={closeEmployeeDetails}
                  sx={{ ml: 1 }}
                >
                  <Close />
                </IconButton>
              </Box>
            </DialogTitle>
            <DialogContent dividers>
              <MuiGrid container spacing={3}>
                {/* Basisinformasjon */}
                <MuiGrid item xs={12}>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    Basisinformasjon
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <MuiGrid container spacing={2}>
                      <MuiGrid item xs={12} sm={6} md={4}>
                        <Typography variant="body2" color="textSecondary">Avdeling</Typography>
                        <Typography variant="body1">{selectedEmployee.agent_company || 'Ikke angitt'}</Typography>
                      </MuiGrid>
                      <MuiGrid item xs={12} sm={6} md={4}>
                        <Typography variant="body2" color="textSecondary">Agent ID</Typography>
                        <Typography variant="body1">{selectedEmployee.agent_id || 'Ikke angitt'}</Typography>
                      </MuiGrid>
                      <MuiGrid item xs={12} sm={6} md={4}>
                        <Typography variant="body2" color="textSecondary">Stilling</Typography>
                        <Typography variant="body1">{selectedEmployee.position || 'Ikke angitt'}</Typography>
                      </MuiGrid>
                      <MuiGrid item xs={12} sm={6} md={4}>
                        <Typography variant="body2" color="textSecondary">E-post</Typography>
                        <Typography variant="body1">{selectedEmployee.email || 'Ikke angitt'}</Typography>
                      </MuiGrid>
                      <MuiGrid item xs={12} sm={6} md={4}>
                        <Typography variant="body2" color="textSecondary">Telefon</Typography>
                        <Typography variant="body1">{selectedEmployee.work_phone || 'Ikke angitt'}</Typography>
                      </MuiGrid>
                      <MuiGrid item xs={12} sm={6} md={4}>
                        <Typography variant="body2" color="textSecondary">Lønnstrinn</Typography>
                        <Typography variant="body1">
                          {salaryModels.find(model => model.id === selectedEmployee.salary_model_id)?.name || 'Ikke angitt'}
                        </Typography>
                      </MuiGrid>
                    </MuiGrid>
                  </Paper>
                </MuiGrid>

                {/* Ansettelsesinfo */}
                <MuiGrid item xs={12}>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    Ansettelsesinfo
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <MuiGrid container spacing={2}>
                      <MuiGrid item xs={12} sm={6} md={4}>
                        <Typography variant="body2" color="textSecondary">Startdato</Typography>
                        <Typography variant="body1">{selectedEmployee.hire_date || 'Ikke angitt'}</Typography>
                      </MuiGrid>
                      <MuiGrid item xs={12} sm={6} md={4}>
                        <Typography variant="body2" color="textSecondary">Sluttdato</Typography>
                        <Typography variant="body1">{selectedEmployee.end_date || 'Ikke angitt'}</Typography>
                      </MuiGrid>
                      <MuiGrid item xs={12} sm={6} md={4}>
                        <Typography variant="body2" color="textSecondary">Status</Typography>
                        <Typography variant="body1">{selectedEmployee.status || 'Ikke angitt'}</Typography>
                      </MuiGrid>
                      <MuiGrid item xs={12} sm={6} md={4}>
                        <Typography variant="body2" color="textSecondary">Personnummer</Typography>
                        <Typography variant="body1">{selectedEmployee.personal_id || 'Ikke angitt'}</Typography>
                      </MuiGrid>
                      <MuiGrid item xs={12} sm={6} md={4}>
                        <Typography variant="body2" color="textSecondary">Fadder/Ansvarlig</Typography>
                        <Typography variant="body1">{selectedEmployee.mentor || 'Ikke angitt'}</Typography>
                      </MuiGrid>
                      <MuiGrid item xs={12} sm={6} md={4}>
                        <Typography variant="body2" color="textSecondary">Privat telefon</Typography>
                        <Typography variant="body1">{selectedEmployee.private_phone || 'Ikke angitt'}</Typography>
                      </MuiGrid>
                    </MuiGrid>
                  </Paper>
                </MuiGrid>

                {/* Tilganger og kvalifikasjoner */}
                <MuiGrid item xs={12}>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    Tilganger og kvalifikasjoner
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <MuiGrid container spacing={2}>
                      <MuiGrid item xs={12} sm={6} md={3}>
                        <Typography variant="body2" color="textSecondary">Signatur</Typography>
                        <Typography variant="body1">{selectedEmployee.signature || 'Ikke angitt'}</Typography>
                      </MuiGrid>
                      <MuiGrid item xs={12} sm={6} md={3}>
                        <Typography variant="body2" color="textSecondary">Tilgangsnivå i F2100</Typography>
                        <Typography variant="body1">{selectedEmployee.f2100_access || 'Ikke angitt'}</Typography>
                      </MuiGrid>
                      <MuiGrid item xs={12} sm={6} md={3}>
                        <Typography variant="body2" color="textSecondary">Bestilt tilgangspakke</Typography>
                        <Typography variant="body1">{selectedEmployee.access_package || 'Ikke angitt'}</Typography>
                      </MuiGrid>
                      <MuiGrid item xs={12} sm={6} md={3}>
                        <Typography variant="body2" color="textSecondary">TFF</Typography>
                        <Chip 
                          label={selectedEmployee.tff ? 'Ja' : 'Nei'} 
                          size="small" 
                          color={selectedEmployee.tff ? 'success' : 'default'}
                        />
                      </MuiGrid>
                      <MuiGrid item xs={12} sm={6} md={3}>
                        <Typography variant="body2" color="textSecondary">Allmennstudiekompetanse</Typography>
                        <Chip 
                          label={selectedEmployee.higher_education ? 'Ja' : 'Nei'} 
                          size="small" 
                          color={selectedEmployee.higher_education ? 'success' : 'default'}
                        />
                      </MuiGrid>
                      <MuiGrid item xs={12} sm={6} md={3}>
                        <Typography variant="body2" color="textSecondary">Næringsforsikring</Typography>
                        <Chip 
                          label={selectedEmployee.business_insurance ? 'Ja' : 'Nei'} 
                          size="small" 
                          color={selectedEmployee.business_insurance ? 'success' : 'default'}
                        />
                      </MuiGrid>
                      <MuiGrid item xs={12} sm={6} md={3}>
                        <Typography variant="body2" color="textSecondary">Løsøreregister</Typography>
                        <Chip 
                          label={selectedEmployee.property_register ? 'Ja' : 'Nei'} 
                          size="small" 
                          color={selectedEmployee.property_register ? 'success' : 'default'}
                        />
                      </MuiGrid>
                      <MuiGrid item xs={12} sm={6} md={3}>
                        <Typography variant="body2" color="textSecondary">CV/referat/innstilling</Typography>
                        <Chip 
                          label={selectedEmployee.cv_reference ? 'Ja' : 'Nei'} 
                          size="small" 
                          color={selectedEmployee.cv_reference ? 'success' : 'default'}
                        />
                      </MuiGrid>
                      <MuiGrid item xs={12} sm={6} md={3}>
                        <Typography variant="body2" color="textSecondary">Folkeregisteret</Typography>
                        <Chip 
                          label={selectedEmployee.population_register ? 'Ja' : 'Nei'} 
                          size="small" 
                          color={selectedEmployee.population_register ? 'success' : 'default'}
                        />
                      </MuiGrid>
                      <MuiGrid item xs={12} sm={6} md={3}>
                        <Typography variant="body2" color="textSecondary">Politiattest</Typography>
                        <Chip 
                          label={selectedEmployee.police_certificate ? 'Ja' : 'Nei'} 
                          size="small" 
                          color={selectedEmployee.police_certificate ? 'success' : 'default'}
                        />
                      </MuiGrid>
                      <MuiGrid item xs={12} sm={6} md={3}>
                        <Typography variant="body2" color="textSecondary">Grunnopplæring</Typography>
                        <Chip 
                          label={selectedEmployee.basic_training ? 'Ja' : 'Nei'} 
                          size="small" 
                          color={selectedEmployee.basic_training ? 'success' : 'default'}
                        />
                      </MuiGrid>
                      <MuiGrid item xs={12} sm={6} md={3}>
                        <Typography variant="body2" color="textSecondary">GOS/AIS</Typography>
                        <Chip 
                          label={selectedEmployee.gos_ais ? 'Ja' : 'Nei'} 
                          size="small" 
                          color={selectedEmployee.gos_ais ? 'success' : 'default'}
                        />
                      </MuiGrid>
                    </MuiGrid>
                  </Paper>
                </MuiGrid>
              </MuiGrid>
            </DialogContent>
            <DialogActions>
              <Button onClick={closeEmployeeDetails} color="primary">
                Lukk
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
      
      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
          <UploadFile sx={{ mr: 1 }} color="primary" fontSize="small" />
          Importer ansatte fra fil
          <IconButton
            aria-label="close"
            onClick={() => setImportDialogOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
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
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setImportDialogOpen(false)}
            startIcon={<Cancel />}
            size="small"
          >
            Lukk
          </Button>
        </DialogActions>
      </Dialog>
      
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
              {/* Basisinformasjon */}
              <MuiGrid item xs={12}>
                <Typography variant="subtitle1" gutterBottom>Basisinformasjon</Typography>
              </MuiGrid>
              
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
                <TextField
                  fullWidth
                  label="Jobbtelefon"
                  name="work_phone"
                  value={newEmployee.work_phone}
                  onChange={handleInputChange}
                  size="small"
                />
              </MuiGrid>
              
              <MuiGrid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Privat telefon"
                  name="private_phone"
                  value={newEmployee.private_phone}
                  onChange={handleInputChange}
                  size="small"
                />
              </MuiGrid>
              
              {/* Ansettelsesinfo */}
              <MuiGrid item xs={12} sx={{ mt: 2 }}>
                <Typography variant="subtitle1" gutterBottom>Ansettelsesinfo</Typography>
              </MuiGrid>
              
              <MuiGrid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Personnummer"
                  name="personal_id"
                  value={newEmployee.personal_id}
                  onChange={handleInputChange}
                  size="small"
                />
              </MuiGrid>
              
              <MuiGrid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Fadder/Ansvarlig"
                  name="mentor"
                  value={newEmployee.mentor}
                  onChange={handleInputChange}
                  size="small"
                />
              </MuiGrid>
              
              <MuiGrid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Signatur"
                  name="signature"
                  value={newEmployee.signature}
                  onChange={handleInputChange}
                  size="small"
                />
              </MuiGrid>
              
              <MuiGrid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Status"
                  name="status"
                  value={newEmployee.status}
                  onChange={handleInputChange}
                  size="small"
                />
              </MuiGrid>
              
              <MuiGrid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Startdato"
                  name="hire_date"
                  type="date"
                  value={newEmployee.hire_date}
                  onChange={handleInputChange}
                  size="small"
                  InputLabelProps={{ shrink: true }}
                />
              </MuiGrid>
              
              <MuiGrid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Sluttdato"
                  name="end_date"
                  type="date"
                  value={newEmployee.end_date}
                  onChange={handleInputChange}
                  size="small"
                  InputLabelProps={{ shrink: true }}
                />
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
              
              {/* Tilganger og kvalifikasjoner */}
              <MuiGrid item xs={12} sx={{ mt: 2 }}>
                <Typography variant="subtitle1" gutterBottom>Tilganger og kvalifikasjoner</Typography>
              </MuiGrid>
              
              <MuiGrid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Allmennstudiekompetanse</InputLabel>
                  <Select
                    name="higher_education"
                    value={newEmployee.higher_education ? "true" : "false"}
                    onChange={(e) => setNewEmployee({
                      ...newEmployee,
                      higher_education: e.target.value === "true"
                    })}
                  >
                    <MenuItem value="true">Ja</MenuItem>
                    <MenuItem value="false">Nei</MenuItem>
                  </Select>
                </FormControl>
              </MuiGrid>
              
              <MuiGrid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Næringsforsikring</InputLabel>
                  <Select
                    name="business_insurance"
                    value={newEmployee.business_insurance ? "true" : "false"}
                    onChange={(e) => setNewEmployee({
                      ...newEmployee,
                      business_insurance: e.target.value === "true"
                    })}
                  >
                    <MenuItem value="true">Ja</MenuItem>
                    <MenuItem value="false">Nei</MenuItem>
                  </Select>
                </FormControl>
              </MuiGrid>
              
              <MuiGrid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  label="Tilgang F2100"
                  name="f2100_access"
                  value={newEmployee.f2100_access}
                  onChange={handleInputChange}
                  size="small"
                />
              </MuiGrid>
              
              <MuiGrid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  label="Tilgangspakke"
                  name="access_package"
                  value={newEmployee.access_package}
                  onChange={handleInputChange}
                  size="small"
                />
              </MuiGrid>
              
              <MuiGrid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>TFF</InputLabel>
                  <Select
                    name="tff"
                    value={newEmployee.tff ? "true" : "false"}
                    onChange={(e) => setNewEmployee({
                      ...newEmployee,
                      tff: e.target.value === "true"
                    })}
                  >
                    <MenuItem value="true">Ja</MenuItem>
                    <MenuItem value="false">Nei</MenuItem>
                  </Select>
                </FormControl>
              </MuiGrid>
              
              <MuiGrid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Løsøreregister</InputLabel>
                  <Select
                    name="property_register"
                    value={newEmployee.property_register ? "true" : "false"}
                    onChange={(e) => setNewEmployee({
                      ...newEmployee,
                      property_register: e.target.value === "true"
                    })}
                  >
                    <MenuItem value="true">Ja</MenuItem>
                    <MenuItem value="false">Nei</MenuItem>
                  </Select>
                </FormControl>
              </MuiGrid>
              
              <MuiGrid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>CV/Referat</InputLabel>
                  <Select
                    name="cv_reference"
                    value={newEmployee.cv_reference ? "true" : "false"}
                    onChange={(e) => setNewEmployee({
                      ...newEmployee,
                      cv_reference: e.target.value === "true"
                    })}
                  >
                    <MenuItem value="true">Ja</MenuItem>
                    <MenuItem value="false">Nei</MenuItem>
                  </Select>
                </FormControl>
              </MuiGrid>
              
              <MuiGrid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Folkeregisteret</InputLabel>
                  <Select
                    name="population_register"
                    value={newEmployee.population_register ? "true" : "false"}
                    onChange={(e) => setNewEmployee({
                      ...newEmployee,
                      population_register: e.target.value === "true"
                    })}
                  >
                    <MenuItem value="true">Ja</MenuItem>
                    <MenuItem value="false">Nei</MenuItem>
                  </Select>
                </FormControl>
              </MuiGrid>
              
              <MuiGrid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Politiattest</InputLabel>
                  <Select
                    name="police_certificate"
                    value={newEmployee.police_certificate ? "true" : "false"}
                    onChange={(e) => setNewEmployee({
                      ...newEmployee,
                      police_certificate: e.target.value === "true"
                    })}
                  >
                    <MenuItem value="true">Ja</MenuItem>
                    <MenuItem value="false">Nei</MenuItem>
                  </Select>
                </FormControl>
              </MuiGrid>
              
              <MuiGrid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Grunnopplæring</InputLabel>
                  <Select
                    name="basic_training"
                    value={newEmployee.basic_training ? "true" : "false"}
                    onChange={(e) => setNewEmployee({
                      ...newEmployee,
                      basic_training: e.target.value === "true"
                    })}
                  >
                    <MenuItem value="true">Ja</MenuItem>
                    <MenuItem value="false">Nei</MenuItem>
                  </Select>
                </FormControl>
              </MuiGrid>
              
              <MuiGrid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>GOS/AIS</InputLabel>
                  <Select
                    name="gos_ais"
                    value={newEmployee.gos_ais ? "true" : "false"}
                    onChange={(e) => setNewEmployee({
                      ...newEmployee,
                      gos_ais: e.target.value === "true"
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
