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
} from "@mui/icons-material";
import { useTheme } from '@mui/material/styles';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';

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
      
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
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
            disabled
          />
        </Tabs>
      </Box>

      {/* Results summary */}
      <Typography variant="subtitle1" sx={{ mb: 2 }}>
        {`Viser ${filteredRows.length} av ${allRows.length} rader`}
        {filterMonth && ` (Måned: ${filterMonth})`}
        {filterAgent && ` (Agent: ${filterAgent})`}
        {filterInsurance && ` (Type: ${filterInsurance})`}
      </Typography>

      {/* TanStack Table */}
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
    </Box>
  );
}

export default SalesDataDashboard;
