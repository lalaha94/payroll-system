import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "./supabaseClient";
import { Link } from "react-router-dom";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
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
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { 
  CalendarMonth, 
  FilterAlt, 
  PersonSearch, 
  Search, 
  Refresh, 
  BarChart, 
  TableChart,
  Money,
  Assignment,
  CreditCard,
  KeyboardArrowUp,
  KeyboardArrowDown,
  PieChart as PieChartIcon,
  ShowChart as ShowChartIcon,
  Timeline,
  Assessment,
} from "@mui/icons-material";
import { useTheme } from '@mui/material/styles';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  BarChart as RechartsBarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  Label
} from 'recharts';

/**
 * Henter lønnstrinn fra Supabase.
 */
async function fetchSalaryModels() {
  const { data, error } = await supabase.from("salary_models").select("*");
  if (error) {
    console.error("Feil ved henting av lønnstrinn:", error);
    return [];
  }
  return data;
}

/**
 * Beregner provisjonen basert på provisjonsgrunnlag, lønnstrinn og forsikringstype.
 */
function calculateCommission(provisjonsgrunnlag, salaryModels, insuranceType) {
  const model =
    insuranceType === "Liv"
      ? salaryModels.find((m) => m.commission_liv != null)
      : salaryModels.find((m) => m.commission_skade != null);
  if (!model || !provisjonsgrunnlag) return 0;
  if (insuranceType === "Liv") {
    return (provisjonsgrunnlag * parseFloat(model.commission_liv)) / 100;
  } else if (insuranceType === "Skadeforsikring") {
    return (provisjonsgrunnlag * parseFloat(model.commission_skade)) / 100;
  }
  return 0;
}

/**
 * Returnerer en streng for året og måneden (YYYY-MM) basert på policy_sale_date.
 */
