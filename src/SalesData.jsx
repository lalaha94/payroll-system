import React, { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "./supabaseClient";
import { Link } from "react-router-dom";
import {
  Container,
  Typography,
  Paper,
  Button,
  Box,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  IconButton,
  Tooltip,
  Stack,
  Alert,
  AlertTitle,
  Chip,
  InputAdornment,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from "@mui/material";
import {
  CloudUpload,
  Delete,
  Edit,
  Refresh,
  Search,
  Save,
  Cancel,
  Receipt,
  UploadFile,
  FilePresent,
  InsertDriveFile,
  Analytics,
  EventNote
} from "@mui/icons-material";
import { useTheme } from "@mui/material/styles";

/**
 * fixDate:
 *  - Konverterer "0" eller tom streng til null.
 *  - Konverterer "2958465" til "9999-12-31".
 *  - Konverterer Excel numeriske datoer (f.eks. "45629") til ISO-format "yyyy-mm-dd".
 *  - Parser "dd.mm.yyyy" (f.eks. "12.3.2024") til ISO-format "yyyy-mm-dd".
 *  - Returnerer ellers uendret verdi.
 */
function fixDate(val) {
  if (val === null || val === undefined) return null;

  // Konverter alt til streng for å håndtere trim og regex
  val = val.toString().trim();

  // "0" eller tom streng => null
  if (val === "" || val === "0") {
    return null;
  }

  // 2958465 => 9999-12-31 (typisk sentinel for "evig" varighet)
  if (val === "2958465") {
    return "9999-12-31";
  }

  // Håndter Excel-datoformater (lagret som dager siden 1900-01-01)
  // Typisk vil dette være tall i området 10000-99999
  if (/^\d{5,6}$/.test(val)) {
    try {
      // Konverter til heltall
      const excelDays = parseInt(val, 10);
      
      // Excel har en feil der de regner 1900 som et skuddår
      // Dette gir en off-by-one feil for datoer etter 28.02.1900
      // Vi må justere for dette hvis datoen er større enn 59
      // (59 er 28.02.1900 i Excel sin telling)
      const adjustedDays = excelDays > 59 ? excelDays - 1 : excelDays;
      
      // Lag et Date-objekt basert på Excel-epoken (1900-01-01)
      // og legg til antall dager
      const excelEpoch = new Date(1900, 0, 1); // 1900-01-01
      excelEpoch.setDate(excelEpoch.getDate() + adjustedDays - 1);
      
      // Formater til ISO-dato (yyyy-mm-dd)
      const year = excelEpoch.getFullYear();
      const month = String(excelEpoch.getMonth() + 1).padStart(2, '0');
      const day = String(excelEpoch.getDate()).padStart(2, '0');
      
      return `${year}-${month}-${day}`;
    } catch (e) {
      console.error("Feil ved konvertering av Excel-dato:", e);
      return null;
    }
  }

  // Sjekk om formatet er dd.mm.yyyy (1-2 dag, 1-2 mnd, 4 år)
  const regexDMY = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;
  const match = val.match(regexDMY);
  if (match) {
    const day = match[1].padStart(2, "0");    // f.eks. "12" eller "01"
    const month = match[2].padStart(2, "0");  // f.eks. "03" eller "11"
    const year = match[3];                    // f.eks. "2024"
    // Returner ISO-format "yyyy-mm-dd"
    return `${year}-${month}-${day}`;
  }

  // Hvis ingen av tilfellene over, returner original verdi
  return val;
}

/**
 * Mapping fra Excel-kolonnenavn til "ryddige" feltnavn i databasen.
 * Sørg for at Excel-filen har identiske kolonnenavn (case-insensitive),
 * ellers må du justere her.
 */
const headerMapping = {
  "reporting period": "reporting_period",
  "agent company id": "agent_company_id",
  "agent company": "agent_company",
  "agent id": "agent_id",
  "agent name": "agent_name",
  "src customer id": "src_customer_id",
  "customer name": "customer_name",
  "src policy id": "src_policy_id",
  "src policy type id": "src_policy_type_id",
  "product name": "product_name",
  "src contract type id": "src_contract_type_id",
  "policy group life skade": "policy_group_life_skade",
  "provisjonsgruppe": "provisjonsgruppe",
  "contract group private commercial": "contract_group_private_commercial",
  "policy sale date": "policy_sale_date",
  "policy start date": "policy_start_date",
  "policy cancel date": "policy_cancel_date",
  "policy end date": "policy_end_date",
  "cancel code": "cancel_code",
  "cancel reason": "cancel_reason",
  "policy status": "policy_status",
  "policy status description": "policy_status_description",
  "premium sales": "premium_sales",
  "net premium sales": "net_premium_sales",
  "provision_rate": "provision_rate",
  "provisjonsgrunnlag": "provisjonsgrunnlag",
  "transaction_type": "transaction_type",
  "commission": "commission"
};

function SalesData() {
  const theme = useTheme();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState(null);
  const [importMessage, setImportMessage] = useState("");
  const [fileName, setFileName] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [agentFilter, setAgentFilter] = useState("");

  // For redigeringsdialog
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [editingSale, setEditingSale] = useState(null);

  useEffect(() => {
    fetchSalesData();
  }, []);

  const fetchSalesData = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("sales_data").select("*");
    if (error) {
      console.error("Feil ved henting av salgsdata:", error);
      setUploadError("Kunne ikke hente salgsdata");
    } else {
      setSales(data || []);
    }
    setLoading(false);
  };

  // Håndter filopplasting
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

  // Importfunksjon (leser Excel/CSV, mapper felter og kaller upsert)
  const handleImport = async () => {
    if (!file) {
      setUploadError("Vennligst velg en fil først.");
      return;
    }
    
    setLoading(true);
    setUploadSuccess(false);
    setUploadError(null);
    
    try {
      // Les filen
      const fileData = await file.arrayBuffer();
      const workbook = XLSX.read(fileData, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Forutsetter at første rad er header
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      if (jsonData.length < 2) {
        setUploadError("Filen er tom eller mangler header.");
        setLoading(false);
        return;
      }

      // Hent header-raden og data-radene
      const headers = jsonData[0].map((h) => h.trim().toLowerCase());
      const rows = jsonData.slice(1);

      // Bygg array med importerte salgsobjekter
      const importedSales = rows.map((row, rowIndex) => {
        const sale = {};
        headers.forEach((header, index) => {
          const normalizedHeader = headerMapping[header] || header;
          sale[normalizedHeader] = row[index];
        });

        // Kall fixDate på feltene som skal være date
        sale.policy_sale_date = fixDate(sale.policy_sale_date);
        sale.policy_start_date = fixDate(sale.policy_start_date);
        sale.policy_cancel_date = fixDate(sale.policy_cancel_date);
        sale.policy_end_date = fixDate(sale.policy_end_date);
        
        // Valider og håndter cancel_code for å oppfylle databasebegrensninger
        // Hvis verdien er null, undefined eller tom streng, sett den til null
        if (sale.cancel_code === null || sale.cancel_code === undefined || 
            (typeof sale.cancel_code === 'string' && sale.cancel_code.trim() === '')) {
          sale.cancel_code = null;
        } 
        // Hvis det er et tall, konverter til streng
        else if (typeof sale.cancel_code === 'number') {
          sale.cancel_code = sale.cancel_code.toString();
        }
        // Hvis det er en streng men inneholder bare tall, beholdes den som streng
        // Hvis den inneholder ikke-numeriske tegn, trunkeres den til 10 tegn
        else if (typeof sale.cancel_code === 'string' && sale.cancel_code.length > 10) {
          sale.cancel_code = sale.cancel_code.substring(0, 10);
        }

        return sale;
      });

      // Filter ut rader som ikke har gyldig src_policy_id (valgfritt)
      const validSales = importedSales.filter(sale => {
        return sale.src_policy_id !== null && 
               sale.src_policy_id !== undefined && 
               sale.src_policy_id.toString().trim() !== '';
      });

      // Upsert til Supabase (NB: src_policy_id må være UNIQUE i tabellen)
      const { data: upsertData, error } = await supabase
        .from("sales_data")
        .upsert(validSales, { onConflict: "src_policy_id" })
        .select();

      if (error) {
        console.error("Import feilet:", error);
        setUploadError("Import feilet: " + error.message);
      } else {
        setSales((prev) => {
          // Lag en ny liste med alle eksisterende data
          const newSales = [...prev];
          
          // For hver importert rad, finn og erstatt eksisterende, eller legg til
          upsertData.forEach(newSale => {
            const index = newSales.findIndex(s => s.src_policy_id === newSale.src_policy_id);
            if (index >= 0) {
              newSales[index] = newSale;
            } else {
              newSales.push(newSale);
            }
          });
          
          return newSales;
        });
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

  // Åpne redigeringsdialog
  const handleOpenEditDialog = (sale) => {
    setEditingSale({...sale});
    setOpenEditDialog(true);
  };

  const handleCloseEditDialog = () => {
    setEditingSale(null);
    setOpenEditDialog(false);
  };

  // Oppdater en rad
  const handleUpdateSale = async () => {
    if (!editingSale) return;

    setLoading(true);
    
    // Håndter cancel_code
    let processedCancelCode = editingSale.cancel_code;
    if (processedCancelCode === "" || processedCancelCode === undefined) {
      processedCancelCode = null;
    } else if (typeof processedCancelCode === 'string' && processedCancelCode.length > 10) {
      processedCancelCode = processedCancelCode.substring(0, 10);
    }

    // Kall fixDate her også, slik at brukeren kan skrive "12.3.2024" i dialogen
    const updatedSale = {
      ...editingSale,
      policy_sale_date: fixDate(editingSale.policy_sale_date),
      policy_start_date: fixDate(editingSale.policy_start_date),
      policy_cancel_date: fixDate(editingSale.policy_cancel_date),
      policy_end_date: fixDate(editingSale.policy_end_date),
      cancel_code: processedCancelCode
    };

    const { data, error } = await supabase
      .from("sales_data")
      .update(updatedSale)
      .eq("id", editingSale.id)
      .select();

    if (error) {
      console.error("Oppdatering feilet:", error);
      setUploadError("Oppdatering feilet: " + error.message);
    } else if (data) {
      setSales((prev) => prev.map((s) => (s.id === editingSale.id ? data[0] : s)));
      setUploadSuccess(true);
    }
    
    handleCloseEditDialog();
    setLoading(false);
  };

  // Slett en rad
  const handleDeleteSale = async (id) => {
    if (window.confirm("Er du sikker på at du vil slette denne salgsraden?")) {
      setLoading(true);
      
      const { error } = await supabase.from("sales_data").delete().eq("id", id);
      
      if (error) {
        console.error("Sletting feilet:", error);
        setUploadError("Sletting feilet: " + error.message);
      } else {
        setSales((prev) => prev.filter((s) => s.id !== id));
      }
      
      setLoading(false);
    }
  };

  // Filtrer salgsdata basert på søk og agent
  const agents = [...new Set(sales.map(s => s.agent_name).filter(Boolean))];
  
  const filteredSales = sales.filter((sale) => {
    const matchesSearch = 
      searchTerm === "" || 
      (sale.agent_name && sale.agent_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (sale.customer_name && sale.customer_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (sale.product_name && sale.product_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (sale.src_policy_id && sale.src_policy_id.toString().includes(searchTerm));
    
    const matchesAgent = agentFilter === "" || sale.agent_name === agentFilter;
    
    return matchesSearch && matchesAgent;
  });

  return (
    <Box sx={{ p: 3, backgroundColor: "#f5f5f5", minHeight: "100vh" }}>
      {/* Navigation Buttons */}
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
          <Button 
            component={Link} 
            to="/sales-dashboard" 
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
            Dashboard
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
            Salgsdata
          </Button>
        </Stack>
      </Box>

      <Grid container spacing={3}>
        {/* Import Section */}
        <Grid item xs={12}>
          <Paper elevation={2} sx={{ p: 3, borderRadius: 2, mb: 3 }}>
            <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ mb: 3, display: 'flex', alignItems: 'center' }}>
              <InsertDriveFile sx={{ mr: 1 }} color="primary" />
              Importer salgsdata fra fil
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
            
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={4}>
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
              </Grid>
              
              <Grid item xs={12} md={4}>
                <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                  {fileName ? (
                    <Chip
                      icon={<FilePresent />}
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
              </Grid>
              
              <Grid item xs={12} md={4}>
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
              </Grid>
            </Grid>
          </Paper>
        </Grid>
        
        {/* Sales Data List */}
        <Grid item xs={12}>
          <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center' }}>
                <Analytics sx={{ mr: 1 }} color="primary" />
                Salgsdata oversikt
              </Typography>
              
              <Box>
                <Tooltip title="Oppdater data">
                  <IconButton onClick={fetchSalesData} color="primary" size="small">
                    <Refresh />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
            
            {/* Filter controls */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={8}>
                <TextField
                  placeholder="Søk etter agent, kunde, produkt eller policy ID..."
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
                  <InputLabel>Filter etter agent</InputLabel>
                  <Select
                    value={agentFilter}
                    onChange={(e) => setAgentFilter(e.target.value)}
                    label="Filter etter agent"
                  >
                    <MenuItem value="">Alle agenter</MenuItem>
                    {agents.map((agent) => (
                      <MenuItem key={agent} value={agent}>
                        {agent}
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
              <TableContainer sx={{ maxHeight: '60vh' }}>
                <Table stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>ID</TableCell>
                      <TableCell>Periode</TableCell>
                      <TableCell>Agent</TableCell>
                      <TableCell>Kunde</TableCell>
                      <TableCell>Policy ID</TableCell>
                      <TableCell>Produkt</TableCell>
                      <TableCell>Salgsdato</TableCell>
                      <TableCell>Startdato</TableCell>
                      <TableCell>Premium</TableCell>
                      <TableCell>Provisjon</TableCell>
                      <TableCell>Handlinger</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredSales.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={11} align="center">
                          Ingen salgsdata funnet
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredSales.map((sale) => (
                        <TableRow key={sale.id} hover>
                          <TableCell>{sale.id}</TableCell>
                          <TableCell>{sale.reporting_period || ""}</TableCell>
                          <TableCell>
                            {sale.agent_name ? (
                              <Chip 
                                label={sale.agent_name} 
                                size="small" 
                                variant="outlined"
                                color="primary"
                              />
                            ) : "-"}
                          </TableCell>
                          <TableCell>{sale.customer_name || "-"}</TableCell>
                          <TableCell>{sale.src_policy_id || "-"}</TableCell>
                          <TableCell>{sale.product_name || "-"}</TableCell>
                          <TableCell>{sale.policy_sale_date || "-"}</TableCell>
                          <TableCell>{sale.policy_start_date || "-"}</TableCell>
                          <TableCell align="right">
                            {sale.net_premium_sales 
                              ? `${parseFloat(sale.net_premium_sales).toLocaleString('nb-NO')} kr` 
                              : "-"}
                          </TableCell>
                          <TableCell align="right">
                            {sale.commission 
                              ? `${parseFloat(sale.commission).toLocaleString('nb-NO')} kr` 
                              : "-"}
                          </TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={1}>
                              <IconButton size="small" color="primary" onClick={() => handleOpenEditDialog(sale)}>
                                <Edit fontSize="small" />
                              </IconButton>
                              <IconButton size="small" color="error" onClick={() => handleDeleteSale(sale.id)}>
                                <Delete fontSize="small" />
                              </IconButton>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Grid>
      </Grid>
      
      {/* Edit Dialog */}
      <Dialog open={openEditDialog} onClose={handleCloseEditDialog} fullWidth maxWidth="md">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
          <Edit sx={{ mr: 1 }} color="primary" fontSize="small" />
          Rediger salgsdata
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Reporting Period"
                fullWidth
                size="small"
                value={editingSale?.reporting_period || ""}
                onChange={(e) =>
                  setEditingSale({ ...editingSale, reporting_period: e.target.value })
                }
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Agent ID"
                fullWidth
                size="small"
                value={editingSale?.agent_id || ""}
                onChange={(e) =>
                  setEditingSale({ ...editingSale, agent_id: e.target.value })
                }
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Agent Name"
                fullWidth
                size="small"
                value={editingSale?.agent_name || ""}
                onChange={(e) =>
                  setEditingSale({ ...editingSale, agent_name: e.target.value })
                }
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Customer Name"
                fullWidth
                size="small"
                value={editingSale?.customer_name || ""}
                onChange={(e) =>
                  setEditingSale({ ...editingSale, customer_name: e.target.value })
                }
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Policy ID"
                fullWidth
                size="small"
                value={editingSale?.src_policy_id || ""}
                onChange={(e) =>
                  setEditingSale({ ...editingSale, src_policy_id: e.target.value })
                }
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Product Name"
                fullWidth
                size="small"
                value={editingSale?.product_name || ""}
                onChange={(e) =>
                  setEditingSale({ ...editingSale, product_name: e.target.value })
                }
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Policy Sale Date"
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
                value={editingSale?.policy_sale_date || ""}
                onChange={(e) =>
                  setEditingSale({ ...editingSale, policy_sale_date: e.target.value })
                }
                helperText="Format: YYYY-MM-DD eller DD.MM.YYYY"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Policy Start Date"
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
                value={editingSale?.policy_start_date || ""}
                onChange={(e) =>
                  setEditingSale({ ...editingSale, policy_start_date: e.target.value })
                }
                helperText="Format: YYYY-MM-DD eller DD.MM.YYYY"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Policy Cancel Date"
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
                value={editingSale?.policy_cancel_date || ""}
                onChange={(e) =>
                  setEditingSale({ ...editingSale, policy_cancel_date: e.target.value })
                }
                helperText="Format: YYYY-MM-DD eller DD.MM.YYYY"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Policy End Date"
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
                value={editingSale?.policy_end_date || ""}
                onChange={(e) =>
                  setEditingSale({ ...editingSale, policy_end_date: e.target.value })
                }
                helperText="Format: YYYY-MM-DD eller DD.MM.YYYY"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Cancel Code"
                fullWidth
                size="small"
                value={editingSale?.cancel_code || ""}
                onChange={(e) =>
                  setEditingSale({ ...editingSale, cancel_code: e.target.value })
                }
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Net Premium Sales"
                fullWidth
                size="small"
                type="number"
                InputProps={{
                  endAdornment: <InputAdornment position="end">kr</InputAdornment>,
                }}
                value={editingSale?.net_premium_sales || ""}
                onChange={(e) =>
                  setEditingSale({ ...editingSale, net_premium_sales: e.target.value })
                }
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Commission"
                fullWidth
                size="small"
                type="number"
                InputProps={{
                  endAdornment: <InputAdornment position="end">kr</InputAdornment>,
                }}
                value={editingSale?.commission || ""}
                onChange={(e) =>
                  setEditingSale({ ...editingSale, commission: e.target.value })
                }
              />
            </Grid>
          </Grid>
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
            onClick={handleUpdateSale} 
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

export default SalesData;
