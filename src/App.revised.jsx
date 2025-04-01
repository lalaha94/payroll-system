import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { supabase } from './services/supabase';
import AppRoutes from './routes/routes';
import ErrorBoundary from './components/common/ErrorBoundary';
import './index.css';

// App component med bedre feilhåndtering
const App = () => {
  console.log("Rendering App component");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Sjekk om Supabase er riktig konfigurert
    const checkSupabase = async () => {
      try {
        const { data, error } = await supabase.from('salary_models').select('id').limit(1);
        
        if (error) {
          throw new Error(`Supabase query failed: ${error.message}`);
        }
        
        console.log('Supabase connection is working');
        setIsLoading(false);
      } catch (err) {
        console.error("Supabase connection error:", err);
        setError(err.message);
        setIsLoading(false);
      }
    };
    
    checkSupabase();
  }, []);

  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div className="loader"></div>
        <p>Initialiserer app...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        padding: '20px',
        textAlign: 'center'
      }}>
        <h2>Det oppstod en feil</h2>
        <p>{error}</p>
        <p>Sjekk at Supabase er riktig konfigurert.</p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Router>
        <AppRoutes />
      </Router>
    </ErrorBoundary>
  );
};

export default App;
