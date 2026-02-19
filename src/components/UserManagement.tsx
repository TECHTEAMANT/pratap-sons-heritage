import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Users, Plus, Edit2, Save, X, Loader, Shield, Trash2 } from 'lucide-react';
import RoleManagement from './RoleManagement';

export default function UserManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    mobile: '',
    password: '',
    name: '',
    role_id: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, rolesRes] = await Promise.all([
        supabase
          .from('users')
          .select('*, roles(id, name, description)')
          .eq('active', true)
          .order('created_at', { ascending: false }),
        supabase.from('roles').select('*').order('name'),
      ]);

      setUsers(usersRes.data || []);
      setRoles(rolesRes.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async () => {
    if (!formData.mobile || !formData.password || !formData.name || !formData.role_id) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const loginEmail = `${formData.mobile}@login.local`;
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: loginEmail,
        password: formData.password,
        options: {
          data: {
            name: formData.name,
          },
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        const { error: userError } = await supabase
          .from('users')
          .insert([{
            auth_user_id: authData.user.id,
            email: loginEmail,
            mobile: formData.mobile,
            name: formData.name,
            role_id: formData.role_id,
            active: true,
          }]);

        if (userError) throw userError;
      }

      setSuccess('User created successfully!');
      setFormData({ mobile: '', password: '', name: '', role_id: '' });
      setShowAddForm(false);
      loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRole = async (userId: string, roleId: string) => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const { data, error } = await supabase
        .from('users')
        .update({ role_id: roleId })
        .eq('id', userId)
        .select();

      if (error) throw error;

      console.log('Role updated:', data);

      setTimeout(async () => {
        await loadData();
        setEditingId(null);
        setSuccess('User role updated successfully!');
        setTimeout(() => setSuccess(''), 3000);
        setLoading(false);
      }, 100);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleDeactivateUser = async (userId: string) => {
    if (!confirm('Are you sure you want to deactivate this user? They will no longer be able to access the system.')) {
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const { error } = await supabase
        .from('users')
        .update({ active: false })
        .eq('id', userId);

      if (error) throw error;

      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setSuccess('User deactivated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to deactivate user.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <Users className="w-8 h-8 text-blue-600 mr-3" />
            <h2 className="text-3xl font-bold text-gray-800">User Management</h2>
          </div>
          <button
            onClick={() => {
              setShowAddForm(!showAddForm);
              setFormData({ mobile: '', password: '', name: '', role_id: '' });
            }}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
          >
            {showAddForm ? <X className="w-5 h-5 mr-2" /> : <Plus className="w-5 h-5 mr-2" />}
            {showAddForm ? 'Cancel' : 'Add User'}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 text-green-600 p-4 rounded-lg mb-6">
            {success}
          </div>
        )}

        {showAddForm && (
          <div className="bg-gray-50 p-6 rounded-lg mb-6">
            <h3 className="text-lg font-semibold mb-4">Add New User</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="tel"
                placeholder="Mobile Number"
                value={formData.mobile}
                onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="password"
                placeholder="Password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Full Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={formData.role_id}
                onChange={(e) => setFormData({ ...formData, role_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Role</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={handleAddUser}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center"
              >
                {loading ? (
                  <>
                    <Loader className="w-5 h-5 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5 mr-2" />
                    Create User
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {loading && !showAddForm ? (
          <div className="flex justify-center py-12">
            <Loader className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-4 text-left text-sm font-semibold text-gray-700">MOBILE</th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-700">FULL NAME</th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-700">ROLE</th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-700">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-gray-500">
                      No users found. Click "Add User" to get started.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="border-b hover:bg-gray-50">
                      <td className="p-4 text-sm text-gray-700">{user.mobile || user.email}</td>
                      <td className="p-4 text-sm text-gray-700">{user.name}</td>
                      <td className="p-4 text-sm text-gray-700">
                        {editingId === user.id ? (
                          <select
                            value={user.role_id || ''}
                            onChange={(e) => handleUpdateRole(user.id, e.target.value)}
                            className="px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">No Role</option>
                            {roles.map((role) => (
                              <option key={role.id} value={role.id}>
                                {role.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="inline-flex items-center">
                            <Shield className="w-4 h-4 mr-1 text-blue-600" />
                            {user.roles?.name || 'No Role'}
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        {editingId === user.id ? (
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-gray-600 hover:text-gray-800"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        ) : (
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => setEditingId(user.id)}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              <Edit2 className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleDeactivateUser(user.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        <RoleManagement onRolesChanged={loadData} />
      </div>
    </div>
  );
}
