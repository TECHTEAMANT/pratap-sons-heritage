import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DollarSign, Plus, Edit2, Save, X, Trash2 } from 'lucide-react';

interface PayoutCode {
  id: string;
  payout_code: string;
  payout_name: string;
  payout_type: string;
  applicable_product_groups: string[];
  is_active: boolean;
  created_at: string;
}

interface ProductGroup {
  id: string;
  name: string;
  group_code: string;
}

export default function PayoutCodeManagement() {
  const [payoutCodes, setPayoutCodes] = useState<PayoutCode[]>([]);
  const [productGroups, setProductGroups] = useState<ProductGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    payout_code: '',
    payout_name: '',
    payout_type: 'Commission',
    applicable_product_groups: [] as string[],
    is_active: true,
  });

  useEffect(() => {
    loadPayoutCodes();
    loadProductGroups();
  }, []);

  const loadPayoutCodes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('payout_codes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPayoutCodes(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadProductGroups = async () => {
    try {
      const { data, error} = await supabase
        .from('product_groups')
        .select('id, name, group_code')
        .order('name');

      if (error) throw error;
      setProductGroups(data || []);
    } catch (err: any) {
      console.error('Error loading product groups:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (editingId) {
        const { error } = await supabase
          .from('payout_codes')
          .update(formData)
          .eq('id', editingId);

        if (error) throw error;
        setSuccess('Payout code updated successfully');
      } else {
        const { error } = await supabase
          .from('payout_codes')
          .insert([formData]);

        if (error) throw error;
        setSuccess('Payout code created successfully');
      }

      resetForm();
      await loadPayoutCodes();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (payoutCode: PayoutCode) => {
    setFormData({
      payout_code: payoutCode.payout_code,
      payout_name: payoutCode.payout_name,
      payout_type: payoutCode.payout_type,
      applicable_product_groups: payoutCode.applicable_product_groups || [],
      is_active: payoutCode.is_active,
    });
    setEditingId(payoutCode.id);
    setShowAddForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this payout code?')) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('payout_codes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setSuccess('Payout code deleted successfully');
      await loadPayoutCodes();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      payout_code: '',
      payout_name: '',
      payout_type: 'Commission',
      applicable_product_groups: [],
      is_active: true,
    });
    setEditingId(null);
    setShowAddForm(false);
  };

  const toggleProductGroup = (groupId: string) => {
    const groups = formData.applicable_product_groups;
    if (groups.includes(groupId)) {
      setFormData({
        ...formData,
        applicable_product_groups: groups.filter(id => id !== groupId),
      });
    } else {
      setFormData({
        ...formData,
        applicable_product_groups: [...groups, groupId],
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <DollarSign className="w-8 h-8 text-green-600 mr-3" />
          <div>
            <h3 className="text-2xl font-bold text-gray-800">Payout Code Management</h3>
            <p className="text-sm text-gray-600">Manage payout codes for commissions and bonuses</p>
          </div>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-lg hover:from-green-700 hover:to-teal-700 flex items-center shadow-md"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Payout Code
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border-2 border-red-300 text-red-700 p-3 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border-2 border-green-300 text-green-700 p-3 rounded-lg">
          {success}
        </div>
      )}

      {showAddForm && (
        <div className="bg-white rounded-lg shadow-md p-6 border-2 border-green-200">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-xl font-bold text-gray-800">
              {editingId ? 'Edit Payout Code' : 'Add New Payout Code'}
            </h4>
            <button onClick={resetForm} className="text-gray-500 hover:text-gray-700">
              <X className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payout Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.payout_code}
                  onChange={(e) => setFormData({ ...formData, payout_code: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  placeholder="e.g., PC001"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payout Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.payout_name}
                  onChange={(e) => setFormData({ ...formData, payout_name: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  placeholder="e.g., Standard Commission"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payout Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.payout_type}
                  onChange={(e) => setFormData({ ...formData, payout_type: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  required
                >
                  <option value="Commission">Commission</option>
                  <option value="Bonus">Bonus</option>
                  <option value="Incentive">Incentive</option>
                </select>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-5 h-5 text-green-600"
                />
                <label className="ml-2 text-sm font-medium text-gray-700">
                  Active
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Applicable Product Groups
              </label>
              <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto border-2 border-gray-300 rounded-lg p-4">
                {productGroups.map((group) => (
                  <div key={group.id} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.applicable_product_groups.includes(group.id)}
                      onChange={() => toggleProductGroup(group.id)}
                      className="w-4 h-4 text-green-600"
                    />
                    <label className="ml-2 text-sm text-gray-700">{group.name}</label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Leave empty to apply to all product groups
              </p>
            </div>

            <div className="flex justify-end gap-4">
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-lg hover:from-green-700 hover:to-teal-700 disabled:from-gray-400 disabled:to-gray-500 flex items-center"
              >
                {loading ? (
                  'Saving...'
                ) : (
                  <>
                    <Save className="w-5 h-5 mr-2" />
                    {editingId ? 'Update' : 'Create'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && !showAddForm && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
        </div>
      )}

      {!loading && payoutCodes.length === 0 && (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <DollarSign className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-lg text-gray-600">No payout codes configured</p>
        </div>
      )}

      {!loading && payoutCodes.length > 0 && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-green-100 to-teal-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Code</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Type</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Product Groups</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Status</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {payoutCodes.map((code) => (
                <tr key={code.id} className="hover:bg-green-50">
                  <td className="px-4 py-3 font-semibold text-green-600">{code.payout_code}</td>
                  <td className="px-4 py-3">{code.payout_name}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-semibold">
                      {code.payout_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {code.applicable_product_groups.length === 0 ? (
                      <span className="text-gray-500">All</span>
                    ) : (
                      <span className="font-semibold">{code.applicable_product_groups.length}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      code.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {code.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => handleEdit(code)}
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(code.id)}
                        className="p-2 text-red-600 hover:bg-red-100 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
