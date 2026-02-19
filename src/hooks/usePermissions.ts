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
  const [roleName, setRoleName] = useState<string | null>(null);

  useEffect(() => {
    loadPermissions();
  }, [user, session]);

  useEffect(() => {
    const handler = () => {
      loadPermissions();
    };
    window.addEventListener('roles-changed', handler);
    return () => window.removeEventListener('roles-changed', handler);
  }, [user, session]);

  const loadPermissions = async () => {
    if (!user || !session) {
      setPermissions(defaultPermissions);
      setRoleName(null);
      setLoading(false);
      return;
    }

    try {
      const { data: userData } = await supabase
        .from('users')
        .select('role_id, roles(*)')
        .eq('auth_user_id', session.user.id)
        .maybeSingle();

      const role: any =
        userData && userData.roles
          ? Array.isArray(userData.roles)
            ? userData.roles[0]
            : userData.roles
          : null;

      if (role) {
        setRoleName(role.name ?? null);
        setPermissions({
          can_view_cost: role.can_view_cost,
          can_view_mrp: role.can_view_mrp,
          can_manage_purchases: role.can_manage_purchases,
          can_manage_sales: role.can_manage_sales,
          can_view_reports: role.can_view_reports,
          can_manage_inventory: role.can_manage_inventory,
          can_manage_masters: role.can_manage_masters,
          can_manage_users: role.can_manage_users,
        });
      } else if (user?.role === 'Admin') {
        setRoleName('Admin');
        setPermissions({
          can_view_cost: true,
          can_view_mrp: true,
          can_manage_purchases: true,
          can_manage_sales: true,
          can_view_reports: true,
          can_manage_inventory: true,
          can_manage_masters: true,
          can_manage_users: true,
        });
      } else {
        setRoleName(null);
        setPermissions(defaultPermissions);
      }
    } catch (error) {
      console.error('Error loading permissions:', error);
      setRoleName(null);
      setPermissions(defaultPermissions);
    } finally {
      setLoading(false);
    }
  };

  return { permissions, loading, roleName };
}
