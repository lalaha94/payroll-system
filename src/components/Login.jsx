import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Divider,
  TextField,
  Typography,
  Alert,
  IconButton,
  InputAdornment,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Lock,
  Email,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';

function Login() {
  const theme = useTheme();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  // Check if already logged in
  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session) {
        redirectBasedOnRole(data.session.user);
      }
    };
    
    checkSession();
  }, [navigate]);
  
  // Helper function to redirect based on user role
  const redirectBasedOnRole = async (user) => {
    try {
      console.log("Login - Full user data:", user);
      
      // Først sjekker vi for admin-rolle (høyest prioritet)
      if (user?.user_metadata?.is_super_admin === true || 
          user?.user_metadata?.is_admin === true || 
          user?.user_metadata?.role === 'admin') {
        console.log("Login - Admin role found in metadata");
        navigate('/sales-dashboard');
        return;
      }
      
      // Så sjekker vi om brukeren er manager
      if (user?.user_metadata?.role === 'manager') {
        console.log("Login - Manager role found in metadata");
        navigate('/office-dashboard');
        return;
      }
      
      // Så sjekker vi users-tabellen hvis metadata ikke ga noe resultat
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('email', user.email)
        .single();
        
      if (!userError && userData?.role) {
        if (userData.role === 'admin') {
          console.log("Login - Admin role found in users table");
          navigate('/sales-dashboard');
          return;
        } else if (userData.role === 'manager') {
          console.log("Login - Manager role found in users table");
          navigate('/office-dashboard');
          return;
        }
      }
      
      // Til slutt sjekker vi employees-tabellen
      const { data: empData, error: empError } = await supabase
        .from('employees')
        .select('role')
        .eq('email', user.email)
        .single();
        
      if (!empError && empData?.role) {
        if (empData.role === 'admin') {
          console.log("Login - Admin role found in employees table");
          navigate('/sales-dashboard');
          return;
        } else if (empData.role === 'manager') {
          console.log("Login - Manager role found in employees table");
          navigate('/office-dashboard');
          return;
        }
      }
      
      // Default: vanlig bruker sendes til agent-dashbordet
      console.log("Login - User role determined as agent, redirecting to agent dashboard");
      navigate('/agent-dashboard');
    } catch (error) {
      console.error("Error in redirectBasedOnRole:", error);
      // Failsafe: Send til agent-dashboard ved feil
      navigate('/agent-dashboard');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      
      console.log("Login - Auth successful, user data:", data?.user);
      
      // Kjør redirectBasedOnRole med brukerdata
      redirectBasedOnRole(data.user);
    } catch (error) {
      console.error('Error logging in:', error);
      setError(error.message || 'En feil oppstod ved innlogging. Vennligst prøv igjen.');
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f5f5f5',
        padding: 2,
      }}
    >
      <Container maxWidth="sm">
        <Card elevation={4} sx={{ borderRadius: 2 }}>
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <Typography variant="h4" component="h1" fontWeight="bold" color="primary" gutterBottom>
                Lønnssystem
              </Typography>
              <Typography variant="subtitle1" color="text.secondary">
                Logg inn for å få tilgang til lønnssystemet
              </Typography>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            <Box component="form" onSubmit={handleLogin} noValidate>
              <TextField
                margin="normal"
                required
                fullWidth
                id="email"
                label="E-post"
                name="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Email color="action" />
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                margin="normal"
                required
                fullWidth
                name="password"
                label="Passord"
                type={showPassword ? 'text' : 'password'}
                id="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={handleTogglePasswordVisibility}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                sx={{ mt: 3, mb: 2, py: 1.5, borderRadius: 2 }}
                disabled={loading}
              >
                {loading ? <CircularProgress size={24} /> : 'Logg inn'}
              </Button>
            </Box>
              
            <Divider sx={{ my: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Trenger du hjelp?
              </Typography>
            </Divider>
            
            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Har du problemer med å logge inn?
              </Typography>
              <Button
                variant="text"
                size="small"
                sx={{ textTransform: 'none' }}
                onClick={() => alert('Kontakt systemadministrator for hjelp med innlogging')}
              >
                Kontakt support
              </Button>
            </Box>
          </CardContent>
        </Card>
        
        <Box sx={{ textAlign: 'center', mt: 3 }}>
          <Typography variant="body2" color="text.secondary">
            © {new Date().getFullYear()} Lønnssystem - Alle rettigheter reservert
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}

export default Login;
