import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AlertTriangle, Scan, Save, Loader, Search, Trash2 } from 'lucide-react';

interface DefectiveRecord {
  id: string;
  barcode: string;
  quantity: number;
  reason: string;
  notes: string;
  marked_at: string;
  item_details?: any;
}

export default function DefectiveStock() {
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [itemDetails, setItemDetails] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [defectiveRecords, setDefectiveRecords] = useState<DefectiveRecord[]>([]);

  useEffect(() => {
    loadDefectiveRecords();
  }, []);

  const loadDefectiveRecords = async () => {
    try {
      const { data, error } = await supabase
        .from('defective_stock')
        .select('*')
        .order('marked_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setDefectiveRecords(data || []);
    } catch (err: any) {
      console.error('Error loading defective records:', err);
    }
  };

  const searchByBarcode = async () => {
    if (!barcode.trim()) {
      setError('Please enter a barcode');
      return;
    }

    setSearching(true);
    setError('');
    setItemDetails(null);

    try {
      const { data, error } = await supabase
        .from('barcode_batches')
        .select(`
          *,
          product_group:product_groups(name, group_code),
          color:colors(name, color_code),
          size:sizes(name, size_code),
          vendor:vendors(name, vendor_code),
          floor:floors(name, floor_code)
        `)
        .eq('barcode_alias_8digit', barcode)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setError('Item not found with this barcode');
        return;
      }

      setItemDetails(data);
    } catch (err: any) {
      console.error('Error searching item:', err);
      setError(err.message || 'Failed to search item');
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!itemDetails) {
      setError('Please search for an item first');
      return;
    }

    if (!reason.trim()) {
      setError('Please provide a reason');
      return;
    }

    if (quantity < 1) {
      setError('Quantity must be at least 1');
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

      const defectiveData = {
        item_id: null,
        barcode: barcode,
        quantity: quantity,
        reason: reason,
        notes: notes || null,
        marked_by: userRecord?.id || null,
      };

      const { error: insertError } = await supabase
        .from('defective_stock')
        .insert([defectiveData]);

      if (insertError) throw insertError;

      setSuccess(`Marked ${quantity} unit(s) as defective for barcode: ${barcode}`);

      setBarcode('');
      setItemDetails(null);
      setQuantity(1);
      setReason('');
      setNotes('');

      loadDefectiveRecords();
    } catch (err: any) {
      console.error('Error marking as defective:', err);
      setError(err.message || 'Failed to mark item as defective');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this defective stock record?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('defective_stock')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setSuccess('Defective stock record deleted');
      loadDefectiveRecords();
    } catch (err: any) {
      console.error('Error deleting record:', err);
      setError(err.message || 'Failed to delete record');
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
        <div className="flex items-center mb-8">
          <AlertTriangle className="w-8 h-8 text-red-600 mr-3" />
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Defective Stock Management</h2>
            <p className="text-sm text-gray-600 mt-1">Scan barcode to mark items as defective</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Scan or Enter 8-Digit Barcode <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Scan className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      searchByBarcode();
                    }
                  }}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Scan or type barcode"
                  disabled={searching}
                />
              </div>
              <button
                type="button"
                onClick={searchByBarcode}
                disabled={searching || !barcode.trim()}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center"
              >
                {searching ? (
                  <>
                    <Loader className="w-5 h-5 mr-2 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5 mr-2" />
                    Search
                  </>
                )}
              </button>
            </div>
          </div>

          {itemDetails && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-800 mb-2">Item Details</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Design No</p>
                  <p className="font-medium">{itemDetails.design_no}</p>
                </div>
                <div>
                  <p className="text-gray-600">Product Group</p>
                  <p className="font-medium">{itemDetails.product_group?.name}</p>
                </div>
                <div>
                  <p className="text-gray-600">Color</p>
                  <p className="font-medium">{itemDetails.color?.name}</p>
                </div>
                <div>
                  <p className="text-gray-600">Size</p>
                  <p className="font-medium">{itemDetails.size?.name}</p>
                </div>
                <div>
                  <p className="text-gray-600">MRP</p>
                  <p className="font-medium">₹{itemDetails.mrp}</p>
                </div>
                <div>
                  <p className="text-gray-600">Floor</p>
                  <p className="font-medium">{itemDetails.floor?.name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-600">Status</p>
                  <p className="font-medium">{itemDetails.status}</p>
                </div>
                <div>
                  <p className="text-gray-600">Available Quantity</p>
                  <p className="font-medium">{itemDetails.available_quantity}</p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quantity <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                value={quantity === 0 ? '' : quantity}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') {
                    setQuantity(0);
                  } else {
                    setQuantity(parseInt(val) || 1);
                  }
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason <span className="text-red-500">*</span>
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select Reason</option>
                <option value="Damaged">Damaged</option>
                <option value="Manufacturing Defect">Manufacturing Defect</option>
                <option value="Torn">Torn</option>
                <option value="Stained">Stained</option>
                <option value="Wrong Size">Wrong Size</option>
                <option value="Color Mismatch">Color Mismatch</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Enter any additional notes about the defect"
              rows={3}
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 text-green-600 p-4 rounded-lg">
              {success}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading || !itemDetails}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 transition flex items-center"
            >
              {loading ? (
                <>
                  <Loader className="w-5 h-5 mr-2 animate-spin" />
                  Marking as Defective...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5 mr-2" />
                  Mark as Defective
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-8">
        <h3 className="text-2xl font-bold text-gray-800 mb-6">Recent Defective Stock Records</h3>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Barcode</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Quantity</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Reason</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Notes</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {defectiveRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No defective stock records found
                  </td>
                </tr>
              ) : (
                defectiveRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {new Date(record.marked_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {record.barcode}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {record.quantity}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {record.reason}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {record.notes || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={() => handleDelete(record.id)}
                        className="text-red-600 hover:text-red-800 flex items-center"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
