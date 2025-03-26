import { createClient } from '@supabase/supabase-js';

// For Vite, environment variables need to be prefixed with VITE_
// Access them using import.meta.env instead of process.env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://dggxkmxohsnoxetjcyod.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnZ3hrbXhvaHNub3hldGpjeW9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI0Nzc4NDEsImV4cCI6MjA1ODA1Mzg0MX0.798ljOnRxPpZVLXBG2lXDe1XVJVn_S53_TEMv4z_eDE';

// More detailed logging
console.log(`Initializing Supabase with URL: ${supabaseUrl}`);
console.log(`Using anonymous key: ${supabaseAnonKey.substring(0, 5)}...`);

// Create a Supabase client with better error handling
let supabase;
try {
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true
    }
  });
  console.log('Supabase client initialized successfully');
  
  // Test connection
  window.setTimeout(async () => {
    try {
      const { data, error } = await supabase.from('salary_models').select('id').limit(1);
      if (error) {
        console.error('Connection test error:', error);
      } else {
        console.log('Connection test successful:', data);
      }
    } catch (err) {
      console.error('Connection test failed:', err);
    }
  }, 1000);
  
} catch (error) {
  console.error('Failed to initialize Supabase client:', error);
  // Create a mock client to prevent application crashes
  supabase = {
    from: () => ({
      select: () => Promise.resolve({ data: [], error: new Error('Supabase client not initialized') }),
      insert: () => Promise.resolve({ data: null, error: new Error('Supabase client not initialized') }),
      update: () => Promise.resolve({ data: null, error: new Error('Supabase client not initialized') }),
      delete: () => Promise.resolve({ data: null, error: new Error('Supabase client not initialized') }),
    }),
    auth: {
      signInWithPassword: () => Promise.resolve({ user: null, error: new Error('Supabase client not initialized') }),
      signOut: () => Promise.resolve({ error: null }),
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    },
  };
}

export { supabase };
