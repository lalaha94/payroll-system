import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import * as XLSX from "xlsx";
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  AlertTitle,
  Card,
  CardContent,
  Divider,
  IconButton,
  Tooltip,
  Chip,
  FormControlLabel,
  Switch,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import {
  CloudDownload,
  CalendarMonth,
  Refresh,
  Receipt,
  Person,
  AttachMoney,
  Search,
  ReceiptLong,
  RemoveCircle,
  AccountBalance,
  PriceCheck,
  Download,
  Summarize,
  CheckCircle,
  Cancel,
  Comment,
} from "@mui/icons-material";
import { useTheme } from '@mui/material/styles';
import NavigationMenu from "./components/NavigationMenu";

function AccountingExport() {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [salaryModels, setSalaryModels] = useState([]);
  const [deductions, setDeductions] = useState([]);
  const [salesData, setSalesData] = useState([]);
  const [payrollData, setPayrollData] = useState([]);
  const [monthOptions, setMonthOptions] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [includeDeductions, setIncludeDeductions] = useState(true);
  const [includeCommissions, setIncludeCommissions] = useState(true);
  const [includeBaseSalary, setIncludeBaseSalary] = useState(true);
  const [approvedOnly, setApprovedOnly] = useState(true); // Default to show only approved commissions
  const [showApprovalDetails, setShowApprovalDetails] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [revocationDialogOpen, setRevocationDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [revocationReason, setRevocationReason] = useState('');
  const [revocationLoading, setRevocationLoading] = useState(false);

  // Initialize with current month
  useEffect(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(currentMonth);
    
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch all necessary data in parallel
      const [
        { data: employeesData, error: employeesError },
        { data: salaryModelsData, error: salaryModelsError },
        { data: deductionsData, error: deductionsError },
        { data: salesData, error: salesError },
        { data: monthlyApprovals, error: approvalsError }
      ] = await Promise.all([
        supabase.from("employees").select("*"),
        supabase.from("salary_models").select("*"),
        supabase.from("salary_deductions").select("*"),
        supabase.from("sales_data").select("*"),
        supabase.from("monthly_commission_approvals").select("*")
      ]);
      
      if (employeesError) throw new Error(`Failed to fetch employees: ${employeesError.message}`);
      if (salaryModelsError) throw new Error(`Failed to fetch salary models: ${salaryModelsError.message}`);
      if (deductionsError) throw new Error(`Failed to fetch deductions: ${deductionsError.message}`);
      if (salesError) throw new Error(`Failed to fetch sales data: ${salesError.message}`);
      if (approvalsError) throw new Error(`Failed to fetch approval data: ${approvalsError.message}`);
      
      setEmployees(employeesData);
      setSalaryModels(salaryModelsData);
      setDeductions(deductionsData);
      setSalesData(salesData);
      
      // Store monthly approvals for later reference
      const approvalsByAgentAndMonth = {};
      monthlyApprovals.forEach(approval => {
        const key = `${approval.agent_name}:${approval.month_year}`;
        approvalsByAgentAndMonth[key] = approval;
      });
      
      // Extract available months from sales data
      const months = new Set();
      salesData.forEach(sale => {
        if (sale.policy_sale_date) {
          const date = new Date(sale.policy_sale_date);
          if (!isNaN(date.getTime())) {
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            months.add(monthKey);
          }
        }
      });
      
      // Sort months in descending order (newest first)
      const sortedMonths = Array.from(months).sort((a, b) => b.localeCompare(a));
      setMonthOptions(sortedMonths);
      
      // If current selection isn't in the list, select the most recent
      if (sortedMonths.length > 0 && !sortedMonths.includes(selectedMonth)) {
        setSelectedMonth(sortedMonths[0]);
      }
      
      // Process payroll data with approvals
      processPayrollData(employeesData, salaryModelsData, deductionsData, salesData, approvalsByAgentAndMonth);
      
    } catch (error) {
      console.error("Error fetching data:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Process all data to create payroll records
  const processPayrollData = (employees, salaryModels, deductions, salesData, approvals) => {
    if (!selectedMonth) return;
    
    const payrollRecords = [];
    
    // Process each employee
    employees.forEach(employee => {
      // Check if employee has approved commission for this month
      const approvalKey = `${employee.name}:${selectedMonth}`;
      const approvalRecord = approvals[approvalKey];
      
      // Skip if we're showing only approved records and this employee has no approval
      if (approvedOnly && (!approvalRecord || !approvalRecord.approved || approvalRecord.revoked)) {
        return;
      }
      
      // Find employee's salary model
      const salaryModel = salaryModels.find(model => parseInt(model.id) === parseInt(employee.salary_model_id));
      
      if (!salaryModel) {
        console.warn(`No salary model found for employee: ${employee.name}`);
        return;
      }
      
      // Get employee's sales for selected month, excluding canceled sales
      const employeeSales = salesData.filter(sale => {
        // Skip sales with cancel_code
        if (sale.cancel_code) return false;
        
        const saleDate = new Date(sale.policy_sale_date);
        if (isNaN(saleDate.getTime())) return false;
        
        const saleMonth = `${saleDate.getFullYear()}-${String(saleDate.getMonth() + 1).padStart(2, '0')}`;
        return saleMonth === selectedMonth && sale.agent_name === employee.name;
      });
      
      // Calculate total sales and premiums
      let livPremium = 0;
      let skadePremium = 0;
      let livCount = 0;
      let skadeCount = 0;
      
      employeeSales.forEach(sale => {
        const netPremium = parseFloat(sale.net_premium_sales) || 0;
        
        // Determine insurance type
        const provisjonsgruppe = (sale.provisjonsgruppe || "").toLowerCase();
        if (provisjonsgruppe.includes("life")) {
          livPremium += netPremium;
          livCount++;
        } else if (provisjonsgruppe.includes("pc") || provisjonsgruppe.includes("child") || provisjonsgruppe.includes("skad")) {
          skadePremium += netPremium;
          skadeCount++;
        }
      });
      
      // Calculate commissions - either from approval or calculated
      let commission;
      let commissionSource;
      
      if (approvalRecord && approvalRecord.approved && !approvalRecord.revoked) {
        // Use the approved commission amount
        commission = {
          livCommission: 0, // We don't have this breakdown in approval
          skadeCommission: 0, // We don't have this breakdown in approval
          totalCommission: parseFloat(approvalRecord.approved_commission) || 0
        };
        commissionSource = 'approved';
      } else {
        // Calculate based on salary model
        const salesDataForCalc = {
          agent_name: employee.name,
          agent_id: employee.agent_id,
          salary_level: employee.salary_model_id,
          livPremium,
          skadePremium,
          totalPremium: livPremium + skadePremium,
          livCount,
          skadeCount,
          totalCount: livCount + skadeCount
        };
        
        commission = calculateCommission(salesDataForCalc, salaryModels);
        commissionSource = 'calculated';
      }
      
      // Get employee's deductions
      const employeeDeductions = deductions.filter(deduction => 
        deduction.employee_id === employee.name ||
        deduction.employee_id === employee.id ||
        deduction.employee_id === employee.agent_id
      );
      
      // Calculate total deductions
      const totalDeductions = employeeDeductions.reduce((sum, deduction) => {
        // Only include recurring deductions or one-time deductions for this month
        if (deduction.is_recurring || (deduction.created_at && deduction.created_at.startsWith(selectedMonth))) {
          return sum + (parseFloat(deduction.amount) || 0);
        }
        return sum;
      }, 0);
      
      // Create payroll record
      const baseSalary = parseFloat(salaryModel.base_salary) || 0;
      const totalSalary = baseSalary + commission.totalCommission - totalDeductions;
      
      payrollRecords.push({
        employeeId: employee.agent_id,
        employeeName: employee.name,
        department: employee.agent_company || "N/A",
        position: employee.position || "Rådgiver",
        salaryModelName: salaryModel.name,
        month: selectedMonth,
        baseSalary,
        livPremium,
        skadePremium,
        totalPremium: livPremium + skadePremium,
        livCommission: commission.livCommission,
        skadeCommission: commission.skadeCommission,
        totalCommission: commission.totalCommission,
        deductions: totalDeductions,
        totalSalary,
        deductionDetails: employeeDeductions.map(d => ({
          name: d.name,
          amount: parseFloat(d.amount) || 0,
          type: d.type,
          isRecurring: d.is_recurring
        })),
        approvalInfo: approvalRecord || null,
        commissionSource,
      });
    });
    
    setPayrollData(payrollRecords);
  };
  
  // Helper function to calculate commission - same as in SalesDataDashboard
  const calculateCommission = (data, salaryModels) => {
    const model = salaryModels.find(m => parseInt(m.id) === parseInt(data.salary_level));
    
    const activeModel = model || salaryModels[0] || {
      commission_liv: 0,
      commission_skade: 0,
      bonus_enabled: false
    };
    
    let livRate = parseFloat(activeModel.commission_liv) || 0;
    let skadeRate = parseFloat(activeModel.commission_skade) || 0;
    
    let livCommission = data.livPremium * livRate / 100;
    let skadeCommission = data.skadePremium * skadeRate / 100;
    
    const totalPremium = data.livPremium + data.skadePremium;
    
    if (activeModel.bonus_enabled && 
        activeModel.bonus_threshold && 
        totalPremium >= parseFloat(activeModel.bonus_threshold)) {
      
      const bonusLivRate = parseFloat(activeModel.bonus_percentage_liv) || 0;
      const bonusSkadeRate = parseFloat(activeModel.bonus_percentage_skade) || 0;
      
      livCommission += data.livPremium * bonusLivRate / 100;
      skadeCommission += data.skadePremium * bonusSkadeRate / 100;
    }
    
    return {
      livCommission,
      skadeCommission,
      totalCommission: livCommission + skadeCommission
    };
  };
  
  // Filter payroll data based on selections
  const filteredPayrollData = payrollData.filter(record => {
    if (selectedEmployee && record.employeeName !== selectedEmployee && record.employeeId !== selectedEmployee) {
      return false;
    }
    if (approvedOnly && (!record.approvalInfo || !record.approvalInfo.approved || record.approvalInfo.revoked)) {
      return false;
    }
    return true;
  });
  
  // Export to Excel
  const exportToExcel = () => {
    if (filteredPayrollData.length === 0) {
      setError("Ingen data å eksportere");
      return;
    }
    
    try {
      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      
      // Prepare data for export
      const exportData = filteredPayrollData.map(record => {
        const data = {
          "Måned": record.month,
          "ID": record.employeeId,
          "Navn": record.employeeName,
          "Avdeling": record.department,
          "Stilling": record.position,
          "Lønnstrinn": record.salaryModelName
        };
        
        if (includeBaseSalary) {
          data["Grunnlønn"] = record.baseSalary;
        }
        
        if (includeCommissions) {
          data["Liv Premium"] = record.livPremium;
          data["Skade Premium"] = record.skadePremium;
          data["Total Premium"] = record.totalPremium;
          data["Liv Provisjon"] = record.livCommission;
          data["Skade Provisjon"] = record.skadeCommission;
          data["Total Provisjon"] = record.totalCommission;
        }
        
        if (includeDeductions) {
          data["Sum Trekk"] = record.deductions;
          
          // Add individual deductions
          record.deductionDetails.forEach((deduction, index) => {
            data[`Trekk ${index+1}: ${deduction.name}`] = deduction.amount;
          });
        }
        
        data["Utbetalt Lønn"] = record.totalSalary;
        
        return data;
      });
      
      // Create worksheet
      const ws = XLSX.utils.json_to_sheet(exportData);
      
      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, "Lønnsdata");
      
      // Format column widths
      const wscols = [
        { wch: 10 }, // Måned
        { wch: 10 }, // ID
        { wch: 25 }, // Navn
        { wch: 20 }, // Avdeling
        { wch: 15 }, // Stilling
        { wch: 15 }, // Lønnstrinn
        { wch: 12 }, // Grunnlønn
        { wch: 12 }, // Liv Premium
        { wch: 12 }, // Skade Premium
        { wch: 12 }, // Total Premium
        { wch: 12 }, // Liv Provisjon
        { wch: 12 }, // Skade Provisjon
        { wch: 12 }, // Total Provisjon
        { wch: 12 }, // Sum Trekk
        { wch: 15 }  // Utbetalt Lønn
      ];
      ws['!cols'] = wscols;
      
      // Export
      const fileName = `Lønnsdata_${selectedMonth}${selectedEmployee ? `_${selectedEmployee}` : ''}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      setSuccess(`Data eksportert til ${fileName}`);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
      
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      setError(`Eksport feilet: ${error.message}`);
    }
  };
  
  // Generate summary report
  const generateSummaryReport = () => {
    if (filteredPayrollData.length === 0) {
      setError("Ingen data for sammendrag");
      return;
    }
    
    try {
      // Create summary data
      const summary = {
        totalBaseSalary: 0,
        totalLivPremium: 0,
        totalSkadePremium: 0,
        totalLivCommission: 0,
        totalSkadeCommission: 0,
        totalDeductions: 0,
        totalNetSalary: 0,
        employeeCount: filteredPayrollData.length,
        departmentSummary: {}
      };
      
      // Calculate totals
      filteredPayrollData.forEach(record => {
        summary.totalBaseSalary += record.baseSalary;
        summary.totalLivPremium += record.livPremium;
        summary.totalSkadePremium += record.skadePremium;
        summary.totalLivCommission += record.livCommission;
        summary.totalSkadeCommission += record.skadeCommission;
        summary.totalDeductions += record.deductions;
        summary.totalNetSalary += record.totalSalary;
        
        // Group by department
        const dept = record.department || "Ukjent";
        if (!summary.departmentSummary[dept]) {
          summary.departmentSummary[dept] = {
            employeeCount: 0,
            totalSalary: 0,
            totalCommission: 0
          };
        }
        
        summary.departmentSummary[dept].employeeCount++;
        summary.departmentSummary[dept].totalSalary += record.totalSalary;
        summary.departmentSummary[dept].totalCommission += record.totalCommission;
      });
      
      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      
      // Create overall summary sheet
      const overallData = [
        { Category: "Måned", Value: selectedMonth },
        { Category: "Antall Ansatte", Value: summary.employeeCount },
        { Category: "Total Grunnlønn", Value: summary.totalBaseSalary },
        { Category: "Total Liv Premium", Value: summary.totalLivPremium },
        { Category: "Total Skade Premium", Value: summary.totalSkadePremium },
        { Category: "Total Liv Provisjon", Value: summary.totalLivCommission },
        { Category: "Total Skade Provisjon", Value: summary.totalSkadeCommission },
        { Category: "Total Provisjon", Value: summary.totalLivCommission + summary.totalSkadeCommission },
        { Category: "Total Trekk", Value: summary.totalDeductions },
        { Category: "Total Netto Utbetalt", Value: summary.totalNetSalary }
      ];
      
      const wsOverall = XLSX.utils.json_to_sheet(overallData);
      XLSX.utils.book_append_sheet(wb, wsOverall, "Totalsammendrag");
      
      // Create department summary sheet
      const deptData = Object.entries(summary.departmentSummary).map(([dept, data]) => ({
        Avdeling: dept,
        "Antall Ansatte": data.employeeCount,
        "Total Lønn": data.totalSalary,
        "Total Provisjon": data.totalCommission,
        "Gjennomsnitt Lønn": data.totalSalary / data.employeeCount,
        "Gjennomsnitt Provisjon": data.totalCommission / data.employeeCount
      }));
      
      const wsDept = XLSX.utils.json_to_sheet(deptData);
      XLSX.utils.book_append_sheet(wb, wsDept, "Avdelingssammendrag");
      
      // Export
      const fileName = `Lønnssammendrag_${selectedMonth}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      setSuccess(`Sammendrag eksportert til ${fileName}`);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
      
    } catch (error) {
      console.error("Error generating summary report:", error);
      setError(`Generering av sammendrag feilet: ${error.message}`);
    }
  };

  // Function to open revocation dialog
  const openRevocationDialog = (record) => {
    setSelectedRecord(record);
    setRevocationReason('');
    setRevocationDialogOpen(true);
  };
  
  // Function to close revocation dialog
  const closeRevocationDialog = () => {
    setRevocationDialogOpen(false);
    setSelectedRecord(null);
    setRevocationReason('');
  };
  
  // Function to handle approval revocation
  const handleRevokeApproval = async () => {
    if (!selectedRecord || !revocationReason) return;
    
    setRevocationLoading(true);
    setError(null);
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUser = sessionData?.session?.user;
      
      if (!currentUser) {
        throw new Error("Kunne ikke hente brukerdata. Logg inn på nytt.");
      }
      
      // First, get the specific record to update by ID to avoid ambiguous column references
      const { data: approvalRecord, error: findError } = await supabase
        .from('monthly_commission_approvals')
        .select('id')
        .eq('agent_name', selectedRecord.employeeName)
        .eq('month_year', selectedRecord.month)
        .eq('approved', true)
        .eq('revoked', false)
        .maybeSingle();
      
      if (findError) {
        throw new Error(`Kunne ikke finne godkjenning: ${findError.message}`);
      }
      
      if (!approvalRecord) {
        throw new Error(`Ingen aktiv godkjenning funnet for ${selectedRecord.employeeName}`);
      }
      
      console.log(`Found approval to revoke, ID: ${approvalRecord.id}`);
      
      // Now update by ID to avoid ambiguous column references
      const { data, error } = await supabase
        .from('monthly_commission_approvals')
        .update({
          revoked: true,
          revoked_by: currentUser.email,
          revoked_at: new Date().toISOString(),
          revocation_reason: revocationReason || 'Godkjenning trukket tilbake'
        })
        .eq('id', approvalRecord.id)
        .select();
      
      if (error) throw error;
      
      console.log(`Revoked approval for ${selectedRecord.employeeName}, affected record:`, data);
      
      setSuccess(`Godkjenning for ${selectedRecord.employeeName} ble trukket tilbake`);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
      
      // Refresh data
      await fetchData();
      
      closeRevocationDialog();
      
    } catch (error) {
      console.error("Error revoking approval:", error);
      setError(`Feil ved tilbaketrekking av godkjenning: ${error.message}`);
    } finally {
      setRevocationLoading(false);
    }
  };

  return (
    <Box sx={{ 
      p: 3, 
      backgroundColor: "#f5f5f5", 
      minHeight: "100vh",
      pt: { xs: 10, sm: 11, md: 12 } // Add padding-top to push content below navigation
    }}>
      <NavigationMenu />
      
      <Paper elevation={2} sx={{ p: 3, borderRadius: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center' }}>
            <AccountBalance sx={{ mr: 1 }} color="primary" />
            Eksport til Regnskap
          </Typography>
          
          <Tooltip title="Oppdater data">
            <IconButton onClick={fetchData} color="primary">
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>
        
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            <AlertTitle>Feil</AlertTitle>
            {error}
          </Alert>
        )}
        
        {success && (
          <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
            <AlertTitle>Suksess</AlertTitle>
            {success}
          </Alert>
        )}
        
        {/* Filter and options */}
        <Grid container spacing={3}>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Velg måned</InputLabel>
              <Select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                label="Velg måned"
                startAdornment={
                  <InputAdornment position="start">
                    <CalendarMonth fontSize="small" />
                  </InputAdornment>
                }
              >
                {monthOptions.map(month => (
                  <MenuItem key={month} value={month}>
                    {month.replace("-", "/")}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Velg ansatt</InputLabel>
              <Select
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                label="Velg ansatt"
                startAdornment={
                  <InputAdornment position="start">
                    <Person fontSize="small" />
                  </InputAdornment>
                }
              >
                <MenuItem value="">Alle ansatte</MenuItem>
                {employees.map(employee => (
                  <MenuItem key={employee.id} value={employee.name}>
                    {employee.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <FormControlLabel
              control={
                <Switch
                  checked={approvedOnly}
                  onChange={(e) => setApprovedOnly(e.target.checked)}
                  color="primary"
                />
              }
              label="Vis kun godkjente provisjoner"
            />
          </Grid>
          
          <Grid item xs={12} md={3}>
            <Button
              fullWidth
              variant="contained"
              color="primary"
              startIcon={<Refresh />}
              onClick={fetchData}
            >
              Oppdater data
            </Button>
          </Grid>
        </Grid>
        
        {/* Export options */}
        <Box sx={{ mt: 4, mb: 3 }}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            Eksportinnstillinger
          </Typography>
          <Divider sx={{ mb: 2 }} />
          
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <FormControlLabel
                control={
                  <Switch
                    checked={includeBaseSalary}
                    onChange={(e) => setIncludeBaseSalary(e.target.checked)}
                    color="primary"
                  />
                }
                label="Inkluder grunnlønn"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControlLabel
                control={
                  <Switch
                    checked={includeCommissions}
                    onChange={(e) => setIncludeCommissions(e.target.checked)}
                    color="primary"
                  />
                }
                label="Inkluder provisjoner"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControlLabel
                control={
                  <Switch
                    checked={includeDeductions}
                    onChange={(e) => setIncludeDeductions(e.target.checked)}
                    color="primary"
                  />
                }
                label="Inkluder lønnstrekk"
              />
            </Grid>
          </Grid>
        </Box>
        
        {/* Export buttons */}
        <Box sx={{ mt: 4, display: 'flex', justifyContent: 'space-between' }}>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<Summarize />}
            onClick={generateSummaryReport}
            disabled={loading || payrollData.length === 0}
          >
            Generer sammendragsrapport
          </Button>
          
          <Button
            variant="contained"
            color="primary"
            startIcon={<CloudDownload />}
            onClick={exportToExcel}
            disabled={loading || payrollData.length === 0}
          >
            Eksporter til Excel
          </Button>
        </Box>
      </Paper>
      
      {/* Data preview */}
      <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center' }}>
            <Receipt sx={{ mr: 1 }} color="primary" />
            Lønningsdata {selectedMonth ? `(${selectedMonth})` : ""}
          </Typography>
          
          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={showApprovalDetails}
                  onChange={(e) => setShowApprovalDetails(e.target.checked)}
                  color="primary"
                  size="small"
                />
              }
              label="Vis godkjenningsdetaljer"
            />
          </Box>
        </Box>
        
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : filteredPayrollData.length === 0 ? (
          <Alert severity="info">
            {approvedOnly 
              ? 'Ingen godkjente lønningsdata funnet for valgt periode. Prøv å fjerne "Vis kun godkjente provisjoner" filteret.'
              : 'Ingen lønningsdata funnet for valgt periode.'}
          </Alert>
        ) : (
          <TableContainer sx={{ maxHeight: '60vh' }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Navn</TableCell>
                  <TableCell>Avdeling</TableCell>
                  <TableCell>Lønnstrinn</TableCell>
                  <TableCell align="right">Grunnlønn</TableCell>
                  <TableCell align="right">Premium (Liv)</TableCell>
                  <TableCell align="right">Premium (Skade)</TableCell>
                  <TableCell align="right">Provisjon</TableCell>
                  {showApprovalDetails && <TableCell>Godkjent av</TableCell>}
                  <TableCell align="right">Trekk</TableCell>
                  <TableCell align="right">Netto Lønn</TableCell>
                  <TableCell>Handlinger</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredPayrollData.map((record) => (
                  <TableRow key={record.employeeId + record.month} hover>
                    <TableCell>{record.employeeName}</TableCell>
                    <TableCell>
                      <Chip 
                        label={record.department} 
                        size="small" 
                        variant="outlined"
                        color="primary"
                      />
                    </TableCell>
                    <TableCell>{record.salaryModelName}</TableCell>
                    <TableCell align="right">
                      {record.baseSalary.toLocaleString('nb-NO')} kr
                    </TableCell>
                    <TableCell align="right">
                      {record.livPremium.toLocaleString('nb-NO')} kr
                    </TableCell>
                    <TableCell align="right">
                      {record.skadePremium.toLocaleString('nb-NO')} kr
                    </TableCell>
                    <TableCell align="right" sx={{ position: 'relative' }}>
                      <Box sx={{ 
                        display: 'flex', 
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        gap: 0.5
                      }}>
                        {record.totalCommission.toLocaleString('nb-NO')} kr
                        {record.commissionSource === 'approved' && (
                          <Tooltip title="Godkjent provisjon">
                            <CheckCircle color="success" fontSize="small" />
                          </Tooltip>
                        )}
                      </Box>
                      {record.commissionSource === 'approved' && 
                       record.approvalInfo?.approval_comment && (
                        <Tooltip title={record.approvalInfo.approval_comment}>
                          <Box sx={{ 
                            position: 'absolute',
                            bottom: -3,
                            right: 0,
                            fontSize: '0.7rem',
                            color: 'text.secondary',
                            fontStyle: 'italic'
                          }}>
                            Justert
                          </Box>
                        </Tooltip>
                      )}
                    </TableCell>
                    {showApprovalDetails && (
                      <TableCell>
                        {record.approvalInfo?.approved_by ? (
                          <Box>
                            <Tooltip title={`Godkjent: ${new Date(record.approvalInfo.approved_at).toLocaleString('nb-NO')}`}>
                              <Chip
                                size="small"
                                label={record.approvalInfo.approved_by.split('@')[0]}
                                color="success"
                                variant="outlined"
                              />
                            </Tooltip>
                            {record.approvalInfo.approval_comment && (
                              <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                                "{record.approvalInfo.approval_comment}"
                              </Typography>
                            )}
                          </Box>
                        ) : (
                          <Chip
                            size="small"
                            label="Ikke godkjent"
                            color="default"
                            variant="outlined"
                          />
                        )}
                      </TableCell>
                    )}
                    <TableCell align="right" sx={{ color: theme.palette.error.main }}>
                      -{record.deductions.toLocaleString('nb-NO')} kr
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold', color: theme.palette.success.main }}>
                      {record.totalSalary.toLocaleString('nb-NO')} kr
                    </TableCell>
                    <TableCell>
                      {record.commissionSource === 'approved' && record.approvalInfo?.approved_by && (
                        <Tooltip title="Trekk tilbake godkjenning">
                          <IconButton 
                            size="small" 
                            color="error"
                            onClick={() => openRevocationDialog(record)}
                          >
                            <Cancel fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
      
      {/* Totals card */}
      {filteredPayrollData.length > 0 && (
        <Grid container spacing={3} sx={{ mt: 2 }}>
          <Grid item xs={12} md={6}>
            <Card elevation={2} sx={{ borderRadius: 2 }}>
              <CardContent>
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                  Totale utbetalinger
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography color="text.secondary">Antall ansatte:</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography align="right" fontWeight="bold">
                      {filteredPayrollData.length}
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={6}>
                    <Typography color="text.secondary">Total grunnlønn:</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography align="right" fontWeight="bold">
                      {filteredPayrollData.reduce((sum, record) => sum + record.baseSalary, 0).toLocaleString('nb-NO')} kr
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={6}>
                    <Typography color="text.secondary">Total provisjon:</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography align="right" fontWeight="bold" color={theme.palette.primary.main}>
                      {filteredPayrollData.reduce((sum, record) => sum + record.totalCommission, 0).toLocaleString('nb-NO')} kr
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={6}>
                    <Typography color="text.secondary">Totale trekk:</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography align="right" fontWeight="bold" color={theme.palette.error.main}>
                      -{filteredPayrollData.reduce((sum, record) => sum + record.deductions, 0).toLocaleString('nb-NO')} kr
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12}>
                    <Divider sx={{ my: 1 }} />
                  </Grid>
                  
                  <Grid item xs={6}>
                    <Typography color="text.secondary" fontWeight="bold">Total utbetaling:</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography align="right" fontWeight="bold" color={theme.palette.success.main} variant="h6">
                      {filteredPayrollData.reduce((sum, record) => sum + record.totalSalary, 0).toLocaleString('nb-NO')} kr
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Card elevation={2} sx={{ borderRadius: 2 }}>
              <CardContent>
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                  Premium og salgsresultater
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography color="text.secondary">Total Liv premium:</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography align="right" fontWeight="bold" color={theme.palette.info.main}>
                      {filteredPayrollData.reduce((sum, record) => sum + record.livPremium, 0).toLocaleString('nb-NO')} kr
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={6}>
                    <Typography color="text.secondary">Total Skade premium:</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography align="right" fontWeight="bold" color={theme.palette.secondary.main}>
                      {filteredPayrollData.reduce((sum, record) => sum + record.skadePremium, 0).toLocaleString('nb-NO')} kr
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={6}>
                    <Typography color="text.secondary">Total premium:</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography align="right" fontWeight="bold">
                      {filteredPayrollData.reduce((sum, record) => sum + record.totalPremium, 0).toLocaleString('nb-NO')} kr
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12}>
                    <Divider sx={{ my: 1 }} />
                  </Grid>
                  
                  <Grid item xs={6}>
                    <Typography color="text.secondary">Provisjon Liv:</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography align="right" fontWeight="bold" color={theme.palette.info.dark}>
                      {filteredPayrollData.reduce((sum, record) => sum + record.livCommission, 0).toLocaleString('nb-NO')} kr
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={6}>
                    <Typography color="text.secondary">Provisjon Skade:</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography align="right" fontWeight="bold" color={theme.palette.secondary.dark}>
                      {filteredPayrollData.reduce((sum, record) => sum + record.skadeCommission, 0).toLocaleString('nb-NO')} kr
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
      
      {/* Revocation Dialog */}
      <Dialog 
        open={revocationDialogOpen} 
        onClose={closeRevocationDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Trekk tilbake godkjenning
        </DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          
          {selectedRecord && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <Typography variant="subtitle1" fontWeight="bold">
                  Trekk tilbake godkjenning for {selectedRecord.employeeName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Måned: {selectedRecord.month?.replace('-', '/')}
                </Typography>
              </Grid>
              
              <Grid item xs={12}>
                <Alert severity="warning" sx={{ mb: 2 }}>
                  <AlertTitle>Advarsel</AlertTitle>
                  Å trekke tilbake godkjenning vil fjerne denne agentens provisjon fra månedlig utbetaling. 
                  Dette bør kun gjøres hvis godkjenningen var feilaktig eller hvis det har oppstått andre 
                  grunner til at provisjonen ikke skal utbetales.
                </Alert>
              </Grid>
              
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary">
                  Opprinnelig godkjent av: {selectedRecord.approvalInfo?.approved_by || 'Ukjent'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Godkjent beløp: {parseFloat(selectedRecord.approvalInfo?.approved_commission || 0).toLocaleString('nb-NO')} kr
                </Typography>
                {selectedRecord.approvalInfo?.approval_comment && (
                  <Typography variant="body2" color="text.secondary">
                    Kommentar: {selectedRecord.approvalInfo.approval_comment}
                  </Typography>
                )}
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  label="Årsak for tilbaketrekking"
                  multiline
                  rows={3}
                  value={revocationReason}
                  onChange={(e) => setRevocationReason(e.target.value)}
                  fullWidth
                  required
                  placeholder="Angi årsak for tilbaketrekking av godkjenning"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Comment fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              
              <Grid item xs={12}>
                <Typography variant="body2" color="error">
                  Merk: Denne handlingen loggføres og kan ikke angres.
                </Typography>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeRevocationDialog} color="inherit" disabled={revocationLoading}>
            Avbryt
          </Button>
          <Button
            onClick={handleRevokeApproval}
            variant="contained"
            color="error"
            startIcon={<Cancel />}
            disabled={revocationLoading || !revocationReason}
          >
            {revocationLoading ? <CircularProgress size={24} /> : 'Trekk tilbake godkjenning'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default AccountingExport;