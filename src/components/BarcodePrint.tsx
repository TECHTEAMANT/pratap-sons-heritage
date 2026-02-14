import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Barcode as BarcodeIcon, Search, Printer, RefreshCw, Download } from 'lucide-react';
import { generateBarcodeDataURL } from '../utils/barcodeGenerator';

export default function BarcodePrint() {
  const [searchTerm, setSearchTerm] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [printSize, setPrintSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [poData, setPOData] = useState<any>(null);
  const [selectedSizeFilter, setSelectedSizeFilter] = useState<string>('all');
  const [availableSizes, setAvailableSizes] = useState<any[]>([]);

  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.split('?')[1] || '');
    const poId = params.get('po_id');
    const invoice = params.get('invoice');
    const order = params.get('order');
    const barcodeId = params.get('barcode_id');
    const batchId = params.get('batch_id');
    const quantity = params.get('quantity');

    if (poId) {
      loadPOItems(poId, invoice || '', order || '');
    } else if (batchId) {
      loadBatchItems(batchId, parseInt(quantity || '1', 10));
    } else if (barcodeId) {
      loadSingleItem(barcodeId, parseInt(quantity || '1', 10));
    } else {
      loadItems();
    }
  }, []);

  useEffect(() => {
    const uniqueSizes = Array.from(
      new Set(items.map(item => item.sizes?.name).filter(Boolean))
    ).map(name => {
      const item = items.find(i => i.sizes?.name === name);
      return {
        name,
        id: item?.sizes?.id || item?.size,
      };
    });
    setAvailableSizes(uniqueSizes);
  }, [items]);

  const loadPOItems = async (poId: string, invoiceNumber: string, orderNumber: string) => {
    setLoading(true);
    try {
      const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          vendors:vendor(name, vendor_code)
        `)
        .eq('id', poId)
        .single();

      if (poError) throw poError;

      const { data: purchaseItems, error: itemsError } = await supabase
        .from('purchase_items')
        .select(`
          *,
          product_groups:product_group(name, group_code),
          colors:color(name, color_code),
          sizes:size(name, size_code)
        `)
        .eq('po_id', poId);

      if (itemsError) throw itemsError;

      const itemsWithQuantity: any[] = [];
      purchaseItems?.forEach((item: any) => {
        for (let i = 0; i < item.quantity; i++) {
          itemsWithQuantity.push({
            ...item,
            barcode_id: `${item.design_no}-${po.vendors.vendor_code}-${item.product_groups.group_code}-${item.colors.color_code}-${item.sizes.size_code}-${i + 1}`,
            mrp: item.mrp,
            po_id: poId,
            invoice_number: invoiceNumber,
            order_number: orderNumber,
          });
        }
      });

      setPOData({
        id: poId,
        po_number: po.po_number,
        invoice_number: invoiceNumber,
        order_number: orderNumber,
        vendor: po.vendors,
      });

      setItems(itemsWithQuantity);
      setSelectedItems(new Set(itemsWithQuantity.map(item => item.barcode_id)));
    } catch (err) {
      console.error('Error loading PO items:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadBatchItems = async (batchId: string, quantity: number) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('barcode_batches')
        .select(`
          *,
          product_groups:product_group(name, group_code),
          colors:color(name, color_code),
          sizes:size(name, size_code),
          vendors:vendor(name, vendor_code),
          purchase_orders:po_id(id, po_number, invoice_number, order_number)
        `)
        .eq('id', batchId)
        .single();

      if (error) throw error;

      if (data) {
        const item = {
          barcode_id: data.barcode_alias_8digit,
          product_groups: data.product_groups,
          design_no: data.design_no,
          colors: data.colors,
          sizes: data.sizes,
          mrp: data.mrp,
          status: data.status,
          purchase_orders: data.purchase_orders
        };

        const itemsToPrint = Array(quantity).fill(item);
        setItems(itemsToPrint);
        setSelectedItems(new Set([item.barcode_id]));
      }
    } catch (err) {
      console.error('Error loading batch:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSingleItem = async (barcodeId: string, quantity: number) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('product_items')
        .select(`
          *,
          product_groups:product_group(name, group_code),
          colors:color(name, color_code),
          sizes:size(name, size_code),
          vendors:vendor(name, vendor_code),
          purchase_orders:po_id(id, po_number, invoice_number, order_number)
        `)
        .eq('barcode_id', barcodeId)
        .single();

      if (error) throw error;

      if (data) {
        const itemsToPrint = Array(quantity).fill(data);
        setItems(itemsToPrint);
        setSelectedItems(new Set([barcodeId]));
      }
    } catch (err) {
      console.error('Error loading item:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('product_items')
        .select(`
          *,
          product_groups:product_group(name, group_code),
          colors:color(name, color_code),
          sizes:size(name, size_code),
          vendors:vendor(name, vendor_code),
          purchase_orders:po_id(id, po_number, invoice_number, order_number)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setItems(data || []);
    } catch (err) {
      console.error('Error loading items:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter(item => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = (
      item.barcode_id?.toLowerCase().includes(searchLower) ||
      item.design_no?.toLowerCase().includes(searchLower) ||
      item.product_groups?.name?.toLowerCase().includes(searchLower)
    );

    const matchesSize = selectedSizeFilter === 'all' ||
      item.sizes?.id === selectedSizeFilter ||
      item.size === selectedSizeFilter;

    return matchesSearch && matchesSize;
  });

  const toggleItem = (barcodeId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(barcodeId)) {
      newSelected.delete(barcodeId);
    } else {
      newSelected.add(barcodeId);
    }
    setSelectedItems(newSelected);
  };

  const selectAll = () => {
    if (selectedItems.size === filteredItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredItems.map(item => item.barcode_id)));
    }
  };

  const saveAuditLog = async (printedItems: any[]) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data: userRecord } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', userData?.user?.id)
        .maybeSingle();

      const auditData: any = {
        items_printed: printedItems.map(item => ({
          barcode_id: item.barcode_id,
          design_no: item.design_no,
          product_group: item.product_groups?.name,
          color: item.colors?.name,
          size: item.sizes?.name,
          mrp: item.mrp,
        })),
        printed_by: userRecord?.id || null,
        printed_at: new Date().toISOString(),
      };

      if (poData) {
        auditData.po_id = poData.id;
        auditData.invoice_number = poData.invoice_number;
        auditData.order_number = poData.order_number;
      }

      const { error } = await supabase
        .from('barcode_print_logs')
        .insert([auditData]);

      if (error) throw error;
    } catch (err) {
      console.error('Error saving audit log:', err);
    }
  };

  const handlePrint = async () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const selectedItemsData = items.filter(item => selectedItems.has(item.barcode_id));

    await saveAuditLog(selectedItemsData);

    const sizeStyles = {
      small: { width: '50mm', height: '25mm', fontSize: '8px', padding: '2mm', barcodeWidth: 2, barcodeHeight: 40 },
      medium: { width: '70mm', height: '35mm', fontSize: '10px', padding: '3mm', barcodeWidth: 3, barcodeHeight: 60 },
      large: { width: '100mm', height: '50mm', fontSize: '12px', padding: '4mm', barcodeWidth: 3, barcodeHeight: 80 }
    };

    const size = sizeStyles[printSize];

    const barcodeHTML = selectedItemsData.map(item => {
      const orderInfo = item.order_number || item.purchase_orders?.order_number || '';
      const invoiceInfo = item.invoice_number || item.purchase_orders?.invoice_number || '';
      const referenceInfo = orderInfo ? `Ord: ${orderInfo}` : (invoiceInfo ? `Inv: ${invoiceInfo}` : '');

      const barcodeDataURL = generateBarcodeDataURL(item.barcode_id, {
        width: size.barcodeWidth,
        height: size.barcodeHeight,
        displayValue: false,
      });

      return `
      <div style="
        width: ${size.width};
        height: ${size.height};
        border: 1px solid #000;
        padding: ${size.padding};
        margin: 5mm;
        page-break-inside: avoid;
        display: inline-block;
        font-family: Arial, sans-serif;
      ">
        <div style="text-align: center; margin-bottom: 1mm;">
          <strong style="font-size: ${size.fontSize};">${item.product_groups?.name || ''}</strong>
        </div>
        <div style="text-align: center; font-size: calc(${size.fontSize} - 1px); margin-bottom: 1mm;">
          ${item.design_no} | ${item.colors?.name || ''} | ${item.sizes?.name || ''}
        </div>
        ${referenceInfo ? `
        <div style="text-align: center; font-size: calc(${size.fontSize} - 2px); color: #666; margin-bottom: 1mm;">
          ${referenceInfo}
        </div>
        ` : ''}
        <div style="text-align: center; margin: 2mm 0;">
          <img src="${barcodeDataURL}" style="max-width: 100%; height: auto;" alt="Barcode" />
        </div>
        <div style="text-align: center; font-family: 'Courier New', monospace; font-size: calc(${size.fontSize} - 1px); margin-bottom: 1mm;">
          ${item.barcode_id}
        </div>
        <div style="text-align: center; font-size: calc(${size.fontSize} + 2px); font-weight: bold;">
          MRP: ₹${parseFloat(item.mrp).toFixed(2)}
        </div>
      </div>
    `}).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Print Barcodes</title>
        <style>
          @page {
            margin: 10mm;
          }
          body {
            margin: 0;
            padding: 0;
          }
          @media print {
            body { -webkit-print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        ${barcodeHTML}
        <script>
          window.onload = function() {
            window.print();
            setTimeout(() => window.close(), 100);
          }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const downloadCSV = () => {
    const selectedItemsData = items.filter(item => selectedItems.has(item.barcode_id));

    const headers = ['Barcode ID', 'Product Group', 'Design No', 'Color', 'Size', 'MRP', 'Invoice No', 'Order No', 'Status'];
    const rows = selectedItemsData.map(item => [
      item.barcode_id,
      item.product_groups?.name || '',
      item.design_no,
      item.colors?.name || '',
      item.sizes?.name || '',
      item.mrp,
      item.invoice_number || item.purchase_orders?.invoice_number || '',
      item.order_number || item.purchase_orders?.order_number || '',
      item.status || 'New'
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `barcodes-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <BarcodeIcon className="w-8 h-8 text-blue-600 mr-3" />
            <h2 className="text-3xl font-bold text-gray-800">Barcode Management</h2>
          </div>
          <button
            onClick={loadItems}
            className="p-3 bg-gray-100 rounded-lg hover:bg-gray-200"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5 text-gray-700" />
          </button>
        </div>

        {poData && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">Purchase Invoice Details</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-blue-700">Invoice Number:</span>
                <span className="ml-2 font-medium">{poData.po_number}</span>
              </div>
              {poData.invoice_number && (
                <div>
                  <span className="text-blue-700">Invoice:</span>
                  <span className="ml-2 font-medium">{poData.invoice_number}</span>
                </div>
              )}
              {poData.order_number && (
                <div>
                  <span className="text-blue-700">Order:</span>
                  <span className="ml-2 font-medium">{poData.order_number}</span>
                </div>
              )}
              <div>
                <span className="text-blue-700">Vendor:</span>
                <span className="ml-2 font-medium">{poData.vendor.name}</span>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6 space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by barcode, design number, or product..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-700">Size:</span>
            <button
              onClick={() => setSelectedSizeFilter('all')}
              className={`px-3 py-1 rounded-full text-sm transition ${
                selectedSizeFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              All ({items.length})
            </button>
            {availableSizes.map((size) => {
              const count = items.filter(item =>
                item.sizes?.id === size.id || item.size === size.id
              ).length;
              return (
                <button
                  key={size.id}
                  onClick={() => setSelectedSizeFilter(size.id)}
                  className={`px-3 py-1 rounded-full text-sm transition ${
                    selectedSizeFilter === size.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {size.name} ({count})
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Print Size:</label>
            <div className="flex gap-2">
              {(['small', 'medium', 'large'] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => setPrintSize(size)}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    printSize === size
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {size.charAt(0).toUpperCase() + size.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {selectedItems.size > 0 && (
            <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-lg">
              <span className="text-blue-900 font-medium">
                {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected
              </span>
              <button
                onClick={handlePrint}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
              >
                <Printer className="w-5 h-5 mr-2" />
                Print Labels
              </button>
              <button
                onClick={downloadCSV}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center"
              >
                <Download className="w-5 h-5 mr-2" />
                Export CSV
              </button>
              <button
                onClick={() => setSelectedItems(new Set())}
                className="px-4 py-2 text-gray-700 hover:text-gray-900"
              >
                Clear Selection
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-4 text-left">
                    <input
                      type="checkbox"
                      checked={selectedItems.size === filteredItems.length && filteredItems.length > 0}
                      onChange={selectAll}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                  </th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-700">PREVIEW</th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-700">BARCODE ID</th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-700">PRODUCT</th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-700">DESIGN</th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-700">COLOR</th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-700">SIZE</th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-700">MRP</th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-700">INVOICE/ORDER</th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-700">STATUS</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-gray-500">
                      {searchTerm ? 'No items found matching your search.' : 'No items available.'}
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item, index) => {
                    const barcodeImageURL = generateBarcodeDataURL(item.barcode_id, {
                      width: 2,
                      height: 40,
                      displayValue: false,
                    });

                    return (
                      <tr key={`${item.barcode_id}-${index}`} className="border-b hover:bg-gray-50">
                        <td className="p-4">
                          <input
                            type="checkbox"
                            checked={selectedItems.has(item.barcode_id)}
                            onChange={() => toggleItem(item.barcode_id)}
                            className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td className="p-4">
                          <div className="bg-white p-2 rounded border border-gray-200 flex justify-center items-center" style={{ minHeight: '50px', maxWidth: '120px' }}>
                            {barcodeImageURL ? (
                              <img src={barcodeImageURL} alt="Barcode" className="max-w-full h-auto" />
                            ) : (
                              <span className="text-xs text-red-500">Error</span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 font-mono text-sm">{item.barcode_id}</td>
                        <td className="p-4 text-sm">{item.product_groups?.name || 'N/A'}</td>
                        <td className="p-4 text-sm">{item.design_no}</td>
                        <td className="p-4 text-sm">{item.colors?.name || 'N/A'}</td>
                        <td className="p-4 text-sm">{item.sizes?.name || 'N/A'}</td>
                        <td className="p-4 text-sm font-semibold">₹{parseFloat(item.mrp).toFixed(2)}</td>
                        <td className="p-4 text-xs text-gray-600">
                          {(() => {
                            const orderNo = item.order_number || item.purchase_orders?.order_number;
                            const invoiceNo = item.invoice_number || item.purchase_orders?.invoice_number;
                            if (orderNo) return <div>Ord: {orderNo}</div>;
                            if (invoiceNo) return <div>Inv: {invoiceNo}</div>;
                            return '-';
                          })()}
                        </td>
                        <td className="p-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            item.status === 'Available' ? 'bg-green-100 text-green-800' :
                            item.status === 'Sold' ? 'bg-gray-100 text-gray-800' :
                            item.status === 'Booked' ? 'bg-yellow-100 text-yellow-800' :
                            item.status ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {item.status || 'New'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
