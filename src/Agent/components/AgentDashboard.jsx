import React, { useState, useEffect } from 'react';
// Oppdater importstien til å peke til riktig plassering av supabaseClient
import { supabase } from '../../supabaseClient';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
} from '@mui/material';
import {
  CalendarMonth,
  TrendingUp,
  AttachMoney,
  ReceiptLong,
  PieChart,
  ShowChart,
  Person,
  Money,
  Receipt,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
// Endre denne importen til å bruke den globale NavigationMenu-komponenten
import NavigationMenu from '../../components/NavigationMenu';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';
import { useNavigate } from 'react-router-dom';

function AgentDashboard() {
  const theme = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [agentData, setAgentData] = useState(null);
  const [salesData, setSalesData] = useState([]);
  const [monthOptions, setMonthOptions] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [salaryModel, setSalaryModel] = useState(null);
  const [deductions, setDeductions] = useState([]);
  const [monthlySales, setMonthlySales] = useState([]);
  const [productMix, setProductMix] = useState([]);
  const [pendingCommission, setPendingCommission] = useState(0);
  const [historicalEarnings, setHistoricalEarnings] = useState([]);

  // Predefined colors for charts
  const CHART_COLORS = [
    '#0088FE', '#00C49F', '#FFBB28', '#FF8042', 
    '#8884d8', '#82ca9d', '#ffc658', '#ff8042'
  ];
  
  useEffect(() => {
    // Get current user and load agent data
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (selectedMonth && agentData) {
      fetchMonthlyData();
    }
  }, [selectedMonth, agentData]);

  const fetchCurrentUser = async () => {
    try {
      setLoading(true);
      const session = await supabase.auth.getSession();
      const authData = session.data;
      const authError = session.error;
      
      if (authError) throw authError;
      
      if (authData?.session?.user) {
        const user = authData.session.user;
        console.log("AgentDashboard - User:", user);
        setCurrentUser(user);

        // IMPORTANT: Remove any redirect logic from here
        // We rely on ProtectedRoute for access control
        
        // Get user's name from metadata if available
        const userName = user.user_metadata?.name || user.email.split('@')[0];
        console.log("AgentDashboard - User name:", userName);
        
        // Try to get employee data with a more reliable approach
        try {
          // Try with filter syntax instead of direct eq operator
          let employeeData = null;
          let employeeError = null;
          
          // First try with filter syntax
          const { data: filterData, error: filterError } = await supabase
            .from('employees')
            .select('*')
            .filter('email', 'eq', user.email);
            
          console.log("AgentDashboard - Filter query result:", filterData);
          
          if (!filterError && filterData && filterData.length > 0) {
            employeeData = filterData[0];
          } else {
            // If that fails, try with case insensitive search
            const { data: ciData, error: ciError } = await supabase
              .from('employees')
              .select('*')
              .ilike('email', user.email);
              
            console.log("AgentDashboard - Case insensitive query result:", ciData);
            
            if (!ciError && ciData && ciData.length > 0) {
              employeeData = ciData[0];
            } else {
              // If all fails, create a fallback employee record
              console.warn("No employee record found for user:", user.email);
              
              // Fallback data for presentation (won't be saved to database)
              employeeData = {
                name: userName,
                email: user.email,
                agent_company: "Unknown",
                role: "agent",
                salary_model_id: null
              };
              
              employeeError = {
                message: "No employee record found for this user"
              };
            }
          }

          console.log("AgentDashboard - Final employee data:", employeeData);
          
          if (employeeData) {
            // Now fetch the salary model separately
            let salaryModelData = null;
            
            if (employeeData.salary_model_id) {
              const { data: modelData, error: modelError } = await supabase
                .from('salary_models')
                .select('*')
                .eq('id', employeeData.salary_model_id)
                .single();
                
              console.log("AgentDashboard - Salary model data:", modelData);
              
              if (!modelError) {
                salaryModelData = modelData;
              }
            }
            
            setAgentData(employeeData);
            setSalaryModel(salaryModelData || null);
            
            // Fetch all sales data for this agent
            await fetchAgentSalesData(employeeData.name);
          } else {
            setError("Kunne ikke finne ansattdata for denne brukeren. Kontakt administrator.");
            console.error("No employee record found for user:", user.email);
          }
        } catch (fetchError) {
          console.error("Error fetching employee data:", fetchError);
          setError("Kunne ikke hente ansattdata: " + fetchError.message);
        }
      } else {
        setError("Ingen bruker er innlogget. Vennligst logg inn igjen.");
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
      setError("Feil ved henting av brukerdata: " + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchAgentSalesData = async (agentName) => {
    try {
      // Fetch all sales data for this agent
      const { data, error } = await supabase
        .from('sales_data')
        .select('*')
        .eq('agent_name', agentName);
        
      if (error) throw error;
      
      setSalesData(data || []);
      
      // Extract available months from sales data
      const months = new Set();
      data.forEach(sale => {
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
      
      // Set default month to most recent
      if (sortedMonths.length > 0) {
        setSelectedMonth(sortedMonths[0]);
      }
      
      // Process historical earnings data
      processHistoricalData(data, agentName);
      
      // Fetch salary deductions
      fetchDeductions(agentName);
      
    } catch (error) {
      console.error("Error fetching agent sales data:", error);
      setError("Feil ved henting av salgsdata: " + error.message);
    }
  };
  
  const fetchDeductions = async (agentName) => {
    try {
      // Check if agentData exists and has the needed properties
      if (!agentData) {
        console.log("No agent data available for fetching deductions");
        setDeductions([]);
        return;
      }
  
      // Create a safe query condition with only available properties
      const conditions = [];
      if (agentName) conditions.push(`employee_id.eq."${agentName}"`);
      if (agentData.id) conditions.push(`employee_id.eq."${agentData.id}"`);
      if (agentData.agent_id) conditions.push(`employee_id.eq."${agentData.agent_id}"`);
      
      // If no conditions are available, fetch all deductions (for testing)
      // or return empty array in production
      if (conditions.length === 0) {
        console.log("No valid conditions for fetching deductions");
        setDeductions([]);
        return;
      }
  
      const query = conditions.join(',');
      
      // Use the constructed OR condition
      const { data, error } = await supabase
        .from('salary_deductions')
        .select('*')
        .or(query);
        
      if (error) throw error;
      
      setDeductions(data || []);
    } catch (error) {
      console.error("Error fetching deductions:", error);
      // Don't set error state here to avoid blocking the dashboard
      setDeductions([]);
    }
  };
  
  const fetchMonthlyData = () => {
    // Filter sales data for selected month and exclude canceled sales
    const monthlySalesData = salesData.filter(sale => {
      if (!sale.policy_sale_date) return false;
      
      const date = new Date(sale.policy_sale_date);
      if (isNaN(date.getTime())) return false;
      
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      // Exclude sales with cancel_code
      if (sale.cancel_code) return false;
      
      return monthKey === selectedMonth;
    });
    
    // Process monthly sales data
    processMonthlySalesData(monthlySalesData);
  };
  
  const processHistoricalData = (salesData, agentName) => {
    // Group by month
    const monthlyData = {};
    
    salesData.forEach(sale => {
      // Skip sales with cancel_code
      if (sale.cancel_code) return;
      
      if (!sale.policy_sale_date) return;
      
      const date = new Date(sale.policy_sale_date);
      if (isNaN(date.getTime())) return;
      
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          month: monthKey,
          displayMonth: `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear().toString().substring(2)}`,
          livPremium: 0,
          skadePremium: 0,
          totalPremium: 0,
          commission: 0, // Will recalculate this properly
          saleCount: 0
        };
      }
      
      const netPremium = parseFloat(sale.net_premium_sales) || 0;
      
      // Determine insurance type
      const provisjonsgruppe = (sale.provisjonsgruppe || "").toLowerCase();
      if (provisjonsgruppe.includes("life")) {
        monthlyData[monthKey].livPremium += netPremium;
      } else if (provisjonsgruppe.includes("pc") || provisjonsgruppe.includes("child") || provisjonsgruppe.includes("skad")) {
        monthlyData[monthKey].skadePremium += netPremium;
      }
      
      monthlyData[monthKey].totalPremium += netPremium;
      monthlyData[monthKey].saleCount++;
    });
    
    // Calculate commission using the same method as monthly calculation
    Object.values(monthlyData).forEach(monthData => {
      // Calculate commission only if we have a salary model
      if (salaryModel) {
        // Base commission rates
        const livRate = parseFloat(salaryModel.commission_liv) || 0;
        const skadeRate = parseFloat(salaryModel.commission_skade) || 0;
        
        // Calculate base commission
        const baseLivCommission = monthData.livPremium * livRate / 100;
        const baseSkadeCommission = monthData.skadePremium * skadeRate / 100;
        
        let monthlyCommission = baseLivCommission + baseSkadeCommission;
        
        // Check for bonus threshold
        if (salaryModel.bonus_enabled && 
            salaryModel.bonus_threshold && 
            (monthData.livPremium + monthData.skadePremium) >= parseFloat(salaryModel.bonus_threshold)) {
          
          // Add bonus commission
          const bonusLivRate = parseFloat(salaryModel.bonus_percentage_liv) || 0;
          const bonusSkadeRate = parseFloat(salaryModel.bonus_percentage_skade) || 0;
          
          monthlyCommission += (monthData.livPremium * bonusLivRate / 100) + 
                              (monthData.skadePremium * bonusSkadeRate / 100);
        }
        
        monthData.commission = monthlyCommission;
      } else {
        // If no salary model available, estimate commission based on average rate
        // This ensures users always see something in the chart even without salary model
        const defaultLivRate = 10; // 10% default commission rate
        const defaultSkadeRate = 5; // 5% default commission rate
        monthData.commission = (monthData.livPremium * defaultLivRate / 100) + 
                               (monthData.skadePremium * defaultSkadeRate / 100);
      }
    });
    
    // Convert to array and sort by month
    const historicalData = Object.values(monthlyData)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(month => ({
        ...month,
        commission: parseFloat(month.commission.toFixed(2)),
        livPremium: parseFloat(month.livPremium.toFixed(2)),
        skadePremium: parseFloat(month.skadePremium.toFixed(2)),
        totalPremium: parseFloat(month.totalPremium.toFixed(2))
      }));
    
    setHistoricalEarnings(historicalData);
  };
  
  const processMonthlySalesData = (monthlySalesData) => {
    // Process sales data for monthly overview
    let livPremium = 0;
    let skadePremium = 0;
    let commission = 0;
    
    // Product mix data
    const products = {};
    
    monthlySalesData.forEach(sale => {
      const netPremium = parseFloat(sale.net_premium_sales) || 0;
      commission += parseFloat(sale.commission) || 0;
      
      // Determine insurance type
      const provisjonsgruppe = (sale.provisjonsgruppe || "").toLowerCase();
      if (provisjonsgruppe.includes("life")) {
        livPremium += netPremium;
      } else if (provisjonsgruppe.includes("pc") || provisjonsgruppe.includes("child") || provisjonsgruppe.includes("skad")) {
        skadePremium += netPremium;
      }
      
      // Add to product mix
      const productName = sale.product_name || "Ukjent produkt";
      if (!products[productName]) {
        products[productName] = {
          name: productName,
          value: 0,
          count: 0
        };
      }
      
      products[productName].value += netPremium;
      products[productName].count++;
    });
    
    // Create an array of days in the month with sales count
    const dailySales = {};
    const [year, month] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    
    // Initialize all days
    for (let i = 1; i <= daysInMonth; i++) {
      const dayKey = `${year}-${String(month).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      dailySales[dayKey] = {
        day: i,
        date: dayKey,
        displayDate: `${i}/${month}`,
        count: 0,
        premium: 0
      };
    }
    
    // Add sales data to days
    monthlySalesData.forEach(sale => {
      if (!sale.policy_sale_date) return;
      
      const date = new Date(sale.policy_sale_date);
      if (isNaN(date.getTime())) return;
      
      const dayKey = sale.policy_sale_date.substring(0, 10);
      if (dailySales[dayKey]) {
        dailySales[dayKey].count++;
        dailySales[dayKey].premium += parseFloat(sale.net_premium_sales) || 0;
      }
    });
    
    // Convert product mix to array and sort by value
    const productMixArray = Object.values(products)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5); // Top 5 products
      
    // Convert daily sales to array
    const dailySalesArray = Object.values(dailySales)
      .sort((a, b) => a.day - b.day);
      
    // Update state with processed data
    setMonthlySales(dailySalesArray);
    setProductMix(productMixArray);
    
    // Calculate pending commission based on salary model
    if (salaryModel) {
      let pendingCommission = 0;
      
      // Base commission rates
      const livRate = parseFloat(salaryModel.commission_liv) || 0;
      const skadeRate = parseFloat(salaryModel.commission_skade) || 0;
      
      // Calculate base commission
      const baseLivCommission = livPremium * livRate / 100;
      const baseSkadeCommission = skadePremium * skadeRate / 100;
      
      pendingCommission = baseLivCommission + baseSkadeCommission;
      
      // Check for bonus threshold
      if (salaryModel.bonus_enabled && 
          salaryModel.bonus_threshold && 
          (livPremium + skadePremium) >= parseFloat(salaryModel.bonus_threshold)) {
        
        // Add bonus commission
        const bonusLivRate = parseFloat(salaryModel.bonus_percentage_liv) || 0;
        const bonusSkadeRate = parseFloat(salaryModel.bonus_percentage_skade) || 0;
        
        pendingCommission += (livPremium * bonusLivRate / 100) + (skadePremium * bonusSkadeRate / 100);
      }
      
      setPendingCommission(pendingCommission);
    } else {
      // If no salary model is available, just use the extracted commission from sales data
      setPendingCommission(commission);
    }
  };
  
  // Calculate total deductions for the selected month
  const getMonthlyDeductions = () => {
    if (!selectedMonth || !deductions || deductions.length === 0) return 0;
    
    return deductions.reduce((total, deduction) => {
      // Check if deduction applies to this month
      if (deduction.is_recurring || 
          (deduction.created_at && deduction.created_at.startsWith(selectedMonth))) {
        return total + (parseFloat(deduction.amount) || 0);
      }
      return total;
    }, 0);
  };
  
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }
  
  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <NavigationMenu />
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      </Box>
    );
  }
  
  if (!agentData) {
    return (
      <Box sx={{ p: 3 }}>
        <NavigationMenu />
        <Alert severity="warning" sx={{ mt: 2 }}>
          Ingen ansattdata funnet for denne brukeren. Kontakt administrator.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, backgroundColor: "#f5f5f5", minHeight: "100vh" }}>
      <NavigationMenu />
      
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          Velkommen, {agentData.name}
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Din oversikt for {selectedMonth ? selectedMonth.replace('-', '/') : 'inneværende måned'}
        </Typography>
      </Box>
      
      {/* Month selector */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item>
            <Typography variant="subtitle1">Velg måned:</Typography>
          </Grid>
          <Grid item xs>
            <FormControl size="small" fullWidth sx={{ maxWidth: 200 }}>
              <InputLabel>Måned</InputLabel>
              <Select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                label="Måned"
                startAdornment={
                  <InputAdornment position="start">
                    <CalendarMonth fontSize="small" />
                  </InputAdornment>
                }
              >
                {monthOptions.map(month => (
                  <MenuItem key={month} value={month}>
                    {month.replace('-', '/')}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item>
            <Chip 
              label={`${agentData.agent_company || 'Ukjent selskap'}`} 
              color="primary" 
              variant="outlined" 
              icon={<Person />} 
            />
          </Grid>
          <Grid item>
            <Chip 
              label={`Lønnstrinn: ${salaryModel?.name || 'Ikke angitt'}`} 
              color="secondary" 
              variant="outlined" 
              icon={<AttachMoney />} 
            />
          </Grid>
        </Grid>
      </Paper>
      
      {/* Key performance metrics */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2}>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Beregnet Provisjon
              </Typography>
              <Typography variant="h5" component="div" fontWeight="bold" color="primary">
                {pendingCommission.toLocaleString('nb-NO')} kr
              </Typography>
              <Typography variant="body2" color="text.secondary">
                for {selectedMonth.replace('-', '/')}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2}>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Lønnstrekk
              </Typography>
              <Typography variant="h5" component="div" fontWeight="bold" color="error">
                {getMonthlyDeductions().toLocaleString('nb-NO')} kr
              </Typography>
              <Typography variant="body2" color="text.secondary">
                totale trekk for måneden
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2}>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Netto Utbetaling
              </Typography>
              <Typography variant="h5" component="div" fontWeight="bold" color="success.main">
                {(parseFloat(salaryModel?.base_salary || 0) + pendingCommission - getMonthlyDeductions()).toLocaleString('nb-NO')} kr
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {salaryModel ? 
                  `inkl. grunnlønn: ${parseFloat(salaryModel.base_salary || 0).toLocaleString('nb-NO')} kr` : 
                  'grunnlønn ikke tilgjengelig'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2}>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Antall Salg
              </Typography>
              <Typography variant="h5" component="div" fontWeight="bold">
                {monthlySales.reduce((total, day) => total + day.count, 0)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                for {selectedMonth.replace('-', '/')}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {/* Charts row */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={8}>
          <Paper elevation={2} sx={{ p: 3, borderRadius: 2, height: '100%' }}>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
              <ShowChart sx={{ mr: 1 }} color="primary" />
              Inntektsutvikling Over Tid
            </Typography>
            
            <Box sx={{ height: 300 }}>
              {historicalEarnings.length === 0 ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                  <Typography color="text.secondary">
                    {salesData.length === 0 ? 
                      "Ingen salgshistorikk funnet. Salgsdata vil vises her når de er tilgjengelige." : 
                      "Behandler data..."}
                  </Typography>
                </Box>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart 
                    data={historicalEarnings}
                    margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="displayMonth" 
                      padding={{ left: 10, right: 10 }} 
                    />
                    <YAxis 
                      tickFormatter={(value) => `${value/1000}k`}
                      domain={['auto', 'auto']}
                    />
                    <RechartsTooltip 
                      formatter={(value, name) => {
                        return `${value.toLocaleString('nb-NO')} kr`;
                      }}
                      labelFormatter={(value) => `Måned: ${value}`}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="commission" 
                      name="Provisjon" 
                      stroke={theme.palette.primary.main}
                      activeDot={{ r: 8 }}
                      strokeWidth={2}
                      dot={{ fill: theme.palette.primary.main, strokeWidth: 2 }}
                    />
                    {/* Add a reference line or marker for the selected month */}
                    {historicalEarnings.find(item => item.month === selectedMonth) && (
                      <ReferenceLine
                        x={historicalEarnings.find(item => item.month === selectedMonth).displayMonth}
                        stroke={theme.palette.secondary.main}
                        strokeWidth={2}
                        strokeDasharray="3 3"
                        label={{
                          value: "Valgt måned",
                          position: "top",
                          fill: theme.palette.secondary.main
                        }}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Box>
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Paper elevation={2} sx={{ p: 3, borderRadius: 2, height: '100%' }}>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
              <PieChart sx={{ mr: 1 }} color="primary" />
              Topp Produkter
            </Typography>
            
            <Box sx={{ height: 300 }}>
              {productMix.length === 0 ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                  <Typography color="text.secondary">Ingen produktdata funnet</Typography>
                </Box>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={productMix} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(value) => `${value/1000}k`} />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      width={100}
                      tickFormatter={(value) => value.length > 15 ? `${value.slice(0, 15)}...` : value}
                    />
                    <RechartsTooltip 
                      formatter={(value, name, props) => `${value.toLocaleString('nb-NO')} kr`}
                      labelFormatter={(value) => `${value}`}
                    />
                    <Bar 
                      dataKey="value" 
                      name="Premium" 
                      fill={theme.palette.primary.main}
                    >
                      {productMix.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>
      
      {/* Daily sales performance */}
      <Paper elevation={2} sx={{ p: 3, borderRadius: 2, mb: 3 }}>
        <Typography variant="h6" fontWeight="bold" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
          <TrendingUp sx={{ mr: 1 }} color="primary" />
          Daglig Salgsytelse
        </Typography>
        
        <Box sx={{ height: 300 }}>
          {monthlySales.length === 0 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <Typography color="text.secondary">Ingen salgsdata funnet</Typography>
            </Box>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlySales}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="displayDate" />
                <YAxis yAxisId="left" orientation="left" />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => `${value/1000}k`} />
                <RechartsTooltip 
                  formatter={(value, name) => {
                    if (name === 'Antall salg') return [`${value}`, name];
                    return [`${value.toLocaleString('nb-NO')} kr`, name];
                  }}
                  labelFormatter={(value) => `Dag ${value}`}
                />
                <Legend />
                <Bar 
                  yAxisId="left"
                  dataKey="count" 
                  name="Antall salg" 
                  fill={theme.palette.primary.main} 
                  barSize={20}
                />
                <Bar 
                  yAxisId="right"
                  dataKey="premium" 
                  name="Premium (kr)" 
                  fill={theme.palette.secondary.main} 
                  barSize={20}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Box>
      </Paper>
      
      {/* Deductions table */}
      <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
        <Typography variant="h6" fontWeight="bold" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
          <Receipt sx={{ mr: 1 }} color="primary" />
          Lønnstrekk
        </Typography>
        
        {deductions.length === 0 ? (
          <Alert severity="info">Ingen lønnstrekk registrert.</Alert>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Beskrivelse</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell align="right">Beløp</TableCell>
                  <TableCell>Månedlig</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {deductions.map((deduction) => (
                  <TableRow key={deduction.id}>
                    <TableCell>{deduction.name}</TableCell>
                    <TableCell>
                      <Chip 
                        label={deduction.type || 'Annet'} 
                        size="small" 
                        color="primary" 
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right">
                      {parseFloat(deduction.amount).toLocaleString('nb-NO')} kr
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={deduction.is_recurring ? 'Ja' : 'Nei'} 
                        size="small" 
                        color={deduction.is_recurring ? 'success' : 'default'} 
                        variant="outlined"
                      />
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={2} sx={{ fontWeight: 'bold' }}>
                    Total
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: theme.palette.error.main }}>
                    {deductions.reduce((sum, d) => sum + parseFloat(d.amount), 0).toLocaleString('nb-NO')} kr
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
}

export default AgentDashboard;
