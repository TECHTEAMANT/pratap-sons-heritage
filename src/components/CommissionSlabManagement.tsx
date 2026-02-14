import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { TrendingUp, Plus, Edit2, Save, X, Trash2 } from 'lucide-react';

interface CommissionSlab {
  id: string;
  product_group_name: string;
  payout_code_id: string;
  payout_code?: {
    payout_code: string;
    payout_name: string;
  };
  min_amount: number;
  max_amount: number | null;
  commission_percentage: number;
  flat_amount: number;
  is_active: boolean;
  created_at: string;
}

interface ProductGroup {
  id: string;
  name: string;
  group_code: string;
}

interface PayoutCode {
  id: string;
  payout_code: string;
  payout_name: string;
}

export default function CommissionSlabManagement() {
  const [slabs, setSlabs] = useState<CommissionSlab[]>([]);
  const [productGroups, setProductGroups] = useState<ProductGroup[]>([]);
  const [payoutCodes, setPayoutCodes] = useState<PayoutCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    product_group_name: '',
    payout_code_id: '',
    min_amount: '' as any,
    max_amount: null as number | null,
    commission_percentage: '' as any,
    flat_amount: '' as any,
    is_active: true,
  });

  useEffect(() => {
    loadSlabs();
    loadProductGroups();
    loadPayoutCodes();
  }, []);

  const loadSlabs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('commission_slabs')
        .select(`
          *,
          payout_code:payout_codes(payout_code, payout_name)
        `)
        .order('product_group_name')
        .order('min_amount');

      if (error) throw error;
      setSlabs(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadProductGroups = async () => {
    try {
      const { data, error } = await supabase
        .from('product_groups')
        .select('id, name, group_code')
        .eq('active', true)
        .order('name');

      if (error) throw error;
      setProductGroups(data || []);
    } catch (err: any) {
      console.error('Error loading product groups:', err);
    }
  };

  const loadPayoutCodes = async () => {
    try {
      const { data, error } = await supabase
        .from('payout_codes')
        .select('id, payout_code, payout_name')
        .eq('is_active', true)
        .order('payout_code');

      if (error) throw error;
      setPayoutCodes(data || []);
    } catch (err: any) {
      console.error('Error loading payout codes:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const dataToSave = {
        ...formData,
        min_amount: parseFloat(formData.min_amount) || 0,
        commission_percentage: parseFloat(formData.commission_percentage) || 0,
        flat_amount: parseFloat(formData.flat_amount) || 0,
      };

      if (editingId) {
        const { error } = await supabase
          .from('commission_slabs')
          .update(dataToSave)
          .eq('id', editingId);

        if (error) throw error;
        setSuccess('Commission slab updated successfully');
      } else {
        const { error } = await supabase
          .from('commission_slabs')
          .insert([dataToSave]);

        if (error) throw error;
        setSuccess('Commission slab created successfully');
      }

      resetForm();
      await loadSlabs();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (slab: CommissionSlab) => {
    setFormData({
      product_group_name: slab.product_group_name,
      payout_code_id: slab.payout_code_id,
      min_amount: slab.min_amount,
      max_amount: slab.max_amount,
      commission_percentage: slab.commission_percentage,
      flat_amount: slab.flat_amount,
      is_active: slab.is_active,
    });
    setEditingId(slab.id);
    setShowAddForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this commission slab?')) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('commission_slabs')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setSuccess('Commission slab deleted successfully');
      await loadSlabs();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      product_group_name: '',
      payout_code_id: '',
      min_amount: '' as any,
      max_amount: null,
      commission_percentage: '' as any,
      flat_amount: '' as any,
      is_active: true,
    });
    setEditingId(null);
    setShowAddForm(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <TrendingUp className="w-8 h-8 text-blue-600 mr-3" />
          <div>
            <h3 className="text-2xl font-bold text-gray-800">Commission Slab Management</h3>
            <p className="text-sm text-gray-600">Configure commission slabs based on sales amounts</p>
          </div>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg hover:from-blue-700 hover:to-cyan-700 flex items-center shadow-md"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Commission Slab
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
        <div className="bg-white rounded-lg shadow-md p-6 border-2 border-blue-200">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-xl font-bold text-gray-800">
              {editingId ? 'Edit Commission Slab' : 'Add New Commission Slab'}
            </h4>
            <button onClick={resetForm} className="text-gray-500 hover:text-gray-700">
              <X className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Product Group <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.product_group_name}
                  onChange={(e) => setFormData({ ...formData, product_group_name: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Product Group</option>
                  <option value="All Products">All Products</option>
                  {productGroups.map((group) => (
                    <option key={group.id} value={group.name}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payout Code <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.payout_code_id}
                  onChange={(e) => setFormData({ ...formData, payout_code_id: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Payout Code</option>
                  {payoutCodes.map((code) => (
                    <option key={code.id} value={code.id}>
                      {code.payout_code} - {code.payout_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Minimum Amount <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.min_amount}
                  onChange={(e) => setFormData({ ...formData, min_amount: e.target.value as any })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Maximum Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.max_amount || ''}
                  onChange={(e) => setFormData({ ...formData, max_amount: e.target.value ? parseFloat(e.target.value) : null })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Leave empty for unlimited"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Commission Percentage (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.commission_percentage}
                  onChange={(e) => setFormData({ ...formData, commission_percentage: e.target.value as any })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Flat Amount (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.flat_amount}
                  onChange={(e) => setFormData({ ...formData, flat_amount: e.target.value as any })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-5 h-5 text-blue-600"
                />
                <label className="ml-2 text-sm font-medium text-gray-700">
                  Active
                </label>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> If both percentage and flat amount are provided, they will be added together.
                Leave max amount empty to apply for all amounts above the minimum.
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
                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg hover:from-blue-700 hover:to-cyan-700 disabled:from-gray-400 disabled:to-gray-500 flex items-center"
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
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      )}

      {!loading && slabs.length === 0 && (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <TrendingUp className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-lg text-gray-600">No commission slabs configured</p>
        </div>
      )}

      {!loading && slabs.length > 0 && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-blue-100 to-cyan-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Product Group</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Payout Code</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Min Amount</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Max Amount</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Commission %</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Flat Amount</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Status</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {slabs.map((slab) => (
                <tr key={slab.id} className="hover:bg-blue-50">
                  <td className="px-4 py-3 font-semibold">{slab.product_group_name}</td>
                  <td className="px-4 py-3 text-sm">
                    {slab.payout_code?.payout_code || 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-right">₹{slab.min_amount.toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-right">
                    {slab.max_amount ? `₹${slab.max_amount.toLocaleString('en-IN')}` : '∞'}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-blue-600">
                    {slab.commission_percentage}%
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-green-600">
                    {slab.flat_amount > 0 ? `₹${slab.flat_amount.toLocaleString('en-IN')}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      slab.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {slab.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => handleEdit(slab)}
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(slab.id)}
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