function getMonthKey(policySaleDate) {
  if (!policySaleDate) return "Ukjent";
  const d = new Date(policySaleDate);
  if (isNaN(d.getTime())) return "Ukjent";
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Aggregerer salgsdata etter agent, med separate kolonner for Liv og Skadeforsikring.
 */
function aggregateSalesByAgent(sales) {
  const byAgent = {};
  const uniqueMonths = new Set();

  for (const sale of sales) {
    const { agent_id, agent_name, policy_sale_date, provisjonsgruppe } = sale;
    const monthKey = getMonthKey(policy_sale_date);
    uniqueMonths.add(monthKey);

    // Bestem forsikringstype med robust sjekk
    let insuranceType = "";
    if (provisjonsgruppe) {
      const grp = provisjonsgruppe.toLowerCase();
      if (grp.includes("life")) {
        insuranceType = "Liv";
      } else if (grp.includes("pc") || grp.includes("child") || grp.includes("skad")) {
        insuranceType = "Skadeforsikring";
      } else {
        insuranceType = provisjonsgruppe;
      }
    } else {
      insuranceType = "Ukjent";
    }

    // Parse net_premium_sales
    let netPremium = 0;
    if (sale.net_premium_sales !== null && sale.net_premium_sales !== undefined) {
      let rawValue = sale.net_premium_sales;
      
      // If it's already a number, use it directly
      if (typeof rawValue === 'number') {
        netPremium = rawValue;
      } else {
        // Convert to string and clean it
        const rawStr = String(rawValue);
        
        // Handle different number formats
        // ...existing code for parsing numbers...
      }
    }

    // Create or update agent record
    const agentKey = `${agent_id}-${monthKey}`;
    if (!byAgent[agentKey]) {
      byAgent[agentKey] = {
        id: agentKey,
        agent_id,
        agent_name,
        monthKey,
        livPremium: 0,
        livCount: 0,
        skadePremium: 0,
        skadeCount: 0,
        totalPremium: 0,
        totalCount: 0,
        salary_level: sale.salary_level || 1 // Use the salary level from data or default to 1
      };
    }

    // Update agent sales data based on insurance type
    if (insuranceType === "Liv") {
      byAgent[agentKey].livPremium += netPremium;
      byAgent[agentKey].livCount += 1;
    } else if (insuranceType === "Skadeforsikring") {
      byAgent[agentKey].skadePremium += netPremium;
      byAgent[agentKey].skadeCount += 1;
    }

    // Update totals
    byAgent[agentKey].totalPremium += netPremium;
    byAgent[agentKey].totalCount += 1;
  }

  return { 
    agents: Object.values(byAgent), 
    uniqueMonths: Array.from(uniqueMonths) 
  };
}

// Custom formatted cell renderer
const FormattedCell = ({ value, type, valuePrefix = '', valueSuffix = ' kr', color }) => {
  const theme = useTheme();
  
  if (type === 'money') {
    const num = typeof value === 'number' ? value : Number(value);
    return (
      <Typography
        variant="body2"
        sx={{ 
          color: color || theme.palette.success.main,
          fontWeight: 'bold'
        }}
      >
        {!isNaN(num) 
          ? valuePrefix + num.toLocaleString('nb-NO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + valueSuffix
          : valuePrefix + '0,00' + valueSuffix}
      </Typography>
    );
  } else if (type === 'chip') {
    return (
      <Chip 
        label={value} 
        size="small"
        color={color || "default"}
        variant="outlined"
      />
    );
  }
  
  return <span>{value}</span>;
};

function SalesDataDashboard() {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [allRows, setAllRows] = useState([]);
  const [salaryModels, setSalaryModels] = useState([]);
  const [filterMonth, setFilterMonth] = useState("");
  const [filterAgent, setFilterAgent] = useState("");
  const [filterInsurance, setFilterInsurance] = useState("");
  const [viewMode, setViewMode] = useState("table");
  const [summaryStats, setSummaryStats] = useState({
    totalPremium: 0,
    totalSales: 0,
    totalCommission: 0,
    agentCount: 0
  });
  const [monthlyData, setMonthlyData] = useState([]);
  const [productDistribution, setProductDistribution] = useState([]);
  const [agentPerformance, setAgentPerformance] = useState([]);
  const [cancelReasons, setCancelReasons] = useState([]);
  const [topAgents, setTopAgents] = useState([]);
  
  // Custom colors for charts
  const CHART_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];
  
  // Sorting state for TanStack Table
  const [sorting, setSorting] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    try {
      // Fetch sales data and salary models in parallel
      const [salesResponse, modelsResponse] = await Promise.all([
        supabase.from("sales_data").select("*"),
        fetchSalaryModels()
      ]);
      
      if (salesResponse.error) {
        throw new Error(`Feil ved henting av salgsdata: ${salesResponse.error.message}`);
      }
      
      const salesData = salesResponse.data;
      const models = modelsResponse;
      
      setSalaryModels(models);
      
      // Log the first few items to debug the data structure
      console.log("DEBUG: Sample data from Supabase:", 
        salesData.slice(0, 3).map(item => ({
          agent: item.agent_id,
          net_premium_raw: item.net_premium_sales,
          type: typeof item.net_premium_sales
        }))
      );

      // Use the new aggregation function
      const { agents, uniqueMonths } = aggregateSalesByAgent(salesData);
      
      // Calculate summary statistics
      const stats = {
        totalPremium: agents.reduce((sum, agent) => sum + agent.totalPremium, 0),
        totalSales: agents.reduce((sum, agent) => sum + agent.totalCount, 0),
        totalCommission: 0,
        agentCount: new Set(agents.map(agent => agent.agent_id)).size
      };
      
      // Calculate total commission
      stats.totalCommission = agents.reduce((sum, agent) => {
        const livCommission = calculateCommission(agent.livPremium, models, "Liv");
        const skadeCommission = calculateCommission(agent.skadePremium, models, "Skadeforsikring");
        return sum + livCommission + skadeCommission;
      }, 0);
      
      setSummaryStats(stats);
      setAllRows(agents);
      
      // Debug logs
      console.log("DEBUG: First 3 agents:", agents.slice(0, 3));
      
      // Process data for charts
      processChartData(salesData);
      
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Process data for charts
  const processChartData = (salesData) => {
    // Monthly sales data for line chart
    const monthMap = {};
    const productMap = {};
    const agentMap = {};
    const reasonMap = {};
    
    salesData.forEach(sale => {
      // Skip entries without valid dates or amounts
      if (!sale.policy_sale_date || !sale.net_premium_sales) return;
      
      // Process monthly data
      const date = new Date(sale.policy_sale_date);
      if (isNaN(date.getTime())) return;
      
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthMap[monthKey]) {
        monthMap[monthKey] = {
          month: monthKey,
          sales: 0,
          commission: 0,
          count: 0
        };
      }
      
      monthMap[monthKey].sales += Number(sale.net_premium_sales) || 0;
      monthMap[monthKey].commission += Number(sale.commission) || 0;
      monthMap[monthKey].count += 1;
      
      // Process product distribution data
      if (sale.product_name) {
        if (!productMap[sale.product_name]) {
          productMap[sale.product_name] = {
            name: sale.product_name,
            value: 0,
            count: 0
          };
        }
        productMap[sale.product_name].value += Number(sale.net_premium_sales) || 0;
        productMap[sale.product_name].count += 1;
      }
      
      // Process agent performance data
      if (sale.agent_name) {
        if (!agentMap[sale.agent_name]) {
          agentMap[sale.agent_name] = {
            name: sale.agent_name,
            sales: 0,
            commission: 0,
            count: 0
          };
        }
        agentMap[sale.agent_name].sales += Number(sale.net_premium_sales) || 0;
        agentMap[sale.agent_name].commission += Number(sale.commission) || 0;
        agentMap[sale.agent_name].count += 1;
      }

      // Process cancel reasons data
      if (sale.cancel_reason) {
        if (!reasonMap[sale.cancel_reason]) {
          reasonMap[sale.cancel_reason] = {
            name: sale.cancel_reason,
            count: 0,
            value: 0
          };
        }
        reasonMap[sale.cancel_reason].count += 1;
        reasonMap[sale.cancel_reason].value += Number(sale.net_premium_sales) || 0;
      }
    });
    
    // Convert to arrays and sort
    setMonthlyData(Object.values(monthMap)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(item => ({
        ...item,
        sales: Number(item.sales.toFixed(2)),
        commission: Number(item.commission.toFixed(2))
      }))
    );
    
    setProductDistribution(Object.values(productMap)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
      .map(item => ({
        ...item,
        value: Number(item.value.toFixed(2))
      }))
    );
    
    setAgentPerformance(Object.values(agentMap)
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 10)
      .map(item => ({
        ...item,
        sales: Number(item.sales.toFixed(2)),
        commission: Number(item.commission.toFixed(2))
      }))
    );

    setCancelReasons(Object.values(reasonMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
    );
    
    setTopAgents(Object.values(agentMap)
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 10)
      .map(item => ({
        ...item,
        sales: Number(item.sales.toFixed(2)),
        commission: Number(item.commission.toFixed(2)),
        efficiency: item.sales > 0 ? Number((item.commission / item.sales * 100).toFixed(2)) : 0
      }))
    );
  };

  const handleClearFilters = () => {
    setFilterMonth("");
    setFilterAgent("");
    setFilterInsurance("");
  };

  // Filter rows based on user input
  const filteredRows = useMemo(() => {
    return allRows.filter((row) => {
      return (
        (filterMonth ? row.monthKey.includes(filterMonth) : true) &&
        (filterAgent ? row.agent_name.toLowerCase().includes(filterAgent.toLowerCase()) : true) &&
        true
      );
    });
  }, [allRows, filterMonth, filterAgent, filterInsurance]);

  // Define columns for TanStack Table
  const columns = useMemo(() => [
    {
      accessorKey: 'monthKey',
      header: 'Måned',
      cell: info => info.getValue(),
    },
    {
      accessorKey: 'agent_id',
      header: 'Agent ID',
    },
    {
      accessorKey: 'agent_name',
      header: 'Agent Navn',
    },
    {
      accessorKey: 'livPremium',
      header: 'Liv Premium',
      cell: info => <FormattedCell value={info.getValue()} type="money" color={theme.palette.info.main} />,
    },
    {
      accessorKey: 'livCount',
      header: 'Liv Antall',
      cell: info => <FormattedCell value={info.getValue()} type="chip" color="info" valueSuffix="" valuePrefix="" />,
    },
    {
      id: 'livCommission',
      header: 'Liv Provisjon',
      accessorFn: row => calculateCommission(row.livPremium, salaryModels, "Liv"),
      cell: info => <FormattedCell value={info.getValue()} type="money" color={theme.palette.info.dark} />,
    },
    {
      accessorKey: 'skadePremium',
      header: 'Skade Premium',
      cell: info => <FormattedCell value={info.getValue()} type="money" color={theme.palette.secondary.main} />,
    },
    {
      accessorKey: 'skadeCount',
      header: 'Skade Antall',
      cell: info => <FormattedCell value={info.getValue()} type="chip" color="secondary" valueSuffix="" valuePrefix="" />,
    },
    {
      id: 'skadeCommission',
      header: 'Skade Provisjon',
      accessorFn: row => calculateCommission(row.skadePremium, salaryModels, "Skadeforsikring"),
      cell: info => <FormattedCell value={info.getValue()} type="money" color={theme.palette.secondary.dark} />,
    },
    {
      accessorKey: 'totalPremium',
      header: 'Total Premium',
      cell: info => <FormattedCell value={info.getValue()} type="money" color={theme.palette.success.main} />,
    },
    {
      accessorKey: 'totalCount',
      header: 'Total Antall',
      cell: info => <FormattedCell value={info.getValue()} type="chip" color="success" valueSuffix="" valuePrefix="" />,
    },
    {
      id: 'totalCommission',
      header: 'Total Provisjon',
      accessorFn: row => {
        const livCommission = calculateCommission(row.livPremium, salaryModels, "Liv");
        const skadeCommission = calculateCommission(row.skadePremium, salaryModels, "Skadeforsikring");
        return livCommission + skadeCommission;
      },
      cell: info => <FormattedCell value={info.getValue()} type="money" color={theme.palette.success.dark} />,
    },
  ], [salaryModels, theme]);

  // Configure the TanStack Table instance
  const table = useReactTable({
    data: filteredRows,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
      columnVisibility: {
        livCount: false,
        skadeCount: false,
      },
    },
  });

  if (loading) {
    return (
      <Box sx={{ mt: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
        <CircularProgress size={60} thickness={4} />
        <Typography variant="h6" sx={{ mt: 2 }}>Laster salgsdata...</Typography>
        <Typography variant="body2" color="text.secondary">Vennligst vent</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, backgroundColor: "#f5f5f5", minHeight: "100vh" }}>
      {/* Navigation Buttons - Modern & Minimalistic */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 4 }}>
        <Stack direction="row" spacing={1.5}>
          <Button 
            component={Link} 
            to="/employees" 
            variant="outlined"
            size="small"
            sx={{ 
              borderRadius: '20px',
              textTransform: 'none',
              px: 2,
              fontWeight: 500,
              borderColor: 'rgba(0, 0, 0, 0.12)',
              color: 'text.primary',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.04)',
                borderColor: 'rgba(0, 0, 0, 0.23)',
              }
            }}
          >
            Se ansatte
          </Button>
          <Button 
            component={Link} 
            to="/salary-models" 
            variant="outlined"
            size="small"
            sx={{ 
              borderRadius: '20px',
              textTransform: 'none',
              px: 2,
              fontWeight: 500,
              borderColor: 'rgba(0, 0, 0, 0.12)',
              color: 'text.primary',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.04)',
                borderColor: 'rgba(0, 0, 0, 0.23)',
              }
            }}
          >
            Administrer lønnstrinn
          </Button>
          <Button 
            component={Link} 
            to="/sales-data" 
            variant="contained"
            size="small"
            disableElevation
            sx={{ 
              borderRadius: '20px',
              textTransform: 'none',
              px: 2,
              fontWeight: 500,
              backgroundColor: theme.palette.primary.main,
              '&:hover': {
                backgroundColor: theme.palette.primary.dark,
              }
            }}
          >
            Last opp salgsdata
          </Button>
          <Button 
            component={Link} 
            to="/salary-deductions" 
            variant="outlined"
            size="small"
            sx={{ 
              borderRadius: '20px',
              textTransform: 'none',
              px: 2,
              fontWeight: 500,
              borderColor: 'rgba(0, 0, 0, 0.12)',
              color: 'text.primary',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.04)',
                borderColor: 'rgba(0, 0, 0, 0.23)',
              }
            }}
          >
            Lønnstrekk
          </Button>
        </Stack>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2} sx={{ height: '100%', borderRadius: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Typography color="text.secondary" variant="subtitle2" gutterBottom>
                  Totalt Premium
                </Typography>
                <Money color="primary" />
              </Box>
              <Typography variant="h5" component="div" fontWeight="bold" sx={{ mb: 1, color: theme.palette.success.main }}>
                {summaryStats.totalPremium.toLocaleString('nb-NO', { minimumFractionDigits: 2 })} kr
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Netto premie solgt
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2} sx={{ height: '100%', borderRadius: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Typography color="text.secondary" variant="subtitle2" gutterBottom>
                  Total Provisjon
                </Typography>
                <BarChart color="primary" />
              </Box>
              <Typography variant="h5" component="div" fontWeight="bold" sx={{ mb: 1, color: theme.palette.primary.main }}>
                {summaryStats.totalCommission.toLocaleString('nb-NO', { minimumFractionDigits: 2 })} kr
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Opptjent provisjon
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2} sx={{ height: '100%', borderRadius: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Typography color="text.secondary" variant="subtitle2" gutterBottom>
                  Antall Salg
                </Typography>
                <Assignment color="primary" />
              </Box>
              <Typography variant="h5" component="div" fontWeight="bold" sx={{ mb: 1 }}>
                {summaryStats.totalSales.toLocaleString('nb-NO')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Totalt antall kontrakter
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2} sx={{ height: '100%', borderRadius: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Typography color="text.secondary" variant="subtitle2" gutterBottom>
                  Aktive Agenter
                </Typography>
                <PersonSearch color="primary" />
              </Box>
              <Typography variant="h5" component="div" fontWeight="bold" sx={{ mb: 1 }}>
                {summaryStats.agentCount}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Agenter med salg
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {/* Filterpanel */}
      <Card elevation={2} sx={{ mb: 3, borderRadius: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box display="flex" alignItems="center">
              <FilterAlt color="primary" sx={{ mr: 1 }} />
              <Typography variant="h6">Filtrer data</Typography>
            </Box>
            <Box>
              <Tooltip title="Oppdater data">
                <IconButton onClick={fetchData} color="primary">
                  <Refresh />
                </IconButton>
              </Tooltip>
              <Tooltip title="Nullstill filtre">
                <IconButton onClick={handleClearFilters} color="secondary">
                  <FilterAlt />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
          
          <Divider sx={{ mb: 2 }} />
          
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Filtrer på Måned"
                placeholder="YYYY-MM"
                fullWidth
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <CalendarMonth color="action" />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Filtrer på Agent Navn"
                fullWidth
                placeholder="Søk etter agent"
                value={filterAgent}
                onChange={(e) => setFilterAgent(e.target.value)}
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
              <FormControl fullWidth>
                <InputLabel id="insurance-filter-label">Forsikringstype</InputLabel>
                <Select
                  labelId="insurance-filter-label"
                  label="Forsikringstype"
                  value={filterInsurance}
                  onChange={(e) => setFilterInsurance(e.target.value)}
                >
                  <MenuItem value="">Alle typer</MenuItem>
                  <MenuItem value="Liv">Liv</MenuItem>
                  <MenuItem value="Skadeforsikring">Skadeforsikring</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* View selector */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs
          value={viewMode}
          onChange={(e, newValue) => setViewMode(newValue)}
          aria-label="visningsalternativer"
        >
          <Tab 
            icon={<TableChart />} 
            label="Tabellvisning" 
            value="table" 
            iconPosition="start"
          />
          <Tab 
            icon={<BarChart />} 
            label="Grafisk Visning" 
            value="chart" 
            iconPosition="start"
          />
        </Tabs>
      </Box>

      {/* Results summary */}
      <Typography variant="subtitle1" sx={{ mb: 2 }}>
        {viewMode === "table" && 
          `Viser ${filteredRows.length} av ${allRows.length} rader
           ${filterMonth ? ` (Måned: ${filterMonth})` : ''}
           ${filterAgent ? ` (Agent: ${filterAgent})` : ''}
           ${filterInsurance ? ` (Type: ${filterInsurance})` : ''}`
        }
        {viewMode === "chart" && 
          "Grafisk analyse av salgsdata"
        }
      </Typography>

      {viewMode === "table" ? (
        /* TanStack Table */
        <Paper sx={{ borderRadius: 2, overflow: 'hidden' }} elevation={3}>
          <TableContainer>
            <Table>
              <TableHead>
                {table.getHeaderGroups().map(headerGroup => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <TableCell
                        key={header.id}
                        sx={{
                          backgroundColor: theme.palette.primary.main,
                          color: 'white',
                          fontWeight: 'bold',
                          padding: '16px',
                          cursor: header.column.getCanSort() ? 'pointer' : 'default',
                        }}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <Box display="flex" alignItems="center">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getIsSorted() ? (
                            header.column.getIsSorted() === 'desc' ? (
                              <KeyboardArrowDown sx={{ ml: 1 }} />
                            ) : (
                              <KeyboardArrowUp sx={{ ml: 1 }} />
                            )
                          ) : null}
                        </Box>
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableHead>
              <TableBody>
                {table.getRowModel().rows.map(row => (
                  <TableRow 
                    key={row.id}
                    hover
                    sx={{ '&:hover': { backgroundColor: '#f9f9f9' } }}
                  >
                    {row.getVisibleCells().map(cell => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end', backgroundColor: '#f0f0f0' }}>
            <TablePagination
              rowsPerPageOptions={[10, 25, 50]}
              component="div"
              count={table.getFilteredRowModel().rows.length}
              rowsPerPage={table.getState().pagination.pageSize}
              page={table.getState().pagination.pageIndex}
              onPageChange={(event, newPage) => {
                table.setPageIndex(newPage);
              }}
              onRowsPerPageChange={e => {
                table.setPageSize(Number(e.target.value));
              }}
              labelRowsPerPage="Rader per side:"
              labelDisplayedRows={({ from, to, count }) => `${from}-${to} av ${count}`}
            />
          </Box>
        </Paper>
      ) : (
        /* Charts View */
        <Grid container spacing={3}>
          {/* Sales Performance Over Time */}
          <Grid item xs={12}>
            <Paper elevation={3} sx={{ p: 3, borderRadius: 2, height: 400 }}>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
                <ShowChartIcon sx={{ mr: 1 }} color="primary" />
                Salg og provisjon over tid
              </Typography>
              
              {monthlyData.length === 0 ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80%' }}>
                  <Typography color="text.secondary">Ingen data tilgjengelig</Typography>
                </Box>
              ) : (
                <ResponsiveContainer width="100%" height={310}>
                  <LineChart data={monthlyData} margin={{ top: 10, right: 30, left: 20, bottom: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="month" 
                      angle={-45} 
                      textAnchor="end" 
                      height={60}
                      tickFormatter={(value) => {
                        const [year, month] = value.split('-');
                        return `${month}/${year.substring(2)}`;
                      }}
                    />
                    <YAxis yAxisId="left" tickFormatter={(value) => `${value / 1000}k`}>
                      <Label value="Salg (NOK)" angle={-90} position="insideLeft" style={{ textAnchor: 'middle' }} />
                    </YAxis>
                    <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => `${value / 1000}k`}>
                      <Label value="Provisjon (NOK)" angle={90} position="insideRight" style={{ textAnchor: 'middle' }} />
                    </YAxis>
                    <RechartsTooltip 
                      formatter={(value) => value.toLocaleString('nb-NO', { minimumFractionDigits: 2 }) + ' kr'}
                      labelFormatter={(value) => {
                        const [year, month] = value.split('-');
                        return `${month}/${year}`;
                      }}
                    />
                    <Legend verticalAlign="top" height={36} />
                    <Line 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="sales" 
                      name="Salg" 
                      stroke="#8884d8" 
                      activeDot={{ r: 8 }} 
                      strokeWidth={2}
                    />
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="commission" 
                      name="Provisjon" 
                      stroke="#82ca9d" 
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Paper>
          </Grid>
          
          {/* Top Performing Agents */}
          <Grid item xs={12} md={8}>
            <Paper elevation={3} sx={{ p: 3, borderRadius: 2, height: 400 }}>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
                <Assessment sx={{ mr: 1 }} color="primary" />
                Topp selgere
              </Typography>
              
              {agentPerformance.length === 0 ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80%' }}>
                  <Typography color="text.secondary">Ingen data tilgjengelig</Typography>
                </Box>
              ) : (
                <ResponsiveContainer width="100%" height={310}>
                  <RechartsBarChart data={agentPerformance} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(value) => `${value / 1000}k`} />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      tick={{ fontSize: 12 }}
                      width={100}
                      tickFormatter={(value) => {
                        return value.length > 15 ? value.substring(0, 13) + '...' : value;
                      }}
                    />
                    <RechartsTooltip formatter={(value) => value.toLocaleString('nb-NO', { minimumFractionDigits: 2 }) + ' kr'} />
                    <Legend />
                    <Bar dataKey="sales" name="Salg" fill="#8884d8" />
                    <Bar dataKey="commission" name="Provisjon" fill="#82ca9d" />
                  </RechartsBarChart>
                </ResponsiveContainer>
              )}
            </Paper>
          </Grid>
          
          {/* Product Distribution Pie Chart */}
          <Grid item xs={12} md={4}>
            <Paper elevation={3} sx={{ p: 3, borderRadius: 2, height: 400 }}>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
                <PieChartIcon sx={{ mr: 1 }} color="primary" />
                Salg per produkt
              </Typography>
              
              {productDistribution.length === 0 ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80%' }}>
                  <Typography color="text.secondary">Ingen data tilgjengelig</Typography>
                </Box>
              ) : (
                <ResponsiveContainer width="100%" height={310}>
                  <PieChart>
                    <Pie
                      data={productDistribution}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={(entry) => entry.name.substring(0, 15) + (entry.name.length > 15 ? '...' : '')}
                    >
                      {productDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(value) => value.toLocaleString('nb-NO', { minimumFractionDigits: 2 }) + ' kr'} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </Paper>
          </Grid>
          
          {/* Cancellation Reasons Chart - NEW */}
          <Grid item xs={12} md={6}>
            <Paper elevation={3} sx={{ p: 3, borderRadius: 2, height: 400 }}>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
                <CreditCard sx={{ mr: 1 }} color="primary" />
                Kansellerings-årsaker
              </Typography>
              
              {cancelReasons.length === 0 ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80%' }}>
                  <Typography color="text.secondary">Ingen kanselleringsdata tilgjengelig</Typography>
                </Box>
              ) : (
                <ResponsiveContainer width="100%" height={310}>
                  <RechartsBarChart data={cancelReasons} margin={{ top: 5, right: 30, left: 30, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="name" 
                      angle={-45} 
                      textAnchor="end" 
                      height={100}
                      tick={{ fontSize: 10 }}
                      tickFormatter={(value) => {
                        return value.length > 15 ? value.substring(0, 13) + '...' : value;
                      }}
                    />
                    <YAxis />
                    <RechartsTooltip formatter={(value, name) => {
                      if (name === 'count') return `${value} kanselleringer`;
                      return value.toLocaleString('nb-NO', { minimumFractionDigits: 2 }) + ' kr';
                    }} />
                    <Legend />
                    <Bar dataKey="count" name="Antall kanselleringer" fill="#FF8042" />
                    <Bar dataKey="value" name="Premium verdi" fill="#ff4081" />
                  </RechartsBarChart>
                </ResponsiveContainer>
              )}
            </Paper>
          </Grid>
          
          {/* Top Agents Performance Chart - NEW */}
          <Grid item xs={12} md={6}>
            <Paper elevation={3} sx={{ p: 3, borderRadius: 2, height: 400 }}>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
                <PersonSearch sx={{ mr: 1 }} color="primary" />
                Topp agenter effektivitet
              </Typography>
              
              {topAgents.length === 0 ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80%' }}>
                  <Typography color="text.secondary">Ingen data tilgjengelig</Typography>
                </Box>
              ) : (
                <ResponsiveContainer width="100%" height={310}>
                  <RechartsBarChart 
                    data={topAgents.slice(0, 5)} 
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis yAxisId="left" orientation="left" tickFormatter={(value) => `${value / 1000}k`}>
                      <Label value="Beløp (NOK)" angle={-90} position="insideLeft" style={{ textAnchor: 'middle' }} />
                    </YAxis>
                    <YAxis yAxisId="right" orientation="right" domain={[0, 100]}>
                      <Label value="Effektivitet (%)" angle={90} position="insideRight" style={{ textAnchor: 'middle' }} />
                    </YAxis>
                    <RechartsTooltip formatter={(value, name) => {
                      if (name === 'efficiency') return `${value}%`;
                      return value.toLocaleString('nb-NO', { minimumFractionDigits: 2 }) + ' kr';
                    }} />
                    <Legend />
                    <Bar yAxisId="left" dataKey="sales" name="Salgsvolum" fill="#3f51b5" />
                    <Bar yAxisId="left" dataKey="commission" name="Provisjon" fill="#009688" />
                    <Bar yAxisId="right" dataKey="efficiency" name="Effektivitet" fill="#ff9800" />
                  </RechartsBarChart>
                </ResponsiveContainer>
              )}
            </Paper>
          </Grid>
          
          {/* Transaction Counts by Month */}
          <Grid item xs={12}>
            <Paper elevation={3} sx={{ p: 3, borderRadius: 2, height: 350 }}>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
                <Timeline sx={{ mr: 1 }} color="primary" />
                Antall salg per måned
              </Typography>
              
              {monthlyData.length === 0 ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80%' }}>
                  <Typography color="text.secondary">Ingen data tilgjengelig</Typography>
                </Box>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <RechartsBarChart data={monthlyData} margin={{ top: 5, right: 30, left: 20, bottom: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="month" 
                      angle={-45} 
                      textAnchor="end" 
                      height={60}
                      tickFormatter={(value) => {
                        const [year, month] = value.split('-');
                        return `${month}/${year.substring(2)}`;
                      }}
                    />
                    <YAxis />
                    <RechartsTooltip />
                    <Legend />
                    <Bar dataKey="count" name="Antall salg" fill="#FF8042" />
                  </RechartsBarChart>
                </ResponsiveContainer>
              )}
            </Paper>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}

export default SalesDataDashboard;
