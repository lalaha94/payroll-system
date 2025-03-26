import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

function AdminActions() {
  const [currentUser, setCurrentUser] = useState(null);
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    // Fetch current user data
    const fetchCurrentUser = async () => {
      const { data: user, error } = await supabase.auth.getUser();
      if (error) {
        console.error('Error fetching user:', error);
      } else {
        setCurrentUser(user);
      }
    };

    fetchCurrentUser();
  }, []);

  const makeAdmin = async () => {
    if (!currentUser?.dbUser?.email && !userEmail) {
      setError('No valid user selected');
      return;
    }
    
    const email = currentUser?.dbUser?.email || userEmail;
    const auth_id = currentUser?.authUser?.id;
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Update database record only
      const { error: dbError } = await supabase
        .from('users')
        .upsert([
          {
            email,
            role: 'admin',
            name: currentUser?.dbUser?.name || email.split('@')[0],
            is_active: true,
            auth_id: auth_id // Store auth_id if available
          }
        ]);
      
      if (dbError) throw dbError;
      
      setSuccess(`User ${email} has been marked as admin in the database. 
                  Please update their role in Supabase Auth console to complete the process.`);
      fetchUsers(); // Refresh the admin list
      
    } catch (error) {
      console.error('Error updating user:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    // Fetch users logic
  };

  return (
    <div>
      <h1>Admin Actions</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {success && <p style={{ color: 'green' }}>{success}</p>}
      <button onClick={makeAdmin} disabled={loading}>
        {loading ? 'Loading...' : 'Make Admin'}
      </button>
    </div>
  );
}

export default AdminActions;
