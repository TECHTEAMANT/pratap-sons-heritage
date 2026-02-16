import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Package, Loader, FileText, CheckCircle, Plus, X, Save, Trash2, UserPlus } from 'lucide-react';

interface Vendor {
  id: string;
  name: string;
  vendor_code: string;
}

interface OrderItem {
  design_no: string;
  product_description: string;
  quantity: number;
  rate: number;
  total: number;
}

interface PurchaseOrder {
  id: string;
  po_number: string;
  vendor: {
    id: string;
    name: string;
    vendor_code: string;
  };
  order_date: string;
  total_items: number;
  total_amount: number;
  status: string;
  notes: string;
  invoice_number: string;
}

export default function PurchaseOrders() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [showQuickVendor, setShowQuickVendor] = useState(false);

  const [quickVendor, setQuickVendor] = useState({
    name: '',
    vendor_code: '',
    contact_person: '',
    mobile: '',
  });

  const [formData, setFormData] = useState({
    vendor_id: '',
    order_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const [items, setItems] = useState<OrderItem[]>([
    {
      design_no: '',
      product_description: '',
      quantity: 1,
      rate: 0,
      total: 0,
    },
  ]);

  useEffect(() => {
    loadOrders();
    loadVendors();
  }, [filterStatus]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('purchase_orders')
        .select('*, vendor:vendors(id, name, vendor_code)')
        .order('created_at', { ascending: false });

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      const { data, error } = await query;

      if (error) throw error;
      setOrders(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadVendors = async () => {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('id, name, vendor_code')
        .eq('status', 'active')
        .order('name');

      if (error) throw error;
      setVendors(data || []);
    } catch (err: any) {
      console.error('Error loading vendors:', err);
    }
  };

  const createQuickVendor = async () => {
    if (!quickVendor.name || !quickVendor.vendor_code) {
      setError('Vendor name and code are required');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('vendors')
        .insert([{
          name: quickVendor.name,
          vendor_code: quickVendor.vendor_code,
          contact_person: quickVendor.contact_person || null,
          mobile: quickVendor.mobile || null,
          status: 'active',
        }])
        .select()
        .single();

      if (error) throw error;

      setSuccess('Vendor created successfully!');
      setShowQuickVendor(false);
      setQuickVendor({ name: '', vendor_code: '', contact_person: '', mobile: '' });
      await loadVendors();
      setFormData({ ...formData, vendor_id: data.id });
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleItemChange = (index: number, field: keyof OrderItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    newItems[index].total = newItems[index].quantity * newItems[index].rate;
    setItems(newItems);
  };

  const addItem = () => {
    setItems([
      ...items,
      {
        design_no: '',
        product_description: '',
        quantity: 1,
        rate: 0,
        total: 0,
      },
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.vendor_id) {
      setError('Please select a vendor');
      return;
    }

    if (items.some(item => !item.product_description || item.quantity <= 0 || item.rate <= 0)) {
      setError('Please fill in all item details with valid values');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
      const totalAmount = items.reduce((sum, item) => sum + item.total, 0);

      const poNumber = await generatePONumber();

      const { data: poData, error: poError } = await supabase
        .from('purchase_orders')
        .insert([
          {
            po_number: poNumber,
            vendor_id: formData.vendor_id,
            order_date: formData.order_date,
            total_items: totalItems,
            total_amount: totalAmount,
            status: 'Draft',
            notes: formData.notes,
          },
        ])
        .select()
        .single();

      if (poError) throw poError;

      const itemsToInsert = items.map((item) => ({
        purchase_order_id: poData.id,
        design_no: item.design_no,
        product_description: item.product_description,
        quantity: item.quantity,
        rate: item.rate,
        total: item.total,
      }));

      const { error: itemsError } = await supabase
        .from('purchase_order_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      setSuccess(`Purchase Order ${poNumber} created successfully!`);
      resetForm();
      await loadOrders();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const generatePONumber = async () => {
    const { data, error } = await supabase.rpc('generate_po_number');
    if (error) {
      const { count } = await supabase
        .from('purchase_orders')
        .select('*', { count: 'exact', head: true });
      return `PO${String((count || 0) + 1).padStart(6, '0')}`;
    }
    return data;
  };

  const resetForm = () => {
    setFormData({
      vendor_id: '',
      order_date: new Date().toISOString().split('T')[0],
      notes: '',
    });
    setItems([
      {
        design_no: '',
        product_description: '',
        quantity: 1,
        rate: 0,
        total: 0,
      },
    ]);
    setShowForm(false);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'ordered':
        return 'bg-blue-100 text-blue-800';
      case 'received':
        return 'bg-green-100 text-green-800';
      case 'partial':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <Package className="w-8 h-8 text-blue-600 mr-3" />
            <h2 className="text-3xl font-bold text-gray-800">Purchase Orders</h2>
          </div>
          <div className="flex items-center space-x-4">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="Draft">Draft</option>
              <option value="Ordered">Ordered</option>
              <option value="Partial">Partial</option>
              <option value="Received">Received</option>
              <option value="Cancelled">Cancelled</option>
            </select>
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
            >
              {showForm ? <X className="w-5 h-5 mr-2" /> : <Plus className="w-5 h-5 mr-2" />}
              {showForm ? 'Cancel' : 'New PO'}
            </button>
          </div>
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

        {showQuickVendor && (
          <div className="bg-green-50 p-6 rounded-lg mb-6">
            <h3 className="text-lg font-semibold mb-4">Quick Add Vendor</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vendor Name *
                </label>
                <input
                  type="text"
                  value={quickVendor.name}
                  onChange={(e) => setQuickVendor({ ...quickVendor, name: e.target.value })}
                  placeholder="Enter vendor name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vendor Code *
                </label>
                <input
                  type="text"
                  value={quickVendor.vendor_code}
                  onChange={(e) => setQuickVendor({ ...quickVendor, vendor_code: e.target.value.toUpperCase() })}
                  placeholder="e.g., VEND001"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Person (Optional)
                </label>
                <input
                  type="text"
                  value={quickVendor.contact_person}
                  onChange={(e) => setQuickVendor({ ...quickVendor, contact_person: e.target.value })}
                  placeholder="Enter contact person"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mobile (Optional)
                </label>
                <input
                  type="text"
                  value={quickVendor.mobile}
                  onChange={(e) => setQuickVendor({ ...quickVendor, mobile: e.target.value })}
                  placeholder="10-digit mobile"
                  maxLength={10}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowQuickVendor(false);
                  setQuickVendor({ name: '', vendor_code: '', contact_person: '', mobile: '' });
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={createQuickVendor}
                disabled={loading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
              >
                {loading ? 'Creating...' : 'Create Vendor'}
              </button>
            </div>
          </div>
        )}

        {showForm && (
          <div className="bg-gray-50 p-6 rounded-lg mb-6">
            <h3 className="text-lg font-semibold mb-4">Create Purchase Order</h3>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Vendor *
                  </label>
                  <div className="flex space-x-2">
                    <select
                      value={formData.vendor_id}
                      onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select Vendor</option>
                      {vendors.map((vendor) => (
                        <option key={vendor.id} value={vendor.id}>
                          {vendor.name} ({vendor.vendor_code})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowQuickVendor(true)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center"
                      title="Quick Add Vendor"
                    >
                      <UserPlus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Order Date *
                  </label>
                  <input
                    type="date"
                    value={formData.order_date}
                    onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Enter any notes or special instructions"
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-md font-semibold text-gray-700">Order Items</h4>
                  <button
                    type="button"
                    onClick={addItem}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center text-sm"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Item
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border border-gray-300">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="p-2 text-left text-xs">Design No</th>
                        <th className="p-2 text-left text-xs">Product Description *</th>
                        <th className="p-2 text-left text-xs">Quantity *</th>
                        <th className="p-2 text-left text-xs">Rate *</th>
                        <th className="p-2 text-left text-xs">Total</th>
                        <th className="p-2 text-left text-xs">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, index) => (
                        <tr key={index} className="border-t">
                          <td className="p-2">
                            <input
                              type="text"
                              value={item.design_no}
                              onChange={(e) => handleItemChange(index, 'design_no', e.target.value)}
                              className="w-full px-2 py-1 border rounded text-sm"
                              placeholder="Optional"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={item.product_description}
                              onChange={(e) => handleItemChange(index, 'product_description', e.target.value)}
                              className="w-full px-2 py-1 border rounded text-sm"
                              required
                              placeholder="Enter description"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 0)}
                              className="w-20 px-2 py-1 border rounded text-sm"
                              min="1"
                              required
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              value={item.rate}
                              onChange={(e) => handleItemChange(index, 'rate', parseFloat(e.target.value) || 0)}
                              className="w-24 px-2 py-1 border rounded text-sm"
                              step="0.01"
                              required
                            />
                          </td>
                          <td className="p-2 text-sm font-semibold">
                            ₹{item.total.toFixed(2)}
                          </td>
                          <td className="p-2">
                            <button
                              type="button"
                              onClick={() => removeItem(index)}
                              className="text-red-600 hover:text-red-800"
                              disabled={items.length === 1}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex justify-end space-x-4">
                  <div className="text-md font-semibold text-gray-700">
                    Total Items: {items.reduce((sum, item) => sum + item.quantity, 0)}
                  </div>
                  <div className="text-xl font-bold text-gray-800">
                    Total Amount: ₹{items.reduce((sum, item) => sum + item.total, 0).toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
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
                      Create PO
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {loading && !showForm ? (
          <div className="flex justify-center py-12">
            <Loader className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-4 text-left text-sm font-semibold text-gray-700">PO #</th>
                    <th className="p-4 text-left text-sm font-semibold text-gray-700">Order Date</th>
                    <th className="p-4 text-left text-sm font-semibold text-gray-700">Vendor</th>
                    <th className="p-4 text-left text-sm font-semibold text-gray-700">Items</th>
                    <th className="p-4 text-left text-sm font-semibold text-gray-700">Total Amount</th>
                    <th className="p-4 text-left text-sm font-semibold text-gray-700">Status</th>
                    <th className="p-4 text-left text-sm font-semibold text-gray-700">Invoice #</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-gray-500">
                        No purchase orders found. Click "New PO" to create one.
                      </td>
                    </tr>
                  ) : (
                    orders.map((order) => (
                      <tr key={order.id} className="border-b hover:bg-gray-50">
                        <td className="p-4 text-sm font-semibold text-blue-600">
                          {order.po_number}
                        </td>
                        <td className="p-4 text-sm text-gray-700">
                          {new Date(order.order_date).toLocaleDateString()}
                        </td>
                        <td className="p-4 text-sm text-gray-700">
                          {order.vendor?.name || 'N/A'}
                          <div className="text-xs text-gray-500">{order.vendor?.vendor_code}</div>
                        </td>
                        <td className="p-4 text-sm text-gray-700">
                          {order.total_items || 0}
                        </td>
                        <td className="p-4 text-sm font-semibold text-gray-700">
                          ₹{(order.total_amount || 0).toFixed(2)}
                        </td>
                        <td className="p-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(order.status)}`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="p-4 text-sm text-gray-700">
                          {order.invoice_number ? (
                            <div className="flex items-center text-green-600">
                              <CheckCircle className="w-4 h-4 mr-1" />
                              {order.invoice_number}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <div className="flex items-start">
                <FileText className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-blue-900">Purchase Order Workflow</h3>
                  <p className="text-sm text-blue-800 mt-1">
                    Create purchase orders first, then link them to purchase invoices when goods are received.
                    You can also create purchase invoices directly, and the system will auto-generate a PO.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

