import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { PackageX, Plus, Trash2, Save, Loader, AlertCircle, Search, Check, X } from 'lucide-react';
import { calculateGSTBreakdown, GSTTransactionType } from '../utils/gstBreakdown';

interface ReturnItem {
  item_id: string;
  barcode_id: string;
  design_no: string;
  product_group: string;
  color: string;
  size: string;
  cost: number;
  hsn_code: string;
  condition: string;
  reason: string;
}

export default function PurchaseReturn() {
  const [vendors, setVendors] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showManualSelect, setShowManualSelect] = useState(false);
  const [availableItems, setAvailableItems] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState({
    vendorId: '',
    originalPoId: '',
    returnDate: new Date().toISOString().split('T')[0],
    reason: '',
    notes: '',
  });

  const [barcodeSearch, setBarcodeSearch] = useState('');
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [gstType, setGstType] = useState<GSTTransactionType>('CGST_SGST');
  const [gstAmount, setGstAmount] = useState<string>('0');

  useEffect(() => {
    loadVendors();
    loadReturns();
  }, []);

  useEffect(() => {
    if (formData.vendorId) {
      loadPurchaseOrders(formData.vendorId);
    }
  }, [formData.vendorId]);

  const loadVendors = async () => {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('active', true)
        .order('name');

      if (error) throw error;
      setVendors(data || []);
    } catch (err: any) {
      console.error('Error loading vendors:', err);
    }
  };

  const loadPurchaseOrders = async (vendorId: string) => {
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('vendor', vendorId)
        .order('order_date', { ascending: false });

      if (error) throw error;
      setPurchaseOrders(data || []);
    } catch (err: any) {
      console.error('Error loading purchase invoices:', err);
    }
  };

  const loadReturns = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('purchase_returns')
        .select(`
          *,
          vendors (name, vendor_code),
          purchase_orders (po_number, invoice_number)
        `)
        .order('return_date', { ascending: false });

      if (error) throw error;
      setReturns(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableItemsForReturn = async () => {
    if (!formData.vendorId) {
      setError('Please select a vendor first');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('barcode_batches')
        .select(`
          *,
          product_group:product_groups (name),
          color:colors (name),
          size:sizes (name)
        `)
        .eq('vendor', formData.vendorId)
        .eq('status', 'active')
        .gt('available_quantity', 0)
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      setAvailableItems(data || []);
    } catch (err: any) {
      console.error('Error loading available items:', err);
    }
  };

  const addManualItem = (item: any) => {
    const alreadyAdded = returnItems.find(i => i.barcode_id === item.barcode_alias_8digit);
    if (alreadyAdded) {
      setError('This item is already in the return list');
      setTimeout(() => setError(''), 3000);
      return;
    }

    const newItem: ReturnItem = {
      item_id: item.id,
      barcode_id: item.barcode_alias_8digit,
      design_no: item.design_no,
      product_group: item.product_group?.name || '',
      color: item.color?.name || '',
      size: item.size?.name || '',
      cost: item.cost_actual || 0,
      hsn_code: item.hsn_code || '',
      condition: 'defective',
      reason: '',
    };

    setReturnItems([...returnItems, newItem]);
    setShowManualSelect(false);
    setSearchQuery('');
    setSuccess('Item added to return list');
    setTimeout(() => setSuccess(''), 2000);
  };

  const searchItemByBarcode = async () => {
    if (!barcodeSearch.trim()) {
      setError('Please enter a barcode');
      return;
    }

    setError('');
    try {
      const { data, error } = await supabase
        .from('barcode_batches')
        .select(`
          *,
          product_group:product_groups (name),
          color:colors (name),
          size:sizes (name)
        `)
        .eq('barcode_alias_8digit', barcodeSearch.trim())
        .eq('status', 'active')
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setError('Item not found with this barcode');
        return;
      }

      if (formData.vendorId && data.vendor !== formData.vendorId) {
        setError('This barcode belongs to a different vendor');
        return;
      }

      const alreadyAdded = returnItems.find(item => item.barcode_id === data.barcode_alias_8digit);
      if (alreadyAdded) {
        setError('This item is already in the return list');
        return;
      }

      const newItem: ReturnItem = {
        item_id: data.id,
        barcode_id: data.barcode_alias_8digit,
        design_no: data.design_no,
        product_group: data.product_group?.name || '',
        color: data.color?.name || '',
        size: data.size?.name || '',
        cost: data.cost_actual || 0,
        hsn_code: data.hsn_code || '',
        condition: 'defective',
        reason: '',
      };

      setReturnItems([...returnItems, newItem]);
      setBarcodeSearch('');
      setSuccess('Item added to return list');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const removeItem = (index: number) => {
    const updated = returnItems.filter((_, i) => i !== index);
    setReturnItems(updated);
  };

  const updateItemField = (index: number, field: keyof ReturnItem, value: any) => {
    const updated = [...returnItems];
    updated[index] = { ...updated[index], [field]: value };
    setReturnItems(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.vendorId || returnItems.length === 0) {
      setError('Please select a vendor and add at least one item');
      return;
    }

    setLoading(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data: userRecord } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', userData?.user?.id)
        .maybeSingle();

      const returnNumber = `RET-${Date.now()}`;
      const totalAmount = returnItems.reduce((sum, item) => sum + item.cost, 0);
      const gst = parseFloat(gstAmount || '0');
      const gstBreakdown = calculateGSTBreakdown(gst, gstType);

      const { data: returnRecord, error: returnError } = await supabase
        .from('purchase_returns')
        .insert([{
          return_number: returnNumber,
          vendor_id: formData.vendorId,
          original_po_id: formData.originalPoId || null,
          return_date: formData.returnDate,
          total_items: returnItems.length,
          total_amount: totalAmount,
          gst_type: gstType,
          cgst_amount: gstBreakdown.cgstAmount,
          sgst_amount: gstBreakdown.sgstAmount,
          igst_amount: gstBreakdown.igstAmount,
          total_return_amount: totalAmount + gst,
          reason: formData.reason,
          notes: formData.notes,
          status: 'confirmed',
          created_by: userRecord?.id || null,
        }])
        .select()
        .single();

      if (returnError) throw returnError;

      for (const item of returnItems) {
        const { error: itemError } = await supabase
          .from('purchase_return_items')
          .insert([{
            return_id: returnRecord.id,
            item_id: item.item_id,
            barcode_id: item.barcode_id,
            reason: item.reason,
            condition: item.condition,
            cost: item.cost,
            hsn_code: item.hsn_code,
          }]);

        if (itemError) throw itemError;

        if (item.condition === 'defective') {
          const { error: defectiveError } = await supabase
            .from('defective_stock')
            .insert([{
              item_id: item.item_id,
              barcode: item.barcode_id,
              quantity: -1,
              reason: item.reason || 'Returned to vendor',
              notes: `Purchase return ${returnNumber}`,
              marked_by: userRecord?.id || null,
            }]);

          if (defectiveError) throw defectiveError;
        }

        const { data: batch, error: batchError } = await supabase
          .from('barcode_batches')
          .select('id, available_quantity')
          .eq('id', item.item_id)
          .maybeSingle();

        if (batchError) throw batchError;

        const currentAvailable = batch?.available_quantity ?? 0;
        const newAvailable = currentAvailable > 0 ? currentAvailable - 1 : 0;

        // If no units remain after return, mark as 'returned' so it disappears from inventory
        // Inventory.tsx filters by status='active', so 'returned' items are excluded
        const newStatus = newAvailable === 0 ? 'returned' : 'active';

        const { error: updateError } = await supabase
          .from('barcode_batches')
          .update({ available_quantity: newAvailable, status: newStatus })
          .eq('id', item.item_id);

        if (updateError) throw updateError;
      }

      setSuccess(`Purchase return ${returnNumber} created successfully with ${returnItems.length} items`);

      setFormData({
        vendorId: '',
        originalPoId: '',
        returnDate: new Date().toISOString().split('T')[0],
        reason: '',
        notes: '',
      });
      setReturnItems([]);
      setShowForm(false);
      loadReturns();
    } catch (err: any) {
      console.error('Error creating purchase return:', err);
      setError(err.message || 'Failed to create purchase return');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <PackageX className="w-8 h-8 text-red-600 mr-3" />
            <div>
              <h2 className="text-3xl font-bold text-gray-800">Purchase Returns</h2>
              <p className="text-sm text-gray-600 mt-1">Manage returns to vendors with automatic inventory updates</p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center"
          >
            {showForm ? (
              <>
                <Trash2 className="w-5 h-5 mr-2" />
                Cancel
              </>
            ) : (
              <>
                <Plus className="w-5 h-5 mr-2" />
                New Return
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 text-red-600 p-4 rounded-lg flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 bg-green-50 text-green-600 p-4 rounded-lg flex items-center">
            <Check className="w-5 h-5 mr-2" />
            {success}
          </div>
        )}

        {showForm ? (
          <form onSubmit={handleSubmit} className="space-y-6 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vendor <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.vendorId}
                  onChange={(e) => setFormData({ ...formData, vendorId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                  required
                >
                  <option value="">Select Vendor</option>
                  {vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.name} ({vendor.vendor_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Original Purchase Invoice (Optional)
                </label>
                <select
                  value={formData.originalPoId}
                  onChange={(e) => setFormData({ ...formData, originalPoId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                  disabled={!formData.vendorId}
                >
                  <option value="">Select Invoice</option>
                  {purchaseOrders.map((po) => (
                    <option key={po.id} value={po.id}>
                      {po.po_number} - {po.invoice_number || 'No Invoice'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Return Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.returnDate}
                  onChange={(e) => setFormData({ ...formData, returnDate: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Return Reason
                </label>
                <input
                  type="text"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                  placeholder="e.g., Defective items"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                rows={2}
                placeholder="Additional notes"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  GST Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={gstType}
                  onChange={(e) => setGstType(e.target.value as GSTTransactionType)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                >
                  <option value="CGST_SGST">CGST + SGST</option>
                  <option value="IGST">IGST</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  GST Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={gstAmount}
                  onChange={(e) => setGstAmount(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                  placeholder="Enter GST amount"
                />
              </div>
            </div>

            <div className="border-t pt-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Return Items</h3>

              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={barcodeSearch}
                  onChange={(e) => setBarcodeSearch(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), searchItemByBarcode())}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                  placeholder="Scan or enter barcode"
                />
                <button
                  type="button"
                  onClick={searchItemByBarcode}
                  className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center"
                >
                  <Search className="w-5 h-5 mr-2" />
                  Scan
                </button>
                <button
                  type="button"
                  onClick={() => {
                    loadAvailableItemsForReturn();
                    setShowManualSelect(true);
                  }}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Select Item
                </button>
              </div>

              {returnItems.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Barcode</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Design</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Color</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase text-blue-600 font-bold">HSN</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Condition</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {returnItems.map((item, index) => (
                        <tr key={index}>
                          <td className="px-4 py-3 text-sm">{item.barcode_id}</td>
                          <td className="px-4 py-3 text-sm">{item.design_no}</td>
                          <td className="px-4 py-3 text-sm">{item.product_group}</td>
                          <td className="px-4 py-3 text-sm">{item.color}</td>
                          <td className="px-4 py-3 text-sm">{item.size}</td>
                          <td className="px-4 py-3 text-sm">₹{item.cost.toFixed(2)}</td>
                          <td className="px-4 py-3 text-sm font-bold text-blue-600">{item.hsn_code || '-'}</td>
                          <td className="px-4 py-3 text-sm">
                            <select
                              value={item.condition}
                              onChange={(e) => updateItemField(index, 'condition', e.target.value)}
                              className="px-2 py-1 border border-gray-300 rounded text-sm"
                            >
                              <option value="defective">Defective</option>
                              <option value="damaged">Damaged</option>
                              <option value="wrong_item">Wrong Item</option>
                              <option value="excess">Excess</option>
                            </select>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <input
                              type="text"
                              value={item.reason}
                              onChange={(e) => updateItemField(index, 'reason', e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                              placeholder="Reason"
                            />
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <button
                              type="button"
                              onClick={() => removeItem(index)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-4 text-right">
                    <p className="text-lg font-bold text-gray-800">
                      Total Items: {returnItems.length} | Total Amount: ₹
                      {returnItems.reduce((sum, item) => sum + item.cost, 0).toFixed(2)}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No items added. Scan or search items by barcode to add them to the return.
                </div>
              )}
            </div>

            <div className="flex justify-end gap-4">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setReturnItems([]);
                  setFormData({
                    vendorId: '',
                    originalPoId: '',
                    returnDate: new Date().toISOString().split('T')[0],
                    reason: '',
                    notes: '',
                  });
                }}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || returnItems.length === 0}
                className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 flex items-center"
              >
                {loading ? (
                  <>
                    <Loader className="w-5 h-5 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5 mr-2" />
                    Create Return
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Return Number</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice Number</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {returns.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                      No purchase returns found. Click "New Return" to create one.
                    </td>
                  </tr>
                ) : (
                  returns.map((returnRecord) => (
                    <tr key={returnRecord.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium">{returnRecord.return_number}</td>
                      <td className="px-4 py-3 text-sm">
                        {new Date(returnRecord.return_date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div>{returnRecord.vendors?.name || 'N/A'}</div>
                        <div className="text-xs text-gray-500">{returnRecord.vendors?.vendor_code}</div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {returnRecord.purchase_orders?.po_number || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm">{returnRecord.total_items}</td>
                      <td className="px-4 py-3 text-sm font-medium">
                        ₹{returnRecord.total_amount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          returnRecord.status === 'confirmed'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {returnRecord.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">{returnRecord.reason || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showManualSelect && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-2xl font-bold text-gray-800">Select Item to Return</h3>
              <button
                onClick={() => {
                  setShowManualSelect(false);
                  setSearchQuery('');
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>

            <div className="p-6">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by barcode, design no, or product name..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 mb-4"
                autoFocus
              />
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-6">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Barcode</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Design</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Product</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Color</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Size</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Cost</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {availableItems
                    .filter(item => {
                      if (!searchQuery) return true;
                      const query = searchQuery.toLowerCase();
                      return (
                        (item.barcode_alias_8digit || '').toLowerCase().includes(query) ||
                        (item.design_no || '').toLowerCase().includes(query) ||
                        item.product_group?.name?.toLowerCase().includes(query) ||
                        item.color?.name?.toLowerCase().includes(query) ||
                        item.size?.name?.toLowerCase().includes(query)
                      );
                    })
                    .slice(0, 100)
                    .map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-mono">{item.barcode_alias_8digit}</td>
                        <td className="px-4 py-3 text-sm">{item.design_no}</td>
                        <td className="px-4 py-3 text-sm">{item.product_group?.name}</td>
                        <td className="px-4 py-3 text-sm">{item.color?.name}</td>
                        <td className="px-4 py-3 text-sm">{item.size?.name}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            item.status === 'Available' ? 'bg-green-100 text-green-800' :
                            item.status === 'Sold' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right">₹{(item.cost_actual || 0).toFixed(2)}</td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => addManualItem(item)}
                            disabled={item.status === 'Returned'}
                            className="px-4 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm disabled:bg-gray-400 disabled:cursor-not-allowed"
                          >
                            Return
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {availableItems.filter(item => {
                if (!searchQuery) return true;
                const query = searchQuery.toLowerCase();
                return (
                  (item.barcode_alias_8digit || '').toLowerCase().includes(query) ||
                  (item.design_no || '').toLowerCase().includes(query) ||
                  item.product_group?.name?.toLowerCase().includes(query)
                );
              }).length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <Search className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p>No items found matching your search</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
