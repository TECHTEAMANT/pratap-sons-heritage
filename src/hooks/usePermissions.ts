import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface RolePermissions {
  can_view_cost: boolean;
  can_view_mrp: boolean;
  can_manage_purchases: boolean;
  can_manage_sales: boolean;
  can_view_reports: boolean;
  can_manage_inventory: boolean;
  can_manage_masters: boolean;
  can_manage_users: boolean;
}

const defaultPermissions: RolePermissions = {
  can_view_cost: false,
  can_view_mrp: false,
  can_manage_purchases: false,
  can_manage_sales: false,
  can_view_reports: false,
  can_manage_inventory: false,
  can_manage_masters: false,
  can_manage_users: false,
};

export function usePermissions() {
  const { user, session } = useAuth();
  const [permissions, setPermissions] = useState<RolePermissions>(defaultPermissions);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPermissions();
  }, [user, session]);

  const loadPermissions = async () => {
    if (!user || !session) {
      setPermissions(defaultPermissions);
      setLoading(false);
      return;
    }

    try {
      const { data: userData } = await supabase
        .from('users')
        .select('role_id, roles(*)')
        .eq('auth_user_id', session.user.id)
        .maybeSingle();

      if (userData?.roles) {
        setPermissions({
          can_view_cost: userData.roles.can_view_cost,
          can_view_mrp: userData.roles.can_view_mrp,
          can_manage_purchases: userData.roles.can_manage_purchases,
          can_manage_sales: userData.roles.can_manage_sales,
          can_view_reports: userData.roles.can_view_reports,
          can_manage_inventory: userData.roles.can_manage_inventory,
          can_manage_masters: userData.roles.can_manage_masters,
          can_manage_users: userData.roles.can_manage_users,
        });
      } else {
        setPermissions(defaultPermissions);
      }
    } catch (error) {
      console.error('Error loading permissions:', error);
      setPermissions(defaultPermissions);
    } finally {
      setLoading(false);
    }
  };

  return { permissions, loading };
}
