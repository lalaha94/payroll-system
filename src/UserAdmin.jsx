import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  Chip,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Alert,
  CircularProgress,
  InputAdornment,
} from '@mui/material';
import {
  Add,
  Delete,
  Edit,
  Refresh,
  Search,
  AdminPanelSettings,
  SupervisorAccount,
  Person,
  PersonAdd,
  CheckCircle,
  Block,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import NavigationMenu from './components/NavigationMenu';

function UserAdmin() {
  const theme = useTheme();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Get current user
  const [currentAdmin, setCurrentAdmin] = useState(null);
  
  useEffect(() => {
    const fetchCurrentUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        setCurrentAdmin(data.user);
      }
    };
    
    fetchCurrentUser();
    fetchUsers();
  }, []);
  
  const fetchUsers = async () => {
    setLoading(true);
    
    try {
      // Get users from our custom users table
      const { data, error } = await supabase.from('users').select('*');
      
      if (error) throw error;
      
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      setError('Kunne ikke hente brukere: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleOpenDialog = (user = null) => {
    setCurrentUser(user || { 
      name: '',
      email: '',
      role: 'user',
      is_active: true,
    });
    setOpenDialog(true);
  };
  
  const handleCloseDialog = () => {
    setOpenDialog(false);
    setCurrentUser(null);
  };
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCurrentUser({
      ...currentUser,
      [name]: value,
    });
  };
  
  const handleToggleActive = async (userId, currentStatus) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_active: !currentStatus })
        .eq('id', userId);
        
      if (error) throw error;
      
      // Update local state
      setUsers(users.map(user => 
        user.id === userId ? { ...user, is_active: !currentStatus } : user
      ));
      
      setSuccess(`Bruker ${currentStatus ? 'deaktivert' : 'aktivert'}`);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('Error toggling user status:', error);
      setError('Kunne ikke endre brukerstatus: ' + error.message);
    }
  };
  
  const handleSaveUser = async () => {
    setError(null);
    
    try {
      if (currentUser.id) {
        // Update existing user
        const { error } = await supabase
          .from('users')
          .update({
            name: currentUser.name,
            role: currentUser.role,
            is_active: currentUser.is_active,
          })
          .eq('id', currentUser.id);
          
        if (error) throw error;
        
        // Update local state
        setUsers(users.map(user => 
          user.id === currentUser.id ? { ...user, ...currentUser } : user
        ));
        
        setSuccess('Bruker oppdatert');
      } else {
        // Create new user
        if (!currentUser.email || !currentUser.name) {
          setError('Navn og e-post er påkrevd');
          return;
        }
        
        // We can't create users through the client API directly without a password
        // The regular signup flow should be used instead, but here's how to create
        // an entry in your users table for tracking:
        const { data, error } = await supabase
          .from('users')
          .insert([{
            name: currentUser.name,
            email: currentUser.email,
            role: currentUser.role,
            is_active: currentUser.is_active,
          }])
          .select();
          
        if (error) throw error;
        
        setUsers([...users, data[0]]);
        setSuccess('Bruker opprettet. Brukeren må registrere seg med samme e-post.');
      }
      
      // Close dialog
      handleCloseDialog();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('Error saving user:', error);
      setError('Kunne ikke lagre bruker: ' + error.message);
    }
  };
  
  const handleDeleteUser = async (userId) => {
    if (!confirm('Er du sikker på at du vil slette denne brukeren?')) return;
    
    try {
      // Delete user from custom users table
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);
        
      if (error) throw error;
      
      // Update local state
      setUsers(users.filter(user => user.id !== userId));
      
      setSuccess('Bruker slettet');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('Error deleting user:', error);
      setError('Kunne ikke slette bruker: ' + error.message);
    }
  };
  
  const filteredUsers = users.filter(user => {
    return (
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.role?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });
  
  const getRoleColor = (role) => {
    switch (role) {
      case 'admin':
        return 'error';
      case 'manager':
        return 'primary';
      case 'user':
        return 'success';
      default:
        return 'default';
    }
  };
  
  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin':
        return <AdminPanelSettings fontSize="small" />;
      case 'manager':
        return <SupervisorAccount fontSize="small" />;
      default:
        return <Person fontSize="small" />;
    }
  };

  return (
    <Box sx={{ p: 3, backgroundColor: "#f5f5f5", minHeight: "100vh" }}>
      {/* Navigation Menu */}
      <NavigationMenu />
      
      <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center' }}>
            <AdminPanelSettings sx={{ mr: 1 }} color="primary" />
            Brukeradministrasjon
          </Typography>
          
          <Box>
            <Button 
              variant="contained" 
              startIcon={<PersonAdd />} 
              sx={{ mr: 1 }}
              onClick={() => handleOpenDialog()}
            >
              Ny bruker
            </Button>
            <IconButton color="primary" onClick={fetchUsers}>
              <Refresh />
            </IconButton>
          </Box>
        </Box>
        
        {/* Alerts */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        
        {success && (
          <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}
        
        {/* Search */}
        <TextField
          placeholder="Søk etter brukere..."
          fullWidth
          size="small"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ mb: 3 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search color="action" />
              </InputAdornment>
            ),
          }}
        />
        
        {/* Users Table */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Navn</TableCell>
                  <TableCell>E-post</TableCell>
                  <TableCell>Rolle</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Handlinger</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      Ingen brukere funnet
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id} hover>
                      <TableCell>{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Chip 
                          icon={getRoleIcon(user.role)}
                          label={user.role || 'user'} 
                          color={getRoleColor(user.role)}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip 
                          icon={user.is_active ? <CheckCircle fontSize="small" /> : <Block fontSize="small" />}
                          label={user.is_active ? 'Aktiv' : 'Inaktiv'} 
                          color={user.is_active ? 'success' : 'default'}
                          size="small"
                          variant="outlined"
                          onClick={() => handleToggleActive(user.id, user.is_active)}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton 
                          color="primary" 
                          size="small" 
                          onClick={() => handleOpenDialog(user)}
                          sx={{ mr: 1 }}
                        >
                          <Edit fontSize="small" />
                        </IconButton>
                        <IconButton 
                          color="error" 
                          size="small"
                          onClick={() => handleDeleteUser(user.id)}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
      
      {/* Edit/Add User Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} fullWidth maxWidth="sm">
        <DialogTitle>
          {currentUser?.id ? 'Rediger bruker' : 'Legg til ny bruker'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                label="Navn"
                name="name"
                value={currentUser?.name || ''}
                onChange={handleInputChange}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="E-post"
                name="email"
                value={currentUser?.email || ''}
                onChange={handleInputChange}
                fullWidth
                required
                disabled={!!currentUser?.id} // Can't change email for existing users
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Rolle</InputLabel>
                <Select
                  name="role"
                  value={currentUser?.role || 'user'}
                  onChange={handleInputChange}
                  label="Rolle"
                >
                  <MenuItem value="user">Bruker</MenuItem>
                  <MenuItem value="manager">Manager</MenuItem>
                  <MenuItem value="admin">Administrator</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  name="is_active"
                  value={currentUser?.is_active}
                  onChange={handleInputChange}
                  label="Status"
                >
                  <MenuItem value={true}>Aktiv</MenuItem>
                  <MenuItem value={false}>Inaktiv</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Avbryt</Button>
          <Button onClick={handleSaveUser} variant="contained">
            Lagre
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default UserAdmin;
