import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export const useAdminDashboard = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('admin_notifications')
        .select('*')
        .order('timestamp', { ascending: false });

      if (error) {
        throw new Error(`Error fetching notifications: ${error.message}`);
      }

      setNotifications(data || []);
    } catch (error) {
      console.error("Error fetching admin notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  return { notifications, loading, fetchNotifications };
};
