import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import {
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  Paper,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Box,
  Stack,
  IconButton,
  Tooltip,
  Alert,
  AlertTitle,
  Chip,
  CircularProgress,
  InputAdornment
} from "@mui/material";
import {
  Add,
  Delete,
  Edit,
  Refresh,
  Save,
  Cancel,
  Payments,
  AccountBalance,
  TrendingUp,
  Search
} from "@mui/icons-material";
import { Link } from "react-router-dom";
import { useTheme } from "@mui/material/styles";

function SalaryModels() {
  const theme = useTheme();
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [currentModel, setCurrentModel] = useState({
    id: null,
    name: "",
    commission_liv: "",
    commission_skade: "",
    base_salary: "",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  // Hent eksisterende lønnstrinn fra Supabase
  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("salary_models").select("*");
    if (error) {
      console.error("Feil ved henting av lønnstrinn:", error);
      setUploadError("Kunne ikke hente lønnstrinn data");
    } else {
      setModels(data || []);
    }
    setLoading(false);
  };

  // Åpne dialog for å legge til/redigere
  const handleOpenDialog = (
    model = { id: null, name: "", commission_liv: "", commission_skade: "", base_salary: "" }
  ) => {
    setCurrentModel(model);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setCurrentModel({ id: null, name: "", commission_liv: "", commission_skade: "", base_salary: "" });
    setOpenDialog(false);
  };

  // Lagre (legg til eller oppdater) et lønnstrinn
  const handleSave = async () => {
    setLoading(true);
    setUploadSuccess(false);
    setUploadError(null);
    
    // Validering
    if (!currentModel.name) {
      setUploadError("Lønnstrinnet må ha et navn");
      setLoading(false);
      return;
    }
    
    try {
      if (currentModel.id) {
        // Oppdatering
        const { data, error } = await supabase
          .from("salary_models")
          .update({
            name: currentModel.name,
            commission_liv: parseFloat(currentModel.commission_liv) || 0,
            commission_skade: parseFloat(currentModel.commission_skade) || 0,
            base_salary: parseFloat(currentModel.base_salary) || 0,
          })
          .eq("id", currentModel.id)
          .select();

        if (error) {
          console.error("Oppdatering feilet:", error);
          setUploadError("Oppdatering feilet: " + error.message);
        } else {
          setModels(models.map((m) => (m.id === currentModel.id ? data[0] : m)));
          setUploadSuccess(true);
          handleCloseDialog();
        }
      } else {
        // Opprett nytt lønnstrinn
        const { data, error } = await supabase
          .from("salary_models")
          .insert([
            {
              name: currentModel.name,
              commission_liv: parseFloat(currentModel.commission_liv) || 0,
              commission_skade: parseFloat(currentModel.commission_skade) || 0,
              base_salary: parseFloat(currentModel.base_salary) || 0,
            },
          ])
          .select();

        if (error) {
          console.error("Innsetting feilet:", error);
          setUploadError("Innsetting feilet: " + error.message);
        } else {
          setModels([...models, ...data]);
          setUploadSuccess(true);
          handleCloseDialog();
        }
      }
    } catch (err) {
      console.error("Feil under håndtering:", err);
      setUploadError("Feil: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Slett et lønnstrinn
  const handleDelete = async (id) => {
    if (window.confirm("Er du sikker på at du vil slette dette lønnstrinnet?")) {
      setLoading(true);
      
      const { error } = await supabase.from("salary_models").delete().eq("id", id);
      
      if (error) {
        console.error("Sletting feilet:", error);
        setUploadError("Sletting feilet: " + error.message);
      } else {
        setModels(models.filter((m) => m.id !== id));
      }
      
      setLoading(false);
    }
  };
  
  // Filtrer lønnstrinn basert på søk
  const filteredModels = models.filter((model) => {
    return (
      searchTerm === "" || 
      (model.name && model.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );
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
            to="/sales-data" 
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
            Salgsdata
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
        </Stack>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center' }}>
                <AccountBalance sx={{ mr: 1 }} color="primary" />
                Lønnstrinn
              </Typography>
              
              <Stack direction="row" spacing={1}>
                <Tooltip title="Oppdater data">
                  <IconButton onClick={fetchModels} color="primary" size="small">
                    <Refresh />
                  </IconButton>
                </Tooltip>
                <Button 
                  variant="contained" 
                  size="small" 
                  startIcon={<Add />}
                  onClick={() => handleOpenDialog()}
                >
                  Legg til nytt lønnstrinn
                </Button>
              </Stack>
            </Box>
            
            {uploadSuccess && (
              <Alert severity="success" sx={{ mb: 3 }}>
                <AlertTitle>Suksess</AlertTitle>
                Endringene ble lagret
              </Alert>
            )}
            
            {uploadError && (
              <Alert severity="error" sx={{ mb: 3 }}>
                <AlertTitle>Feil</AlertTitle>
                {uploadError}
              </Alert>
            )}
            
            {/* Search control */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12}>
                <TextField
                  placeholder="Søk etter lønnstrinn..."
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
                      <TableCell>Navn</TableCell>
                      <TableCell align="right">Provisjon Liv (%)</TableCell>
                      <TableCell align="right">Provisjon Skade (%)</TableCell>
                      <TableCell align="right">Fastlønn (kr)</TableCell>
                      <TableCell align="right">Handlinger</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredModels.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          Ingen lønnstrinn funnet
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredModels.map((model) => (
                        <TableRow key={model.id} hover>
                          <TableCell>
                            <Chip 
                              label={model.name} 
                              size="small" 
                              icon={<Payments />}
                              variant="outlined"
                              color="success"
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Chip 
                              label={`${model.commission_liv} %`} 
                              size="small" 
                              variant="outlined"
                              color="primary"
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Chip 
                              label={`${model.commission_skade} %`} 
                              size="small" 
                              variant="outlined"
                              color="info"
                            />
                          </TableCell>
                          <TableCell align="right">
                            {parseFloat(model.base_salary).toLocaleString('nb-NO')} kr
                          </TableCell>
                          <TableCell align="right">
                            <Stack direction="row" spacing={1} justifyContent="flex-end">
                              <IconButton size="small" color="primary" onClick={() => handleOpenDialog(model)}>
                                <Edit fontSize="small" />
                              </IconButton>
                              <IconButton size="small" color="error" onClick={() => handleDelete(model.id)}>
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
      
      {/* Add/Edit Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
          {currentModel.id ? (
            <>
              <Edit sx={{ mr: 1 }} color="primary" fontSize="small" />
              Rediger lønnstrinn
            </>
          ) : (
            <>
              <Add sx={{ mr: 1 }} color="primary" fontSize="small" />
              Legg til nytt lønnstrinn
            </>
          )}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                label="Navn på lønnstrinn"
                fullWidth
                value={currentModel.name}
                onChange={(e) => setCurrentModel({ ...currentModel, name: e.target.value })}
                size="small"
                required
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Provisjon Liv"
                type="number"
                fullWidth
                value={currentModel.commission_liv}
                onChange={(e) => setCurrentModel({ ...currentModel, commission_liv: e.target.value })}
                size="small"
                InputProps={{
                  endAdornment: <InputAdornment position="end">%</InputAdornment>,
                }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Provisjon Skade"
                type="number"
                fullWidth
                value={currentModel.commission_skade}
                onChange={(e) => setCurrentModel({ ...currentModel, commission_skade: e.target.value })}
                size="small"
                InputProps={{
                  endAdornment: <InputAdornment position="end">%</InputAdornment>,
                }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Fastlønn"
                type="number"
                fullWidth
                value={currentModel.base_salary}
                onChange={(e) => setCurrentModel({ ...currentModel, base_salary: e.target.value })}
                size="small"
                InputProps={{
                  endAdornment: <InputAdornment position="end">kr</InputAdornment>,
                }}
              />
            </Grid>
          </Grid>
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
            onClick={handleSave} 
            variant="contained" 
            startIcon={<Save />}
            size="small"
            disabled={loading}
          >
            {loading ? "Lagrer..." : "Lagre"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default SalaryModels;
