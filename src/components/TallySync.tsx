import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { generateTallyExportData, downloadTallyJSON, generatePurchaseTallyExportData } from '../utils/tally';
import { Download, Check, RefreshCw, FileJson, AlertCircle, Loader, ShoppingCart, Package } from 'lucide-react';

interface TallySyncRecord {
  id: string;
  sync_type: string;
  invoice_id: string | null;
  purchase_order_id: string | null;
  invoice_number: string;
  invoice_date: string;
  customer_name: string;
  customer_mobile: string;
  total_amount: number;
  sync_status: string;
  synced_at: string | null;
  error_message: string | null;
  created_at: string;
  sync_data: any;
}

export default function TallySync() {
  const [syncRecords, setSyncRecords] = useState<TallySyncRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<'sales' | 'purchase'>('sales');
  const [filter, setFilter] = useState<'all' | 'pending' | 'synced'>('pending');

  useEffect(() => {
    loadSyncRecords();
  }, [filter, activeTab]);

  const loadSyncRecords = async () => {
    setLoading(true);
    setError('');

    try {
      let query = supabase
        .from('tally_sync')
        .select('*')
        .eq('sync_type', activeTab)
        .order('invoice_date', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('sync_status', filter);
      }

      const { data, error: queryError } = await query;

      if (queryError) throw queryError;
      setSyncRecords(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateSalesSyncRecords = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const { data: invoices, error: invoiceError } = await supabase
        .from('sales_invoices')
        .select(`
          *,
          sales_invoice_items (
            *,
            product_items (
              *,
              product_groups (*)
            )
          )
        `)
        .order('invoice_date', { ascending: false });

      if (invoiceError) throw invoiceError;

      let created = 0;
      for (const invoice of invoices || []) {
        const { data: existing } = await supabase
          .from('tally_sync')
          .select('id')
          .eq('invoice_id', invoice.id)
          .eq('sync_type', 'sales')
          .maybeSingle();

        if (existing) continue;

        const tallyData = await generateTallyExportData(invoice);

        const { error: insertError } = await supabase
          .from('tally_sync')
          .insert([{
            sync_type: 'sales',
            invoice_id: invoice.id,
            invoice_number: invoice.invoice_number,
            invoice_date: invoice.invoice_date,
            customer_name: invoice.customer_name || '',
            customer_mobile: invoice.customer_mobile || '',
            total_amount: invoice.net_payable || 0,
            sync_data: tallyData,
            sync_status: 'pending',
          }]);

        if (!insertError) {
          created++;
        }
      }

      setSuccess(`Generated ${created} new sales sync records`);
      loadSyncRecords();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const generatePurchaseSyncRecords = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const { data: purchaseOrders, error: poError } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          vendors (vendor_code, name),
          purchase_items (
            *,
            product_groups (*),
            colors (*),
            sizes (*)
          )
        `)
        .order('order_date', { ascending: false });

      if (poError) throw poError;

      let created = 0;
      for (const po of purchaseOrders || []) {
        const { data: existing } = await supabase
          .from('tally_sync')
          .select('id')
          .eq('purchase_order_id', po.id)
          .eq('sync_type', 'purchase')
          .maybeSingle();

        if (existing) continue;

        const tallyData = await generatePurchaseTallyExportData(po);

        const { error: insertError } = await supabase
          .from('tally_sync')
          .insert([{
            sync_type: 'purchase',
            purchase_order_id: po.id,
            invoice_number: po.invoice_number || po.po_number,
            invoice_date: po.order_date,
            customer_name: po.vendors?.name || '',
            customer_mobile: '',
            total_amount: po.total_amount || 0,
            sync_data: tallyData,
            sync_status: 'pending',
          }]);

        if (!insertError) {
          created++;
        }
      }

      setSuccess(`Generated ${created} new purchase sync records`);
      loadSyncRecords();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadJSON = (record: TallySyncRecord) => {
    if (record.sync_data) {
      const prefix = record.sync_type === 'sales' ? 'sales' : 'purchase';
      downloadTallyJSON(record.sync_data, `tally-${prefix}-${record.invoice_number}.json`);
    }
  };

  const markAsSynced = async (recordId: string) => {
    setError('');
    setSuccess('');

    try {
      const { error: updateError } = await supabase
        .from('tally_sync')
        .update({
          sync_status: 'synced',
          synced_at: new Date().toISOString(),
        })
        .eq('id', recordId);

      if (updateError) throw updateError;

      setSuccess('Marked as synced successfully');
      loadSyncRecords();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const markAsPending = async (recordId: string) => {
    setError('');
    setSuccess('');

    try {
      const { error: updateError } = await supabase
        .from('tally_sync')
        .update({
          sync_status: 'pending',
          synced_at: null,
        })
        .eq('id', recordId);

      if (updateError) throw updateError;

      setSuccess('Marked as pending successfully');
      loadSyncRecords();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <FileJson className="w-8 h-8 text-blue-600 mr-3" />
            <div>
              <h2 className="text-3xl font-bold text-gray-800">Tally Sync</h2>
              <p className="text-sm text-gray-600 mt-1">Export invoice data grouped by product groups for Tally integration</p>
            </div>
          </div>
          <button
            onClick={activeTab === 'sales' ? generateSalesSyncRecords : generatePurchaseSyncRecords}
            disabled={loading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center"
          >
            {loading ? (
              <>
                <Loader className="w-5 h-5 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5 mr-2" />
                Generate Sync Records
              </>
            )}
          </button>
        </div>

        <div className="flex gap-2 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('sales')}
            className={`px-6 py-3 font-medium transition flex items-center ${
              activeTab === 'sales'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <ShoppingCart className="w-5 h-5 mr-2" />
            Sales Invoices
          </button>
          <button
            onClick={() => setActiveTab('purchase')}
            className={`px-6 py-3 font-medium transition flex items-center ${
              activeTab === 'purchase'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <Package className="w-5 h-5 mr-2" />
            Purchase Invoices
          </button>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === 'pending'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => setFilter('synced')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === 'synced'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Synced
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

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {activeTab === 'sales' ? 'Invoice' : 'PO/Invoice'}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {activeTab === 'sales' ? 'Customer' : 'Vendor'}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Synced At
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {syncRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      No records found. Click "Generate Sync Records" to create them.
                    </td>
                  </tr>
                ) : (
                  syncRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{record.invoice_number}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Date(record.invoice_date).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm text-gray-900">{record.customer_name || 'N/A'}</div>
                        {record.customer_mobile && (
                          <div className="text-xs text-gray-500">{record.customer_mobile}</div>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          ₹{record.total_amount.toFixed(2)}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            record.sync_status === 'synced'
                              ? 'bg-green-100 text-green-800'
                              : record.sync_status === 'failed'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {record.sync_status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {record.synced_at
                            ? new Date(record.synced_at).toLocaleString()
                            : '-'}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => downloadJSON(record)}
                            className="text-blue-600 hover:text-blue-900 p-2 rounded hover:bg-blue-50"
                            title="Download JSON"
                          >
                            <Download className="w-5 h-5" />
                          </button>
                          {record.sync_status === 'pending' ? (
                            <button
                              onClick={() => markAsSynced(record.id)}
                              className="text-green-600 hover:text-green-900 p-2 rounded hover:bg-green-50"
                              title="Mark as Synced"
                            >
                              <Check className="w-5 h-5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => markAsPending(record.id)}
                              className="text-yellow-600 hover:text-yellow-900 p-2 rounded hover:bg-yellow-50"
                              title="Mark as Pending"
                            >
                              <RefreshCw className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
