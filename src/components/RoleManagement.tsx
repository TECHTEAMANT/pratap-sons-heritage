import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Shield, Plus, Edit2, Save, X, Loader, Trash2 } from 'lucide-react';

interface Role {
  id: string;
  name: string;
  description: string;
  can_view_cost: boolean;
  can_view_mrp: boolean;
  can_manage_purchases: boolean;
  can_manage_sales: boolean;
  can_view_reports: boolean;
  can_manage_inventory: boolean;
  can_manage_masters: boolean;
  can_manage_users: boolean;
  created_at: string;
}

interface RoleFormData {
  name: string;
  description: string;
  can_view_cost: boolean;
  can_view_mrp: boolean;
  can_manage_purchases: boolean;
  can_manage_sales: boolean;
  can_view_reports: boolean;
  can_manage_inventory: boolean;
  can_manage_masters: boolean;
  can_manage_users: boolean;
}

const initialFormData: RoleFormData = {
  name: '',
  description: '',
  can_view_cost: false,
  can_view_mrp: true,
  can_manage_purchases: false,
  can_manage_sales: false,
  can_view_reports: false,
  can_manage_inventory: false,
  can_manage_masters: false,
  can_manage_users: false,
};

const permissions = [
  { key: 'can_view_cost', label: 'View Cost Prices', description: 'Can view item cost prices' },
  { key: 'can_view_mrp', label: 'View MRP', description: 'Can view Maximum Retail Price' },
  { key: 'can_manage_purchases', label: 'Manage Purchases', description: 'Can create and edit purchase orders' },
  { key: 'can_manage_sales', label: 'Manage Sales', description: 'Can create and edit sales invoices' },
  { key: 'can_view_reports', label: 'View Reports', description: 'Can access all reports' },
  { key: 'can_manage_inventory', label: 'Manage Inventory', description: 'Can manage stock and inventory' },
  { key: 'can_manage_masters', label: 'Manage Master Data', description: 'Can manage all master data' },
  { key: 'can_manage_users', label: 'Manage Users', description: 'Can create and manage users' },
];

interface RoleManagementProps {
  onRolesChanged?: () => void;
}

export default function RoleManagement({ onRolesChanged }: RoleManagementProps = {}) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<RoleFormData>(initialFormData);

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .order('name');

      if (error) throw error;
      setRoles(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setError('Role name is required');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (editingId) {
        const { error } = await supabase
          .from('roles')
          .update(formData)
          .eq('id', editingId);

        if (error) throw error;
        setSuccess('Role updated successfully!');
      } else {
        const { error } = await supabase
          .from('roles')
          .insert([formData]);

        if (error) throw error;
        setSuccess('Role created successfully!');
      }

      setFormData(initialFormData);
      setShowAddForm(false);
      setEditingId(null);
      await loadRoles();
      if (onRolesChanged) {
        onRolesChanged();
      }
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (role: Role) => {
    setFormData({
      name: role.name,
      description: role.description,
      can_view_cost: role.can_view_cost,
      can_view_mrp: role.can_view_mrp,
      can_manage_purchases: role.can_manage_purchases,
      can_manage_sales: role.can_manage_sales,
      can_view_reports: role.can_view_reports,
      can_manage_inventory: role.can_manage_inventory,
      can_manage_masters: role.can_manage_masters,
      can_manage_users: role.can_manage_users,
    });
    setEditingId(role.id);
    setShowAddForm(true);
  };

  const handleDelete = async (roleId: string) => {
    if (!confirm('Are you sure you want to delete this role? Users with this role will need to be reassigned.')) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error } = await supabase
        .from('roles')
        .delete()
        .eq('id', roleId);

      if (error) throw error;

      setSuccess('Role deleted successfully!');
      await loadRoles();
      if (onRolesChanged) {
        onRolesChanged();
      }
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete role. It may be in use by existing users.');
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = (key: string) => {
    setFormData({
      ...formData,
      [key]: !formData[key as keyof RoleFormData],
    });
  };

  const cancelEdit = () => {
    setFormData(initialFormData);
    setEditingId(null);
    setShowAddForm(false);
    setError('');
  };

  return (
    <div className="mt-8 bg-blue-50 p-6 rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Shield className="w-5 h-5 mr-2 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-800">Available Roles</h3>
        </div>
        <button
          onClick={() => {
            if (showAddForm) {
              cancelEdit();
            } else {
              setShowAddForm(true);
              setFormData(initialFormData);
            }
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center text-sm"
        >
          {showAddForm ? <X className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
          {showAddForm ? 'Cancel' : 'Add Role'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 text-green-600 p-3 rounded-lg mb-4 text-sm">
          {success}
        </div>
      )}

      {showAddForm && (
        <div className="bg-white p-4 rounded-lg mb-4 border border-blue-100">
          <h4 className="text-md font-semibold mb-3">
            {editingId ? 'Edit Role' : 'Create New Role'}
          </h4>
          <form onSubmit={handleSubmit}>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Store Manager"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of this role"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            </div>

            <div className="mb-4">
              <h5 className="text-sm font-semibold text-gray-700 mb-2">Permissions</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {permissions.map((permission) => (
                  <div
                    key={permission.key}
                    className="bg-gray-50 p-3 rounded-lg border border-gray-200 hover:border-blue-400 cursor-pointer transition-colors"
                    onClick={() => togglePermission(permission.key)}
                  >
                    <div className="flex items-start">
                      <input
                        type="checkbox"
                        checked={formData[permission.key as keyof RoleFormData] as boolean}
                        onChange={() => togglePermission(permission.key)}
                        className="mt-1 mr-3 h-4 w-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex-1">
                        <span className="font-medium text-gray-800 text-sm">
                          {permission.label}
                        </span>
                        <p className="text-xs text-gray-600 mt-1">{permission.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={cancelEdit}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center text-sm"
              >
                {loading ? (
                  <>
                    <Loader className="w-4 h-4 mr-2 animate-spin" />
                    {editingId ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {editingId ? 'Update Role' : 'Create Role'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && !showAddForm ? (
        <div className="flex justify-center py-8">
          <Loader className="w-6 h-6 text-blue-600 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {roles.length === 0 ? (
            <div className="col-span-full text-center py-8 text-gray-500 text-sm">
              No roles found. Click "Add Role" to create one.
            </div>
          ) : (
            roles.map((role) => (
              <div
                key={role.id}
                className="bg-white p-4 rounded-lg border border-gray-200 hover:border-blue-400 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center">
                    <Shield className="w-4 h-4 text-blue-600 mr-1.5" />
                    <h4 className="font-semibold text-gray-800 text-sm">{role.name}</h4>
                  </div>
                  <div className="flex space-x-1.5">
                    <button
                      onClick={() => handleEdit(role)}
                      className="text-blue-600 hover:text-blue-800"
                      title="Edit Role"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(role.id)}
                      className="text-red-600 hover:text-red-800"
                      title="Delete Role"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {role.description && (
                  <p className="text-xs text-gray-600 mb-2">{role.description}</p>
                )}

                <div className="space-y-1 mt-2 text-xs text-gray-700">
                  {role.can_view_cost && <div>• View Cost Prices</div>}
                  {role.can_view_mrp && <div>• View MRP</div>}
                  {role.can_manage_purchases && <div>• Manage Purchases</div>}
                  {role.can_manage_sales && <div>• Manage Sales</div>}
                  {role.can_view_reports && <div>• View Reports</div>}
                  {role.can_manage_inventory && <div>• Manage Inventory</div>}
                  {role.can_manage_masters && <div>• Manage Master Data</div>}
                  {role.can_manage_users && <div>• Manage Users</div>}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
