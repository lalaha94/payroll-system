// Debug script for troubleshooting
console.log('Debug script loaded');

// Add global error handler
window.addEventListener('error', function(event) {
  console.error('Global error caught:', event.error);
});

// Add Supabase request monitoring
if (typeof supabase !== 'undefined') {
  const originalFrom = supabase.from;
  
  supabase.from = function(table) {
    const result = originalFrom.call(supabase, table);
    
    // Wrap the select method to add logging
    const originalSelect = result.select;
    result.select = function(...args) {
      const selectResult = originalSelect.apply(this, args);
      
      // Wrap the original then method
      const originalThen = selectResult.then;
      selectResult.then = function(onFulfilled, onRejected) {
        console.log(`Supabase query to '${table}' table:`, {
          table,
          method: 'select',
          args
        });
        
        return originalThen.call(this, (result) => {
          console.log(`Supabase result from '${table}':`, result);
          return onFulfilled ? onFulfilled(result) : result;
        }, (error) => {
          console.error(`Supabase error from '${table}':`, error);
          return onRejected ? onRejected(error) : Promise.reject(error);
        });
      };
      
      return selectResult;
    };
    
    return result;
  };
}

// Add debug info for Supabase session
async function debugSupabaseSession() {
  try {
    // Check if we have supabase in the global scope
    if (typeof supabase !== 'undefined') {
      console.log('Checking Supabase session...');
      const session = await supabase.auth.getSession();
      console.log('Current session:', session);
      
      if (session?.data?.session?.user) {
        const user = session.data.session.user;
        console.log('User metadata:', user.user_metadata);
        
        // Check multiple fields that could indicate role
        let metadataRole = null;

        if (user.user_metadata?.is_super_admin === true || user.user_metadata?.is_admin === true) {
          metadataRole = 'admin';
        } else if (user.user_metadata?.role) {
          metadataRole = user.user_metadata.role;
        }

        console.log('Role fields in metadata:', {
          explicitRole: user.user_metadata?.role,
          isAdmin: user.user_metadata?.is_admin === true,
          isSuperAdmin: user.user_metadata?.is_super_admin === true,
          derivedRole: metadataRole || 'user'
        });
        
        console.log('User email:', user.email);
        
        // Check if user exists in our tables
        try {
          const { data: userData } = await supabase.from('users').select('*').eq('email', user.email).single();
          console.log('User in users table:', userData);
          
          const { data: employeeData } = await supabase.from('employees').select('*').eq('email', user.email).single();
          console.log('User in employees table:', employeeData);
          
          if (!userData && !employeeData) {
            console.warn('WARNING: User not found in either users or employees tables');
          }
        } catch (err) {
          console.error('Error checking user in database:', err);
        }
      } else {
        console.log('No active session or user found');
      }
    }
  } catch (err) {
    console.error('Error in debug script:', err);
  }
}

// Add debug info for Supabase schema
async function debugSupabaseSchema() {
  try {
    if (typeof supabase !== 'undefined') {
      console.log('Checking Supabase schema...');
      
      // Test employees table
      const { data: employeeTest, error: employeeError } = await supabase
        .from('employees')
        .select('*')
        .limit(1);
        
      console.log('Employees table test:', employeeTest, 'Error:', employeeError);
      
      // Test salary_models table
      const { data: salaryTest, error: salaryError } = await supabase
        .from('salary_models')
        .select('*')
        .limit(1);
        
      console.log('Salary models table test:', salaryTest, 'Error:', salaryError);
      
      // Try joinining directly - this might fail
      try {
        const { data: joinTest, error: joinError } = await supabase
          .from('employees')
          .select('*, salary_models(*)')
          .limit(1);
          
        console.log('Join test:', joinTest, 'Join error:', joinError);
      } catch (joinErr) {
        console.error('Join test failed:', joinErr);
      }
    }
  } catch (err) {
    console.error('Error checking schema:', err);
  }
}

// Run after a short delay to ensure everything is loaded
setTimeout(() => {
  console.log('React available:', typeof React !== 'undefined');
  console.log('ReactDOM available:', typeof ReactDOM !== 'undefined');
  console.log('Supabase client check:', typeof supabase !== 'undefined' ? 'Available' : 'Not available');
  
  if (typeof supabase !== 'undefined') {
    debugSupabaseSession();
    debugSupabaseSchema(); // Add this line to check schema
  }
}, 1000);
