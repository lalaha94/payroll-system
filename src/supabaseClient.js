import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Mangler Supabase-konfigurasjon. Sjekk .env-filen din.');
  console.error('Du trenger følgende i .env-filen:');
  console.error('VITE_SUPABASE_URL=din-supabase-url');
  console.error('VITE_SUPABASE_ANON_KEY=din-anon-key');
}

// More detailed logging
console.log(`Initializing Supabase with URL: ${supabaseUrl}`);
console.log(`Using anonymous key: ${supabaseAnonKey?.substring(0, 5)}...`);

// Opprett Supabase-klient
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  global: {
    headers: {
      'Accept': 'application/json',
      'apikey': supabaseAnonKey
    }
  }
});

// Test tilkobling
const testConnection = async () => {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Feil ved henting av sesjon:', sessionError.message);
      return;
    }

    if (session) {
      console.log('Pålogget som:', session.user.email);
      
      // Test tilgang til employees-tabellen
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('email', session.user.email);
      
      if (error) {
        console.error('Feil ved henting av ansattdata:', error.message);
      } else if (data && data.length > 0) {
        console.log('Vellykket tilgang til ansattdata:', data[0]);
      } else {
        console.log('Ingen ansattdata funnet for denne brukeren');
      }
    } else {
      console.log('Ingen aktiv sesjon funnet');
    }
  } catch (err) {
    console.error('Tilkoblingsfeil:', err.message);
  }
};

// Kjør tilkoblingstest
testConnection();

export { supabase };
