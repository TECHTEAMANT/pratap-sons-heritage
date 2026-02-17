import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Barcode, Edit2, Save, X, Printer, Upload, Search } from 'lucide-react';

const ENABLE_BARCODE_PRINT_AUDIT_LOGS = true;

interface BarcodeBatch {
  id: string;
  barcode_alias_8digit: string;
  barcode_structured: string;
  design_no: string;
  product_group: any;
  size: any;
  color: any;
  vendor: any;
  payout_code: string | null;
  cost_actual: number;
  mrp: number;
  total_quantity: number;
  available_quantity: number;
  discount_type: string | null;
  discount_value: number | null;
  discount_start_date: string | null;
  discount_end_date: string | null;
  status: string;
}

export default function BarcodeManagement() {
  const [barcodes, setBarcodes] = useState<BarcodeBatch[]>([]);
  const [filteredBarcodes, setFilteredBarcodes] = useState<BarcodeBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<any>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [discountMasters, setDiscountMasters] = useState<any[]>([]);

  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [printBarcode, setPrintBarcode] = useState<BarcodeBatch | null>(null);
  const [printReason, setPrintReason] = useState('');
  const [printQuantity, setPrintQuantity] = useState(1);

  const [showBulkImport, setShowBulkImport] = useState(false);
  const [selectedDiscount, setSelectedDiscount] = useState('');
  const [importData, setImportData] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterBarcodes();
  }, [searchTerm, barcodes]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [barcodesRes, discountsRes] = await Promise.all([
        supabase
          .from('barcode_batches')
          .select(`
            *,
            product_group:product_groups(name, group_code),
            size:sizes(name, size_code),
            color:colors(name, color_code),
            vendor:vendors(name, vendor_code)
          `)
          .order('created_at', { ascending: false }),
        supabase.from('discount_masters').select('*').eq('active', true),
      ]);

      setBarcodes(barcodesRes.data || []);
      setFilteredBarcodes(barcodesRes.data || []);
      setDiscountMasters(discountsRes.data || []);
    } catch (err) {
      console.error('Error loading barcodes:', err);
      setError('Failed to load barcode data');
    } finally {
      setLoading(false);
    }
  };

  const filterBarcodes = () => {
    if (!searchTerm) {
      setFilteredBarcodes(barcodes);
      return;
    }

    const filtered = barcodes.filter(b =>
      b.barcode_alias_8digit.includes(searchTerm) ||
      b.design_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.vendor?.vendor_code?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredBarcodes(filtered);
  };

  const startEdit = (barcode: BarcodeBatch) => {
    setEditingId(barcode.id);
    setEditValues({
      payout_code: barcode.payout_code || '',
      discount_type: barcode.discount_type || '',
      discount_value: barcode.discount_value || '',
      discount_start_date: barcode.discount_start_date || '',
      discount_end_date: barcode.discount_end_date || '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({});
  };

  const saveEdit = async (barcodeId: string) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data: userRecord } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', userData?.user?.id)
        .maybeSingle();

      await supabase
        .from('barcode_batches')
        .update({
          payout_code: editValues.payout_code || null,
          discount_type: editValues.discount_type || null,
          discount_value: editValues.discount_value ? parseFloat(editValues.discount_value) : null,
          discount_start_date: editValues.discount_start_date || null,
          discount_end_date: editValues.discount_end_date || null,
          modified_by: userRecord?.id || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', barcodeId);

      setSuccess('Barcode updated successfully');
      setTimeout(() => setSuccess(''), 3000);
      setEditingId(null);
      loadData();
    } catch (err) {
      console.error('Error updating barcode:', err);
      setError('Failed to update barcode');
    }
  };

  const handlePrint = (barcode: BarcodeBatch) => {
    setPrintBarcode(barcode);
    setShowPrintDialog(true);
    setPrintReason('');
    setPrintQuantity(1);
  };

  const confirmPrint = async () => {
    if (!printReason.trim()) {
      setError('Please provide a reason for printing');
      return;
    }

    try {
      sessionStorage.setItem('returnTo', '#barcode-management');
    } catch {}

    // Navigate in the same tab and auto-trigger print
    const printUrl = `${window.location.origin}${window.location.pathname}#barcode-print?batch_id=${printBarcode?.id}&quantity=${printQuantity}&alias=${printBarcode?.barcode_alias_8digit}&design=${printBarcode?.design_no}&mrp=${printBarcode?.mrp}&product=${encodeURIComponent(printBarcode?.product_group?.name || '')}&color=${encodeURIComponent(printBarcode?.color?.name || '')}&size=${encodeURIComponent(printBarcode?.size?.name || '')}&vendor_code=${encodeURIComponent(printBarcode?.vendor?.vendor_code || '')}&discount_type=${printBarcode?.discount_type || ''}&discount_value=${printBarcode?.discount_value || ''}&auto=1`;
    window.location.assign(printUrl);
    setShowPrintDialog(false);
    setPrintBarcode(null);
    setSuccess('Print job started');
    setTimeout(() => setSuccess(''), 3000);

    // Perform logging in the background without awaiting it to avoid blocking the UI
    if (ENABLE_BARCODE_PRINT_AUDIT_LOGS) {
      setTimeout(async () => {
        try {
          const { data: userData } = await supabase.auth.getUser();
          if (!userData?.user) return;

          const { data: userRecord } = await supabase
            .from('users')
            .select('id')
            .eq('auth_user_id', userData.user.id)
            .maybeSingle();

          const { error: logError } = await supabase
            .from('barcode_print_logs')
            .insert([{
              barcode_alias: printBarcode?.barcode_alias_8digit,
              barcode_batch_id: printBarcode?.id,
              quantity_printed: printQuantity,
              reason: printReason,
              printed_by: userRecord?.id,
            }]);

          if (logError) {
            if (logError.code === 'PGRST204') {
              await supabase.from('barcode_print_logs').insert([{
                items_printed: [{
                  barcode_alias: printBarcode?.barcode_alias_8digit,
                  barcode_batch_id: printBarcode?.id,
                  quantity_printed: printQuantity,
                  reason: printReason
                }],
                printed_by: userRecord?.id,
              }]);
            } else {
              console.error('Failed to log print action:', logError);
            }
          }
        } catch (err) {
          console.error('Error in print logging background task:', err);
        }
      }, 0);
    }
  };

  const handleBulkImport = () => {
    if (!selectedDiscount || !importData.trim()) {
      setError('Please select discount type and provide barcode data');
      return;
    }

    const discountMaster = discountMasters.find(d => d.id === selectedDiscount);
    if (!discountMaster) {
      setError('Invalid discount selection');
      return;
    }

    const barcodeList = importData.split(/[\n,]/).map(b => b.trim()).filter(b => b);

    applyBulkDiscount(barcodeList, discountMaster);
  };

  const applyBulkDiscount = async (barcodeList: string[], discountMaster: any) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data: userRecord } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', userData?.user?.id)
        .maybeSingle();

      for (const barcode of barcodeList) {
        await supabase
          .from('barcode_batches')
          .update({
            discount_type: discountMaster.discount_type,
            discount_value: discountMaster.default_value,
            modified_by: userRecord?.id,
            updated_at: new Date().toISOString(),
          })
          .or(`barcode_alias_8digit.eq.${barcode},design_no.eq.${barcode}`);
      }

      setSuccess(`Bulk discount applied to ${barcodeList.length} items`);
      setTimeout(() => setSuccess(''), 3000);
      setShowBulkImport(false);
      setImportData('');
      loadData();
    } catch (err) {
      console.error('Error applying bulk discount:', err);
      setError('Failed to apply bulk discount');
    }
  };

  const calculateDiscountedPrice = (mrp: number, discountType: string | null, discountValue: number | null): number => {
    if (!discountType || !discountValue) return mrp;

    if (discountType === 'percentage') {
      return mrp - (mrp * discountValue / 100);
    } else {
      return mrp - discountValue;
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <Barcode className="w-8 h-8 text-blue-600 mr-3" />
            <div>
              <h2 className="text-3xl font-bold text-gray-800">Barcode Management</h2>
              <p className="text-sm text-gray-600">Manage barcodes, payout codes, and discounts</p>
            </div>
          </div>
          <button
            onClick={() => setShowBulkImport(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center"
          >
            <Upload className="w-5 h-5 mr-2" />
            Bulk Discount Import
          </button>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by barcode, design number, or vendor code..."
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
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

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">8-Digit Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Design</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payout Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost/MRP</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Discount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    Loading barcodes...
                  </td>
                </tr>
              ) : filteredBarcodes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    No barcodes found
                  </td>
                </tr>
              ) : (
                filteredBarcodes.map((barcode) => (
                  <tr key={barcode.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <div className="font-mono text-lg font-bold text-blue-600">
                        {barcode.barcode_alias_8digit}
                      </div>
                      <div className="text-xs text-gray-500">{barcode.status}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-medium text-gray-800">{barcode.design_no}</div>
                      <div className="text-xs text-gray-500">{barcode.vendor?.vendor_code}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-600">
                        {barcode.product_group?.name} | {barcode.color?.name} | {barcode.size?.name}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {editingId === barcode.id ? (
                        <input
                          type="text"
                          value={editValues.payout_code}
                          onChange={(e) => setEditValues({ ...editValues, payout_code: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          placeholder="Payout code"
                        />
                      ) : (
                        <span className="text-sm">{barcode.payout_code || '-'}</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm">
                        <div>Cost: ₹{barcode.cost_actual}</div>
                        <div>MRP: ₹{barcode.mrp}</div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {editingId === barcode.id ? (
                        <div className="space-y-2">
                          <select
                            value={editValues.discount_type}
                            onChange={(e) => setEditValues({ ...editValues, discount_type: e.target.value })}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          >
                            <option value="">None</option>
                            <option value="percentage">Percentage</option>
                            <option value="flat">Flat</option>
                          </select>
                          {editValues.discount_type && (
                            <>
                              <input
                                type="number"
                                step="0.01"
                                value={editValues.discount_value}
                                onChange={(e) => setEditValues({ ...editValues, discount_value: e.target.value })}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                placeholder="Value"
                              />
                              <input
                                type="date"
                                value={editValues.discount_start_date}
                                onChange={(e) => setEditValues({ ...editValues, discount_start_date: e.target.value })}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                              />
                              <input
                                type="date"
                                value={editValues.discount_end_date}
                                onChange={(e) => setEditValues({ ...editValues, discount_end_date: e.target.value })}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                              />
                            </>
                          )}
                        </div>
                      ) : barcode.discount_type && barcode.discount_value ? (
                        <div className="text-sm">
                          <div className="font-medium text-green-600">
                            {barcode.discount_type === 'percentage'
                              ? `${barcode.discount_value}%`
                              : `₹${barcode.discount_value}`}
                          </div>
                          <div className="text-xs text-gray-500">
                            Final: ₹{calculateDiscountedPrice(barcode.mrp, barcode.discount_type, barcode.discount_value).toFixed(2)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">No discount</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm">
                        <div>Total: {barcode.total_quantity}</div>
                        <div className="text-green-600">Avail: {barcode.available_quantity}</div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {editingId === barcode.id ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveEdit(barcode.id)}
                            className="p-2 bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEdit(barcode)}
                            className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handlePrint(barcode)}
                            className="p-2 bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            <Printer className="w-4 h-4" />
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
      </div>

      {showPrintDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full">
            <h3 className="text-2xl font-bold text-gray-800 mb-4">Print Barcode</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Barcode: {printBarcode?.barcode_alias_8digit}
              </label>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Design: {printBarcode?.design_no}
              </label>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quantity <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                value={printQuantity}
                onChange={(e) => setPrintQuantity(parseInt(e.target.value) || 1)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Printing <span className="text-red-500">*</span>
              </label>
              <textarea
                value={printReason}
                onChange={(e) => setPrintReason(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                rows={3}
                placeholder="e.g., Initial print, Replacement, Restock"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowPrintDialog(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={confirmPrint}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Print
              </button>
            </div>
          </div>
        </div>
      )}

      {showBulkImport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-2xl w-full">
            <h3 className="text-2xl font-bold text-gray-800 mb-4">Bulk Discount Import</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Discount Type <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedDiscount}
                onChange={(e) => setSelectedDiscount(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Select discount master</option>
                {discountMasters.map(dm => (
                  <option key={dm.id} value={dm.id}>
                    {dm.flag_name} ({dm.discount_type === 'percentage' ? `${dm.default_value}%` : `₹${dm.default_value}`})
                  </option>
                ))}
              </select>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter Barcodes or Design Numbers <span className="text-red-500">*</span>
              </label>
              <textarea
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                rows={10}
                placeholder="Enter barcodes (8-digit) or design numbers, one per line or comma-separated&#10;Example:&#10;00001234&#10;00001235&#10;DN458"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowBulkImport(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkImport}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Apply Discount
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
