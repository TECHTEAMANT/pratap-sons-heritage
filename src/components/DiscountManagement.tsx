import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Percent, Plus, Edit2, Save, X, Trash2 } from 'lucide-react';

interface Discount {
  id: string;
  discount_code: string;
  discount_name: string;
  discount_type: string;
  discount_value: number;
  applicable_product_groups: string[];
  start_date: string;
  end_date: string;
  is_active: boolean;
  priority: number;
  created_at: string;
}

interface ProductGroup {
  id: string;
  name: string;
  group_code: string;
}

export default function DiscountManagement() {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [productGroups, setProductGroups] = useState<ProductGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    discount_code: '',
    discount_name: '',
    discount_type: 'percentage',
    discount_value: '' as any,
    applicable_product_groups: [] as string[],
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    is_active: true,
    priority: '' as any,
  });

  useEffect(() => {
    loadDiscounts();
    loadProductGroups();
  }, []);

  const loadDiscounts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('discount_masters')
        .select('*')
        .order('priority', { ascending: false });

      if (error) throw error;
      setDiscounts(data || []);
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
      const dataToSave = {
        ...formData,
        discount_value: parseFloat(formData.discount_value) || 0,
        priority: parseInt(formData.priority) || 0,
      };

      if (editingId) {
        const { error } = await supabase
          .from('discount_masters')
          .update(dataToSave)
          .eq('id', editingId);

        if (error) throw error;
        setSuccess('Discount updated successfully');
      } else {
        const { error } = await supabase
          .from('discount_masters')
          .insert([dataToSave]);

        if (error) throw error;
        setSuccess('Discount created successfully');
      }

      resetForm();
      await loadDiscounts();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (discount: Discount) => {
    setFormData({
      discount_code: discount.discount_code,
      discount_name: discount.discount_name,
      discount_type: discount.discount_type,
      discount_value: discount.discount_value,
      applicable_product_groups: discount.applicable_product_groups || [],
      start_date: discount.start_date || new Date().toISOString().split('T')[0],
      end_date: discount.end_date || '',
      is_active: discount.is_active,
      priority: discount.priority,
    });
    setEditingId(discount.id);
    setShowAddForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this discount?')) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('discount_masters')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setSuccess('Discount deleted successfully');
      await loadDiscounts();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      discount_code: '',
      discount_name: '',
      discount_type: 'percentage',
      discount_value: '' as any,
      applicable_product_groups: [],
      start_date: new Date().toISOString().split('T')[0],
      end_date: '',
      is_active: true,
      priority: '' as any,
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
          <Percent className="w-8 h-8 text-purple-600 mr-3" />
          <div>
            <h3 className="text-2xl font-bold text-gray-800">Discount Management</h3>
            <p className="text-sm text-gray-600">Manage discounts and pricing rules</p>
          </div>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 flex items-center shadow-md"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Discount
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
        <div className="bg-white rounded-lg shadow-md p-6 border-2 border-purple-200">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-xl font-bold text-gray-800">
              {editingId ? 'Edit Discount' : 'Add New Discount'}
            </h4>
            <button onClick={resetForm} className="text-gray-500 hover:text-gray-700">
              <X className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Discount Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.discount_code}
                  onChange={(e) => setFormData({ ...formData, discount_code: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Discount Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.discount_name}
                  onChange={(e) => setFormData({ ...formData, discount_name: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Discount Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.discount_type}
                  onChange={(e) => setFormData({ ...formData, discount_type: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  required
                >
                  <option value="percentage">Percentage</option>
                  <option value="flat">Flat Amount</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Discount Value <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.discount_value}
                  onChange={(e) => setFormData({ ...formData, discount_value: e.target.value as any })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Priority
                </label>
                <input
                  type="number"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-5 h-5 text-purple-600"
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
                      className="w-4 h-4 text-purple-600"
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
                className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 disabled:from-gray-400 disabled:to-gray-500 flex items-center"
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
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      )}

      {!loading && discounts.length === 0 && (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <Percent className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-lg text-gray-600">No discounts configured</p>
        </div>
      )}

      {!loading && discounts.length > 0 && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-purple-100 to-pink-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Code</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Value</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Date Range</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Priority</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Status</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {discounts.map((discount) => (
                <tr key={discount.id} className="hover:bg-purple-50">
                  <td className="px-4 py-3 font-semibold text-purple-600">{discount.discount_code}</td>
                  <td className="px-4 py-3">{discount.discount_name}</td>
                  <td className="px-4 py-3">
                    <span className="capitalize">{discount.discount_type}</span>
                  </td>
                  <td className="px-4 py-3 font-bold">
                    {discount.discount_type === 'percentage'
                      ? `${discount.discount_value}%`
                      : `₹${discount.discount_value}`}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {new Date(discount.start_date).toLocaleDateString()} - {discount.end_date ? new Date(discount.end_date).toLocaleDateString() : 'No end'}
                  </td>
                  <td className="px-4 py-3 text-center font-semibold">{discount.priority}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      discount.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {discount.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => handleEdit(discount)}
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(discount.id)}
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
