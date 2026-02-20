import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { FileText, Plus, Trash2, Save, Upload, Printer, Edit2, Eye, X, Pencil } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { GSTType } from '../utils/gst';
import { GSTTransactionType } from '../utils/gstBreakdown';
import { encodeCostForVendor } from '../utils/costEncoding';
import { generateBarcodeDataURL } from '../utils/barcodeGenerator';

interface SizeQuantity {
  size: string;
  quantity: number;
  print_quantity?: number;
}

interface PurchaseItem {
  id?: string;
  design_no: string;
  product_group: string;
  floor_id?: string;
  color: string;
  sizes: SizeQuantity[];
  cost_per_item: number;
  mrp_markup_percent: number;
  mrp: number;
  gst_logic: GSTType;
  image_url: string;
  description: string;
  order_number: string;
  barcodes_per_item: number;
  payout_code?: string;
}

interface BarcodePreview {
  barcode_8digit: string;
  barcode_structured: string;
  design_no: string;
  product_group: string;
  color: string;
  size: string;
  quantity: number;
  print_quantity?: number;
  cost: number;
  mrp: number;
  order_number: string;
}

export default function PurchaseInvoice() {
  const [vendors, setVendors] = useState<any[]>([]);
  const [productGroups, setProductGroups] = useState<any[]>([]);
  const [colors, setColors] = useState<any[]>([]);
  const [sizes, setSizes] = useState<any[]>([]);
  const [floors, setFloors] = useState<any[]>([]);
  const [existingDesigns, setExistingDesigns] = useState<any[]>([]);

  const [selectedVendor, setSelectedVendor] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [vendorInvoiceNumber, setVendorInvoiceNumber] = useState('');
  const [vendorInvoiceDate, setVendorInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<PurchaseItem[]>([]);

  const [taxableValue, setTaxableValue] = useState('');
  const [calculatedGST, setCalculatedGST] = useState(0);
  const [manualGST, setManualGST] = useState('');
  const [gstDifferenceReason, setGstDifferenceReason] = useState('');
  const [gstType, setGstType] = useState<GSTTransactionType>('CGST_SGST');

  const [invoiceAttachment, setInvoiceAttachment] = useState('');
  const [invoiceFileName, setInvoiceFileName] = useState('');
  const [uploadingInvoice, setUploadingInvoice] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [savedPOId, setSavedPOId] = useState<string | null>(null);
  const [sourcePOId, setSourcePOId] = useState<string | null>(null);

  const [poNumberInput, setPoNumberInput] = useState('');
  const [poLoading, setPoLoading] = useState(false);
  const [vendorPOs, setVendorPOs] = useState<any[]>([]);

  const [showItemForm, setShowItemForm] = useState(false);
  const [itemMode, setItemMode] = useState<'new' | 'existing'>('existing');
  const [selectedDesignId, setSelectedDesignId] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const [showBarcodePreview, setShowBarcodePreview] = useState(false);
  const [barcodePreviewList, setBarcodePreviewList] = useState<BarcodePreview[]>([]);

  // List View State
  const [invoices, setInvoices] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [originalInvoiceQuantities, setOriginalInvoiceQuantities] = useState<Record<string, number>>({});
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [selectedInvoiceItems, setSelectedInvoiceItems] = useState<any[]>([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    setLoadingInvoices(true);
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('*, vendor:vendors(id, name, vendor_code)')
        .ilike('po_number', 'PI%')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (err) {
      console.error('Error loading invoices:', err);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const fetchInvoiceItems = async (poId: string) => {
    const { data, error } = await supabase
      .from('purchase_items')
      .select('*, product_group:product_groups(name), color:colors(name), size:sizes(name)')
      .eq('po_id', poId);
    
    if (error) {
      console.error('Error fetching invoice items:', error);
      return [];
    }
    return data || [];
  };

  const handlePreview = async (invoice: any) => {
    setSelectedInvoice(invoice);
    const items = await fetchInvoiceItems(invoice.id);
    setSelectedInvoiceItems(items);
    setIsPreviewOpen(true);
  };

  const handleEditInvoice = async (invoice: any) => {
    setError('');
    setSuccess('');
    setShowForm(true);
    setIsPreviewOpen(false);
    setCameraOpen(false);
    setEditingInvoiceId(invoice.id || null);
    setSavedPOId(null);

    const vendorId = invoice.vendor?.id || invoice.vendor || '';

    if (vendorId) {
      setSelectedVendor(vendorId);
    } else {
      setSelectedVendor('');
    }

    if (invoice.order_date) {
      setOrderDate(invoice.order_date);
    }

    if (invoice.invoice_number) {
      setVendorInvoiceNumber(invoice.invoice_number);
    } else {
      setVendorInvoiceNumber('');
    }

    if (invoice.notes) {
      setNotes(invoice.notes);
    } else {
      setNotes('');
    }

    if (invoice.taxable_value !== undefined && invoice.taxable_value !== null) {
      const taxable = typeof invoice.taxable_value === 'number'
        ? invoice.taxable_value
        : parseFloat(String(invoice.taxable_value)) || 0;
      setTaxableValue(taxable > 0 ? taxable.toFixed(2) : '');
    } else {
      setTaxableValue('');
    }

    if (invoice.manual_gst_amount !== undefined && invoice.manual_gst_amount !== null) {
      setManualGST(String(invoice.manual_gst_amount));
    } else {
      setManualGST('');
    }

    if (invoice.gst_type) {
      setGstType(invoice.gst_type as GSTTransactionType);
    }

    setInvoiceAttachment(invoice.vendor_invoice_attachment || '');
    setGstDifferenceReason(invoice.gst_difference_reason || '');

    try {
      const { data: dbItems, error } = await supabase
        .from('purchase_items')
        .select('*')
        .eq('po_id', invoice.id);

      if (error) {
        console.error('Error loading invoice items for edit:', error);
        setError('Failed to load invoice items for editing');
        return;
      }

      const quantities: Record<string, number> = {};
      const vendorForInvoice = vendorId || selectedVendor;

      const grouped: Record<string, PurchaseItem> = {};

      (dbItems || []).forEach((row: any) => {
        const groupKey = [
          row.design_no || '',
          row.product_group || '',
          row.color || '',
          row.cost_per_item || 0,
          row.mrp || 0,
          row.mrp_markup_percent || 0,
          row.gst_logic || '',
          row.description || '',
          row.order_number || '',
        ].join('__');

        let existing = grouped[groupKey];

        if (!existing) {
          const floorFromGroup = productGroups.find((g: any) => g.id === row.product_group);

          existing = {
            design_no: row.design_no,
            product_group: row.product_group,
            floor_id: floorFromGroup?.floor_id || '',
            color: row.color || '',
            sizes: [],
            cost_per_item: row.cost_per_item,
            mrp_markup_percent: row.mrp_markup_percent,
            mrp: row.mrp,
            gst_logic: row.gst_logic,
            image_url: '',
            description: row.description || '',
            order_number: row.order_number || '',
            barcodes_per_item: 1,
            payout_code: '',
          };

          grouped[groupKey] = existing;
        }

        existing.sizes.push({
          size: row.size,
          quantity: row.quantity,
          print_quantity: row.quantity,
        });

        if (vendorForInvoice) {
          const qtyKey = [
            vendorForInvoice || '',
            row.design_no || '',
            row.product_group || '',
            row.color || '',
            row.size || '',
          ].join('__');

          quantities[qtyKey] = (quantities[qtyKey] || 0) + (row.quantity || 0);
        }
      });

      const groupedItems = Object.values(grouped);

      if (!groupedItems.length) {
        setItems([]);
        setOriginalInvoiceQuantities({});
        return;
      }

      setItems(groupedItems);
      if (vendorForInvoice) {
        setOriginalInvoiceQuantities(quantities);
      } else {
        setOriginalInvoiceQuantities({});
      }
    } catch (err: any) {
      console.error('Error preparing invoice for edit:', err);
      setError(err.message || 'Failed to prepare invoice for editing');
    }
  };


  const [currentItem, setCurrentItem] = useState<any>({
    design_no: '',
    product_group: '',
    floor_id: '',
    color: '',
    barcodes_per_item: 1,
    sizes: [],
    cost_per_item: '',
    mrp_markup_percent: '',
    mrp: '',
    gst_logic: 'AUTO_5_18',
    image_url: '',
    description: '',
    order_number: '',
  });

  const [newItemSizes, setNewItemSizes] = useState<SizeQuantity[]>([]);
  const [, setUploadingImage] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const hiddenCameraInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadMasterData();
  }, []);

  useEffect(() => {
    if (selectedVendor) {
      loadExistingDesigns();
      loadVendorPOs();
    } else {
      setVendorPOs([]);
    }
  }, [selectedVendor]);

  useEffect(() => {
    if (sizes.length > 0) {
      setNewItemSizes(sizes.map(s => ({ 
        size: s.id, 
        quantity: 0, 
        print_quantity: 0 
      })));
    }
  }, [sizes]);

  useEffect(() => {
    if (currentItem.product_group) {
      const group = productGroups.find(g => g.id === currentItem.product_group);
      if (group) {
        setCurrentItem((prev: any) => ({ 
          ...prev, 
          floor_id: group.floor_id || prev.floor_id,
          hsn_code: group.hsn_code || prev.hsn_code || '' 
        }));
      }
      
      // Reset print qty when group changes (and maintain default barcodes_per_item)
      const barcodesPerItem = currentItem.barcodes_per_item || 1;
      setNewItemSizes(prev => prev.map(s => ({
        ...s,
        print_quantity: s.quantity * barcodesPerItem
      })));
    }
  }, [currentItem.product_group]);

  useEffect(() => {
    // When barcodes_per_item changes, update print_quantity for all sizes
    const barcodesPerItem = parseInt(currentItem.barcodes_per_item) || 1;
    setNewItemSizes(prev => prev.map(s => ({
      ...s,
      print_quantity: s.quantity * barcodesPerItem
    })));
  }, [currentItem.barcodes_per_item]);

  const getTotalQuantity = (item: PurchaseItem | Partial<PurchaseItem>): number => {
    return (item.sizes || []).reduce((sum, sq) => sum + sq.quantity, 0);
  };

  const calculateTotal = (): number => {
    return items.reduce((sum, item) => {
      const qty = getTotalQuantity(item);
      return sum + (item.cost_per_item * qty);
    }, 0);
  };

  useEffect(() => {
    const total = calculateTotal();
    const totalStr = total > 0 ? total.toFixed(2) : '';
    setTaxableValue(totalStr);
  }, [items]);

  useEffect(() => {
    if (taxableValue && parseFloat(taxableValue) > 0) {
      const gst = calculateGSTFromTaxable(parseFloat(taxableValue));
      setCalculatedGST(gst);
      if (!manualGST) {
        setManualGST(gst.toFixed(2));
      }
    } else {
      setCalculatedGST(0);
      if (!items.length) {
        setManualGST('');
      }
    }
  }, [taxableValue, items.length]);

  useEffect(() => {
    const cost = parseFloat(currentItem.cost_per_item) || 0;
    const markup = parseFloat(currentItem.mrp_markup_percent) || 0;

    if (cost && markup !== undefined) {
      const basePrice = cost * (1 + markup / 100);

      let gstMultiplier = 1.05;
      if (currentItem.gst_logic === 'AUTO_5_18') {
        const estimatedMRP = basePrice * 1.05;
        gstMultiplier = estimatedMRP < 2500 ? 1.05 : 1.18;
      }

      const calculatedMRP = basePrice * gstMultiplier;
      setCurrentItem({ ...currentItem, mrp: calculatedMRP.toFixed(2) });
    }
  }, [currentItem.cost_per_item, currentItem.mrp_markup_percent, currentItem.gst_logic]);

  const loadMasterData = async () => {
    try {
      const [vendorsRes, groupsRes, colorsRes, sizesRes, floorsRes] = await Promise.all([
        supabase.from('vendors').select('*').eq('active', true),
        supabase.from('product_groups').select('*, floors:floor_id(id, name, floor_code)'),
        supabase.from('colors').select('*'),
        supabase.from('sizes').select('*').order('sort_order'),
        supabase.from('floors').select('*').eq('active', true),
      ]);

      setVendors(vendorsRes.data || []);
      setProductGroups(groupsRes.data || []);
      setColors(colorsRes.data || []);
      setSizes(sizesRes.data || []);
      setFloors(floorsRes.data || []);
    } catch (err) {
      console.error('Error loading master data:', err);
    }
  };

  const loadExistingDesigns = async () => {
    if (!selectedVendor) {
      setExistingDesigns([]);
      return;
    }

    try {
      // Fetch from product_masters instead of barcode_batches
      const { data, error } = await supabase
        .from('product_masters')
        .select(`
          id,
          design_no,
          product_group:product_groups(id, name, group_code),
          color:colors(id, name, color_code),
          vendor:vendors(id, name, vendor_code),
          gst_logic,
          photos,
          description,
          mrp,
          floor,
          barcodes_per_item,
          payout_code,
          hsn_code
        `)
        .eq('vendor', selectedVendor);

      if (error) throw error;

      // product_masters should be unique by definition, but we can map it directly
      const designs = (data || []).map((row: any) => ({
        id: row.id,
        design_no: row.design_no,
        product_group: row.product_group,
        color: row.color,
        vendor: row.vendor,
        gst_logic: row.gst_logic,
        photos: row.photos || [],
        description: row.description || '',
        mrp: row.mrp,
        floor: row.floor,
        barcodes_per_item: row.barcodes_per_item || 1,
        payout_code: row.payout_code || '',
        hsn_code: row.hsn_code || '',
      }));

      setExistingDesigns(designs);
    } catch (err) {
      console.error('Error loading existing designs:', err);
    }
  };

  const loadVendorPOs = async () => {
    if (!selectedVendor) {
      setVendorPOs([]);
      return;
    }

    try {
      const { data } = await supabase
        .from('purchase_orders')
        .select('id, po_number, order_date, status, total_items, total_amount')
        .eq('vendor', selectedVendor)
        .neq('status', 'Cancelled')
        .neq('status', 'Completed')
        .order('order_date', { ascending: false });

      setVendorPOs(data || []);
    } catch (err) {
      console.error('Error loading vendor purchase orders:', err);
    }
  };

  const calculateGSTFromTaxable = (taxableAmount: number): number => {
    let totalGST = 0;
    items.forEach(item => {
      const itemTotal = item.cost_per_item * getTotalQuantity(item);
      const itemTaxable = (itemTotal / taxableAmount) * taxableAmount;

      if (item.gst_logic === 'AUTO_5_18') {
        const gstRate = item.mrp < 2500 ? 5 : 18;
        totalGST += (itemTaxable * gstRate) / 100;
      } else if (item.gst_logic === 'FLAT_5') {
        totalGST += (itemTaxable * 5) / 100;
      }
    });
    return totalGST;
  };

  const computeQuantitiesFromItems = (
    vendorId: string,
    itemsList: PurchaseItem[],
  ): Record<string, number> => {
    const map: Record<string, number> = {};

    itemsList.forEach(item => {
      (item.sizes || []).forEach(sq => {
        const key = [
          vendorId || '',
          item.design_no || '',
          item.product_group || '',
          item.color || '',
          sq.size || '',
        ].join('__');

        map[key] = (map[key] || 0) + (sq.quantity || 0);
      });
    });

    return map;
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    setUploadingImage(true);
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCurrentItem({ ...currentItem, image_url: reader.result as string });
        setUploadingImage(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError('Failed to upload image');
      setUploadingImage(false);
    }
  };

  const openCamera = async () => {
    setCameraError('');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      hiddenCameraInputRef.current?.click();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
    } catch (err) {
      console.error('Error accessing camera:', err);
      hiddenCameraInputRef.current?.click();
    }
  };

  const closeCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setCurrentItem((prev: any) => ({ ...prev, image_url: dataUrl }));
    }
    closeCamera();
  };

  const clearImage = () => {
    setCurrentItem((prev: any) => ({ ...prev, image_url: '' }));
    if (hiddenCameraInputRef.current) {
      hiddenCameraInputRef.current.value = '';
    }
  };

  useEffect(() => {
    if (cameraOpen && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      const playPromise = videoRef.current.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise.catch(() => {});
      }
    }
  }, [cameraOpen]);

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  if (!showForm) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center">
              <FileText className="w-8 h-8 text-emerald-600 mr-3" />
              <h2 className="text-3xl font-bold text-gray-800">Purchase Invoices</h2>
            </div>
            <Button
              onClick={() => setShowForm(true)}
              className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center shadow-lg"
            >
              <Plus className="w-5 h-5 mr-2" />
              New Invoice
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-4 text-left text-sm font-semibold text-gray-700">Invoice #</th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-700">Vendor</th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-700">Date</th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-700">Vendor Inv #</th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-700">Total Items</th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-700">Amount</th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-700">Status</th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingInvoices ? (
                   <tr><td colSpan={8} className="p-8 text-center text-gray-500">Loading invoices...</td></tr>
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-gray-500">
                      No invoices found. Click "New Invoice" to create one.
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <tr key={inv.id} className="border-b hover:bg-gray-50">
                      <td className="p-4 text-sm font-semibold text-emerald-600">{inv.po_number}</td>
                      <td className="p-4 text-sm text-gray-700">
                        {inv.vendor?.name}
                        <div className="text-xs text-gray-500">{inv.vendor?.vendor_code}</div>
                      </td>
                      <td className="p-4 text-sm text-gray-700">{new Date(inv.order_date).toLocaleDateString()}</td>
                      <td className="p-4 text-sm text-gray-700">{inv.invoice_number}</td>
                      <td className="p-4 text-sm text-gray-700">{inv.total_items}</td>
                      <td className="p-4 text-sm font-semibold text-gray-700">₹{(inv.total_amount || 0).toFixed(2)}</td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          inv.status === 'Completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEditInvoice(inv)}
                            className="p-1 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded"
                            title="Edit Invoice"
                          >
                            <Pencil className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handlePreview(inv)}
                            className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                            title="Preview"
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {isPreviewOpen && selectedInvoice && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b flex justify-between items-center sticky top-0 bg-white z-10">
                <h3 className="text-xl font-bold text-gray-800">
                  Invoice Details - {selectedInvoice.po_number}
                </h3>
                <button
                  onClick={() => setIsPreviewOpen(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Vendor Details</h4>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="font-bold text-lg text-gray-800">{selectedInvoice.vendor?.name}</p>
                      <p className="text-gray-600">Code: {selectedInvoice.vendor?.vendor_code}</p>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Invoice Info</h4>
                    <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Order Date:</span>
                        <span className="font-medium">{new Date(selectedInvoice.order_date).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Vendor Inv #:</span>
                        <span className="font-medium">{selectedInvoice.invoice_number}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Status:</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${selectedInvoice.status === 'Completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                          {selectedInvoice.status}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Amount:</span>
                        <span className="font-bold text-emerald-600">₹{(selectedInvoice.total_amount || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {selectedInvoice.notes && (
                  <div className="mb-8">
                    <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Notes</h4>
                    <div className="bg-yellow-50 p-4 rounded-lg text-gray-700 border border-yellow-100">
                      {selectedInvoice.notes}
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Invoice Items</h4>
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">Design</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">Details</th>
                          <th className="px-4 py-3 text-right font-semibold text-gray-700">Qty</th>
                          <th className="px-4 py-3 text-right font-semibold text-gray-700">Cost</th>
                          <th className="px-4 py-3 text-right font-semibold text-gray-700">MRP</th>
                          <th className="px-4 py-3 text-right font-semibold text-gray-700">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {selectedInvoiceItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium">{item.design_no}</td>
                            <td className="px-4 py-3 text-xs">
                              <div className="font-semibold">{item.product_group?.name}</div>
                              <div className="text-gray-600">{item.color?.name} - {item.size?.name}</div>
                              {item.description && <div className="text-gray-500 italic mt-0.5">{item.description}</div>}
                            </td>
                            <td className="px-4 py-3 text-right font-medium">{item.quantity}</td>
                            <td className="px-4 py-3 text-right">₹{item.cost_per_item}</td>
                            <td className="px-4 py-3 text-right">₹{item.mrp}</td>
                            <td className="px-4 py-3 text-right font-bold text-gray-800">₹{(item.cost_per_item * item.quantity).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50 border-t">
                        <tr>
                          <td colSpan={2} className="px-4 py-3 text-right font-bold text-gray-700">Grand Total:</td>
                          <td className="px-4 py-3 text-right font-bold text-gray-800">{selectedInvoiceItems.reduce((sum, item) => sum + item.quantity, 0)}</td>
                          <td colSpan={2}></td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-600">
                             ₹{selectedInvoiceItems.reduce((sum, item) => sum + (item.cost_per_item * item.quantity), 0).toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t bg-gray-50 flex justify-end">
                <button
                  onClick={() => setIsPreviewOpen(false)}
                  className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const handleInvoiceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingInvoice(true);
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        setInvoiceAttachment(reader.result as string);
        setInvoiceFileName(file.name);
        setUploadingInvoice(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError('Failed to upload invoice');
      setUploadingInvoice(false);
    }
  };

  const handleExistingDesignSelect = (designId: string) => {
    const design = existingDesigns.find(d => d.id === designId);
    if (design) {
      setCurrentItem({
        design_no: design.design_no,
        product_group: design.product_group?.id || '',
        floor_id: design.floor || '',
        color: design.color?.id || '',
        sizes: [],
        cost_per_item: '',
        mrp_markup_percent: '',
        mrp: '',
        gst_logic: design.gst_logic,
        barcodes_per_item: design.barcodes_per_item || 1,
        image_url: design.photos?.[0] || '',
        description: design.description || '',
        order_number: '',
        hsn_code: design.hsn_code || '',
      });
    }
  };



  const editItem = (index: number) => {
    const item = items[index];
    setCurrentItem(item);
    setNewItemSizes(item.sizes);
    setEditingIndex(index);
    setShowItemForm(true);

    const design = existingDesigns.find(d => d.design_no === item.design_no);
    if (design) {
      setSelectedDesignId(design.id);
      setItemMode('existing');
    } else {
      setItemMode('new');
    }
  };

  const addItemToList = () => {
    if (!currentItem.design_no || !currentItem.product_group) {
      setError('Please fill all required fields except color');
      return;
    }
    if (!currentItem.image_url) {
      setError('Please add a product image for this item');
      return;
    }

    const cost = parseFloat(currentItem.cost_per_item) || 0;
    const mrp = parseFloat(currentItem.mrp) || 0;
    const markup = parseFloat(currentItem.mrp_markup_percent) || 0;

    if (!cost || cost <= 0) {
      setError('Please enter a valid cost per item');
      return;
    }

    if (!mrp || mrp <= 0) {
      setError('Please enter a valid MRP');
      return;
    }

    const sizesWithQty = newItemSizes.filter(s => s.quantity > 0);
    if (sizesWithQty.length === 0) {
      setError('Please add at least one size with quantity');
      return;
    }

    const barcodesPerItem = parseInt(currentItem.barcodes_per_item) || 1;

    const sizesWithPrintQty = sizesWithQty.map(s => ({
      ...s,
      print_quantity: s.quantity * barcodesPerItem
    }));

    const newItem = {
      ...currentItem,
      cost_per_item: cost,
      mrp: mrp,
      mrp_markup_percent: markup,
      barcodes_per_item: barcodesPerItem,
      sizes: sizesWithPrintQty,
    } as PurchaseItem;

    if (editingIndex !== null) {
      const updatedItems = [...items];
      updatedItems[editingIndex] = newItem;
      setItems(updatedItems);
      setEditingIndex(null);
    } else {
      setItems([...items, newItem]);
    }

    setCurrentItem({
      design_no: '',
      product_group: '',
      floor_id: '',
      color: '',
      barcodes_per_item: 1,
      sizes: [],
      cost_per_item: 0,
      mrp_markup_percent: 100,
      mrp: 0,
      gst_logic: 'AUTO_5_18',
      image_url: '',
      description: '',
      order_number: '',
      payout_code: '',
    });
    setSelectedDesignId('');
    setNewItemSizes(sizes.map(s => ({ size: s.id, quantity: 0, print_quantity: 0 })));
    setShowItemForm(false);
    setError('');
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const generateBarcodePreview = async () => {
    if (!selectedVendor || items.length === 0) {
      setError('Please add items before previewing barcodes');
      return;
    }

    try {
      const previews: BarcodePreview[] = [];
      const vendor = vendors.find(v => v.id === selectedVendor);
      const vendorCode = vendor?.vendor_code || 'VND';

      let previewCounter = 1;

      for (const item of items) {
        for (const sizeQty of item.sizes) {
          if (sizeQty.quantity <= 0) continue;

          const productGroup = productGroups.find(g => g.id === item.product_group);
          const color = colors.find(c => c.id === item.color);
          const size = sizes.find(s => s.id === sizeQty.size);

          const mockBarcodeNumber = String(previewCounter).padStart(8, '0');
          previewCounter++;

          const groupCode = productGroup?.group_code || 'PG';
          const colorCode = color?.color_code || '';
          const designPart = colorCode ? `${item.design_no}${colorCode}` : item.design_no;
          const encodedPrice = encodeCostForVendor(item.mrp, 'CRAZY WOMEN');
          const parts = [
            groupCode,
            designPart,
            vendorCode,
            encodedPrice,
            mockBarcodeNumber,
          ].filter(Boolean);
          const structuredBarcode = parts.join('-');

          previews.push({
            barcode_8digit: mockBarcodeNumber,
            barcode_structured: structuredBarcode,
            design_no: item.design_no,
            product_group: productGroup?.name || '',
            color: color?.name || '',
            size: size?.name || '',
            quantity: sizeQty.quantity,
            print_quantity: sizeQty.print_quantity ?? sizeQty.quantity,
            cost: item.cost_per_item,
            mrp: item.mrp,
            order_number: item.order_number || '',
          });
        }
      }

      setBarcodePreviewList(previews);
      setShowBarcodePreview(true);
      setError('');
    } catch (err: any) {
      console.error('Error generating preview:', err);
      setError('Failed to generate barcode preview: ' + err.message);
    }
  };

  const savePurchaseOrder = async () => {
    if (!selectedVendor) {
      setError('Please select a vendor');
      return;
    }

    if (items.length === 0) {
      setError('Please add at least one item');
      return;
    }

    if (!vendorInvoiceNumber) {
      setError('Please enter vendor invoice number');
      return;
    }

    if (!taxableValue) {
      setError('Please enter taxable value');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data: userRecord } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', userData?.user?.id)
        .maybeSingle();

      const { count } = await supabase
        .from('purchase_orders')
        .select('*', { count: 'exact', head: true });

      const poNumber = `PI${new Date().getFullYear()}${String((count || 0) + 1).padStart(6, '0')}`;

      const totalAmount = calculateTotal();
      const totalItems = items.reduce((sum, item) => sum + getTotalQuantity(item), 0);
      const finalGST = parseFloat(manualGST || '0');

      const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .insert([{
          po_number: poNumber,
          vendor: selectedVendor,
          order_date: orderDate,
          invoice_number: vendorInvoiceNumber,
          total_items: totalItems,
          total_amount: totalAmount + finalGST,
          status: 'Pending',
          notes: notes,
          taxable_value: parseFloat(taxableValue),
          manual_gst_amount: finalGST !== calculatedGST ? finalGST : null,
          vendor_invoice_attachment: invoiceAttachment || null,
          gst_difference_reason: finalGST !== calculatedGST ? gstDifferenceReason : null,
          gst_type: gstType,
          created_by: userRecord?.id || null,
        }])
        .select()
        .single();

      if (poError) throw poError;

      const vendor = vendors.find(v => v.id === selectedVendor);
      const vendorCode = vendor?.vendor_code || 'VND';

      for (const item of items) {
        for (const sizeQty of item.sizes) {
          if (sizeQty.quantity <= 0) continue;

          const { error: itemError } = await supabase
            .from('purchase_items')
            .insert([{
              po_id: po.id,
              design_no: item.design_no,
              product_group: item.product_group,
              color: item.color && item.color !== "" ? item.color : null,
              size: sizeQty.size,
              quantity: sizeQty.quantity,
              cost_per_item: item.cost_per_item,
              mrp: item.mrp,
              mrp_markup_percent: item.mrp_markup_percent,
              gst_logic: item.gst_logic,
              description: item.description,
              order_number: item.order_number || null,
            }]);

          if (itemError) throw itemError;

          const productGroup = productGroups.find(g => g.id === item.product_group);
          const color = colors.find(c => c.id === item.color);
          const floorId = productGroup?.floor_id;

          let query = supabase
            .from('barcode_batches')
            .select('*')
            .eq('design_no', item.design_no)
            .eq('product_group', item.product_group)
            .eq('size', sizeQty.size)
            .eq('vendor', selectedVendor)
            .eq('status', 'active');
            
            if (item.color) {
              query.eq('color', item.color);
            } else {
              query.is('color', null);
            }
            
          const { data: existingBatch } = await query
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (existingBatch) {
            await supabase
              .from('barcode_batches')
              .update({
                total_quantity: existingBatch.total_quantity + sizeQty.quantity,
                available_quantity: existingBatch.available_quantity + sizeQty.quantity,
                floor: (item.floor_id && item.floor_id !== "") ? item.floor_id : (floorId || existingBatch.floor || null),
                print_quantity: sizeQty.print_quantity ?? sizeQty.quantity,
                cost_actual: item.cost_per_item,
                mrp: item.mrp,
                mrp_markup_percent: item.mrp_markup_percent,
                gst_logic: item.gst_logic,
            po_id: po.id,
                modified_by: userRecord?.id || null,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingBatch.id);
          } else {
            const { data: barcodeNumber } = await supabase.rpc('get_next_barcode_number');
            const barcodeString = String(barcodeNumber).padStart(8, '0');

            const groupCode = productGroup?.group_code || 'PG';
            const colorCode = color?.color_code || '';
            const designPart = colorCode ? `${item.design_no}${colorCode}` : item.design_no;
            const encodedPrice = encodeCostForVendor(item.mrp, 'CRAZY WOMEN');
            const parts = [
              groupCode,
              designPart,
              vendorCode,
              encodedPrice,
              barcodeString,
            ].filter(Boolean);
            const structuredBarcode = parts.join('-');

            await supabase
              .from('barcode_batches')
              .insert([{
                barcode_alias_8digit: barcodeString,
                barcode_structured: structuredBarcode,
                design_no: item.design_no,
                product_group: item.product_group,
                size: sizeQty.size,
                color: item.color && item.color !== "" ? item.color : null,
                vendor: selectedVendor,
                cost_actual: item.cost_per_item,
                mrp: item.mrp,
                mrp_markup_percent: item.mrp_markup_percent,
                gst_logic: item.gst_logic,
                total_quantity: sizeQty.quantity,
                available_quantity: sizeQty.quantity,
                floor: (item.floor_id && item.floor_id !== "") ? item.floor_id : (floorId || null),
                print_quantity: sizeQty.print_quantity ?? sizeQty.quantity,
                status: 'active',
                po_id: po.id,
                photos: item.image_url ? [item.image_url] : [],
                description: item.description,
                order_number: item.order_number || null,
                created_by: userRecord?.id || null,
                payout_code: item.payout_code || null,
              }]);
          }
        }
      }

      await supabase
        .from('purchase_orders')
        .update({ status: 'Completed' })
        .eq('id', po.id);

      if (sourcePOId && sourcePOId !== po.id) {
        const { data: basePO } = await supabase
          .from('purchase_orders')
          .select('id, po_number')
          .eq('id', sourcePOId)
          .maybeSingle();

        if (basePO) {
          const { data: poItems } = await supabase
            .from('purchase_order_items')
            .select('quantity, product_description')
            .eq('purchase_order_id', sourcePOId);

          let totalOrdered = 0;

          (poItems || []).forEach((row: any) => {
            let rowQty = row.quantity || 0;

            if (row.product_description) {
              const parts = String(row.product_description)
                .split('|')
                .map((p: string) => p.trim())
                .filter(Boolean);

              const sizesPart = parts.find((p: string) => p.startsWith('Sizes'));
              if (sizesPart) {
                const raw = sizesPart.replace(/^.*Sizes\s*/i, '').trim();
                const tokens = raw.split(',');

                let parsedTotal = 0;
                tokens.forEach((token: string) => {
                  const [namePart, qtyPart] = token.split(':');
                  if (!namePart || !qtyPart) return;
                  const qty = parseInt(qtyPart.trim(), 10);
                  if (!qty || qty <= 0) return;
                  parsedTotal += qty;
                });

                if (parsedTotal > 0) {
                  rowQty = parsedTotal;
                }
              }
            }

            totalOrdered += rowQty;
          });

          const { data: receivedItems } = await supabase
            .from('purchase_items')
            .select('quantity')
            .eq('order_number', basePO.po_number);

          const totalReceived = (receivedItems || []).reduce(
            (sum: number, row: any) => sum + (row.quantity || 0),
            0
          );

          let newStatus = 'Draft';
          if (totalOrdered > 0) {
            if (totalReceived >= totalOrdered) {
              newStatus = 'Completed';
            } else if (totalReceived > 0) {
              newStatus = 'Partial';
            }
          }

          await supabase
            .from('purchase_orders')
            .update({
              status: newStatus,
              invoice_number: vendorInvoiceNumber || po.po_number,
            })
            .eq('id', sourcePOId);
        }
      }

      setSuccess(`Purchase Invoice ${poNumber} created successfully! ${totalItems} items added to inventory.`);
      setSavedPOId(po.id);

      setItems([]);
      setTaxableValue('');
      setManualGST('');
      setVendorInvoiceNumber('');
      setInvoiceAttachment('');

      setTimeout(() => setSuccess(''), 5000);
    } catch (err: any) {
      console.error('Error saving purchase invoice:', err);
      setError(err.message || 'Failed to create purchase invoice');
    } finally {
      setLoading(false);
    }
  };

  const updatePurchaseOrder = async () => {
    if (!editingInvoiceId) {
      return;
    }

    if (!selectedVendor) {
      setError('Please select a vendor');
      return;
    }

    if (items.length === 0) {
      setError('Please add at least one item');
      return;
    }

    if (!vendorInvoiceNumber) {
      setError('Please enter vendor invoice number');
      return;
    }

    if (!taxableValue) {
      setError('Please enter taxable value');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data: userRecord } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', userData?.user?.id)
        .maybeSingle();

      const { data: currentPO, error: poFetchError } = await supabase
        .from('purchase_orders')
        .select('id, po_number, vendor')
        .eq('id', editingInvoiceId)
        .maybeSingle();

      if (poFetchError) throw poFetchError;
      if (!currentPO) {
        throw new Error('Purchase invoice not found');
      }

      const totalAmount = calculateTotal();
      const totalItems = items.reduce((sum, item) => sum + getTotalQuantity(item), 0);
      const finalGST = parseFloat(manualGST || '0');

      const { error: poUpdateError } = await supabase
        .from('purchase_orders')
        .update({
          vendor: selectedVendor,
          order_date: orderDate,
          invoice_number: vendorInvoiceNumber,
          total_items: totalItems,
          total_amount: totalAmount + finalGST,
          status: 'Completed',
          notes: notes,
          taxable_value: parseFloat(taxableValue),
          manual_gst_amount: finalGST !== calculatedGST ? finalGST : null,
          vendor_invoice_attachment: invoiceAttachment || null,
          gst_difference_reason: finalGST !== calculatedGST ? gstDifferenceReason : null,
          gst_type: gstType,
          modified_by: userRecord?.id || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingInvoiceId);

      if (poUpdateError) throw poUpdateError;

      let originalMap = originalInvoiceQuantities;
      const originalVendorId = currentPO.vendor || selectedVendor;

      if (!originalMap || Object.keys(originalMap).length === 0) {
        const { data: existingItems, error: itemsError } = await supabase
          .from('purchase_items')
          .select('design_no, product_group, color, size, quantity')
          .eq('po_id', editingInvoiceId);

        if (itemsError) throw itemsError;

        const map: Record<string, number> = {};

        (existingItems || []).forEach(row => {
          const key = [
            originalVendorId || '',
            row.design_no || '',
            row.product_group || '',
            row.color || '',
            row.size || '',
          ].join('__');

          map[key] = (map[key] || 0) + (row.quantity || 0);
        });

        originalMap = map;
      }

      const newMap = computeQuantitiesFromItems(selectedVendor, items);
      const allKeys = new Set([...Object.keys(originalMap), ...Object.keys(newMap)]);

      for (const key of allKeys) {
        const parts = key.split('__');
        const vendorId = parts[0];
        const designNo = parts[1];
        const productGroupId = parts[2];
        const colorId = parts[3] || '';
        const sizeId = parts[4];

        const oldQty = originalMap[key] || 0;
        const newQty = newMap[key] || 0;
        const delta = newQty - oldQty;

        if (!delta) continue;

        let query = supabase
          .from('barcode_batches')
          .select('id, total_quantity, available_quantity, floor, photos, payout_code')
          .eq('design_no', designNo)
          .eq('product_group', productGroupId)
          .eq('size', sizeId)
          .eq('vendor', vendorId)
          .eq('status', 'active');

        if (colorId) {
          query = query.eq('color', colorId);
        } else {
          query = query.is('color', null);
        }

        const { data: existingBatch, error: batchError } = await query
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (batchError) throw batchError;

        const itemForCombo = items.find(it => {
          if (it.design_no !== designNo) return false;
          if (it.product_group !== productGroupId) return false;
          if ((it.color || '') !== (colorId || '')) return false;
          return (it.sizes || []).some(sq => sq.size === sizeId);
        });

        if (existingBatch) {
          const updatedTotal = Math.max(0, (existingBatch.total_quantity || 0) + delta);
          const updatedAvailable = Math.max(0, (existingBatch.available_quantity || 0) + delta);

          const updatePayload: any = {
            total_quantity: updatedTotal,
            available_quantity: updatedAvailable,
            updated_at: new Date().toISOString(),
            modified_by: userRecord?.id || null,
          };

          if (itemForCombo) {
            updatePayload.cost_actual = itemForCombo.cost_per_item;
            updatePayload.mrp = itemForCombo.mrp;
            updatePayload.mrp_markup_percent = itemForCombo.mrp_markup_percent;
            updatePayload.gst_logic = itemForCombo.gst_logic;
            updatePayload.floor =
              (itemForCombo.floor_id && itemForCombo.floor_id !== '')
                ? itemForCombo.floor_id
                : existingBatch.floor || null;
            updatePayload.po_id = editingInvoiceId;
            updatePayload.description = itemForCombo.description;
            updatePayload.order_number = itemForCombo.order_number || null;
            updatePayload.photos = itemForCombo.image_url
              ? [itemForCombo.image_url]
              : existingBatch.photos || [];
            updatePayload.payout_code = itemForCombo.payout_code || existingBatch.payout_code || null;
          }

          const { error: updateBatchError } = await supabase
            .from('barcode_batches')
            .update(updatePayload)
            .eq('id', existingBatch.id);

          if (updateBatchError) throw updateBatchError;
        } else if (delta > 0 && itemForCombo) {
          const productGroup = productGroups.find(pg => pg.id === itemForCombo.product_group);
          const color = colors.find(c => c.id === itemForCombo.color);
          const vendorRow = vendors.find(v => v.id === vendorId);

          const { data: barcodeNumber } = await supabase.rpc('get_next_barcode_number');
          const barcodeString = String(barcodeNumber).padStart(8, '0');

          const groupCode = productGroup?.group_code || 'PG';
          const colorCode = color?.color_code || '';
          const designPart = colorCode ? `${designNo}${colorCode}` : designNo;
          const encodedPrice = encodeCostForVendor(itemForCombo.mrp, 'CRAZY WOMEN');
          const structuredParts = [
            groupCode,
            designPart,
            vendorRow?.vendor_code || 'VND',
            encodedPrice,
            barcodeString,
          ].filter(Boolean);
          const structuredBarcode = structuredParts.join('-');

          const floorId =
            (itemForCombo.floor_id && itemForCombo.floor_id !== '')
              ? itemForCombo.floor_id
              : productGroup?.floor_id || null;

          const qtyForSize =
            (itemForCombo.sizes || []).find(sq => sq.size === sizeId)?.print_quantity ?? delta;

          const { error: insertBatchError } = await supabase
            .from('barcode_batches')
            .insert([{
              barcode_alias_8digit: barcodeString,
              barcode_structured: structuredBarcode,
              design_no: designNo,
              product_group: productGroupId,
              size: sizeId,
              color: colorId && colorId !== '' ? colorId : null,
              vendor: vendorId,
              cost_actual: itemForCombo.cost_per_item,
              mrp: itemForCombo.mrp,
              mrp_markup_percent: itemForCombo.mrp_markup_percent,
              gst_logic: itemForCombo.gst_logic,
              total_quantity: delta,
              available_quantity: delta,
              floor: floorId,
              print_quantity: qtyForSize,
              status: 'active',
              po_id: editingInvoiceId,
              photos: itemForCombo.image_url ? [itemForCombo.image_url] : [],
              description: itemForCombo.description,
              order_number: itemForCombo.order_number || null,
              created_by: userRecord?.id || null,
              payout_code: itemForCombo.payout_code || null,
            }]);

          if (insertBatchError) throw insertBatchError;
        }
      }

      await supabase
        .from('purchase_items')
        .delete()
        .eq('po_id', editingInvoiceId);

      for (const item of items) {
        for (const sizeQty of item.sizes) {
          if (sizeQty.quantity <= 0) continue;

          const { error: itemError } = await supabase
            .from('purchase_items')
            .insert([{
              po_id: editingInvoiceId,
              design_no: item.design_no,
              product_group: item.product_group,
              color: item.color && item.color !== "" ? item.color : null,
              size: sizeQty.size,
              quantity: sizeQty.quantity,
              cost_per_item: item.cost_per_item,
              mrp: item.mrp,
              mrp_markup_percent: item.mrp_markup_percent,
              gst_logic: item.gst_logic,
              description: item.description,
              order_number: item.order_number || null,
            }]);

          if (itemError) throw itemError;
        }
      }

      setSuccess(`Purchase Invoice ${currentPO.po_number} updated successfully and inventory adjusted.`);
      setSavedPOId(editingInvoiceId);
      setEditingInvoiceId(null);
      setOriginalInvoiceQuantities({});
      setShowForm(false);
      await loadInvoices();
    } catch (err: any) {
      console.error('Error updating purchase invoice:', err);
      setError(err.message || 'Failed to update purchase invoice');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadPurchaseOrder = async () => {
    if (!poNumberInput.trim()) {
      return;
    }

    setPoLoading(true);
    setError('');
    setSuccess('');

    try {
      const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .select('id, po_number, vendor, order_date, notes, invoice_number')
        .eq('po_number', poNumberInput.trim())
        .maybeSingle();

      if (poError) throw poError;

      if (!po) {
        setError('Purchase Order not found');
        return;
      }

      setSourcePOId(po.id);

      if (po.vendor) {
        setSelectedVendor(po.vendor);
      }
      if (po.order_date) {
        setOrderDate(po.order_date);
      }
      if (po.invoice_number && !vendorInvoiceNumber) {
        setVendorInvoiceNumber(po.invoice_number);
      }
      if (po.notes && !notes) {
        setNotes(po.notes);
      }

      const { data: poItems, error: itemsError } = await supabase
        .from('purchase_order_items')
        .select('id, design_no, product_description, quantity, rate')
        .eq('purchase_order_id', po.id);

      if (itemsError) throw itemsError;

      if (!poItems || poItems.length === 0) {
        setError('This purchase order has no items');
        return;
      }

      const designNos = Array.from(new Set(poItems.map(i => i.design_no).filter(Boolean)));
      let designMap: Record<string, any> = {};

      if (designNos.length > 0 && po.vendor) {
        const { data: designs, error: designsError } = await supabase
          .from('product_masters')
          .select(`
            id,
            design_no,
            product_group:product_groups(id, name, group_code),
            color:colors(id, name, color_code),
            vendor:vendors(id, name, vendor_code),
            gst_logic,
            photos,
            description,
            mrp,
            floor,
            barcodes_per_item,
            payout_code
          `)
          .eq('vendor', po.vendor)
          .in('design_no', designNos);

        if (designsError) throw designsError;

        (designs || []).forEach((row: any) => {
          designMap[row.design_no] = {
            id: row.id,
            design_no: row.design_no,
            product_group: row.product_group,
            color: row.color,
            gst_logic: row.gst_logic,
            photos: row.photos || [],
            description: row.description || '',
            mrp: row.mrp || 0,
            floor: row.floor || '',
            barcodes_per_item: row.barcodes_per_item || 1,
            payout_code: row.payout_code || '',
          };
        });
      }

      const { data: existingReceived } = await supabase
        .from('purchase_items')
        .select('design_no, size, quantity')
        .eq('order_number', po.po_number);

      const receivedMap: Record<string, number> = {};
      (existingReceived || []).forEach((row: any) => {
        const key = `${row.design_no || ''}__${row.size || ''}`;
        receivedMap[key] = (receivedMap[key] || 0) + (row.quantity || 0);
      });

      const invoiceItems: PurchaseItem[] = poItems.map((poItem: any) => {
        const d = designMap[poItem.design_no] || null;

        const descriptionStr = String(poItem.product_description || '');
        const parts = descriptionStr
          .split('|')
          .map((p: string) => p.trim())
          .filter(Boolean);

        let fallbackProductGroupId = '';
        if (!d && parts.length > 0 && productGroups.length > 0) {
          const groupName = parts[0];
          const matchedGroup = productGroups.find((pg: any) => pg.name === groupName);
          if (matchedGroup) {
            fallbackProductGroupId = matchedGroup.id;
          }
        }

        let fallbackColorId = '';
        if (colors.length > 0 && parts.length > 1) {
          const colorName = parts[1];
          const matchedColor = colors.find((c: any) => c.name === colorName);
          if (matchedColor) {
            fallbackColorId = matchedColor.id;
          }
        }

        let sizeEntries: SizeQuantity[] = sizes.map((s: any) => ({
          size: s.id,
          quantity: 0,
          print_quantity: 0,
        }));

        if (parts.length > 0) {
          const sizesPart = parts.find((p: string) => p.startsWith('Sizes'));

          if (sizesPart) {
            const raw = sizesPart.replace(/^.*Sizes\s*/i, '').trim();
            const tokens = raw.split(',');

            tokens.forEach((token: string) => {
              const [namePart, qtyPart] = token.split(':');
              if (!namePart || !qtyPart) return;

              const sizeName = namePart.trim();
              const orderedQty = parseInt(qtyPart.trim(), 10);
              if (!orderedQty || orderedQty <= 0) return;

              const sizeRecord = sizes.find((s: any) => s.name === sizeName);
              if (!sizeRecord) return;

              const key = `${poItem.design_no || ''}__${sizeRecord.id}`;
              const alreadyReceived = receivedMap[key] || 0;
              const remaining = orderedQty - alreadyReceived;
              if (remaining <= 0) return;

              const idx = sizeEntries.findIndex(se => se.size === sizeRecord.id);
              if (idx >= 0) {
                sizeEntries[idx] = {
                  size: sizeRecord.id,
                  quantity: remaining,
                  print_quantity: remaining,
                };
              }
            });
          }
        }

        if (!sizeEntries.some(se => se.quantity > 0)) {
          return null;
        }

        return {
          design_no: poItem.design_no,
          product_group: d?.product_group?.id || fallbackProductGroupId,
          floor_id: d?.floor || '',
          color: d?.color?.id || fallbackColorId || '',
          sizes: sizeEntries,
          cost_per_item: poItem.rate,
          mrp_markup_percent: d ? 0 : 0,
          mrp: d?.mrp || 0,
          gst_logic: (d?.gst_logic as GSTType) || 'AUTO_5_18',
          image_url: d?.photos?.[0] || '',
          description: d?.description || poItem.product_description || '',
          order_number: po.po_number,
          barcodes_per_item: d?.barcodes_per_item || 1,
          payout_code: d?.payout_code || '',
        };
      }).filter(Boolean) as PurchaseItem[];

      if (invoiceItems.length === 0) {
        setError('All items from this purchase order are already invoiced');
        return;
      }

      setItems(invoiceItems);
    } catch (err: any) {
      console.error('Error loading purchase order for invoice:', err);
      setError(err.message || 'Failed to load purchase order');
    } finally {
      setPoLoading(false);
    }
  };

  const handlePrintBarcodes = () => {
    if (savedPOId) {
      try {
        sessionStorage.setItem('returnTo', '#purchase-invoice');
      } catch {}
      const printUrl = `${window.location.origin}${window.location.pathname}#barcode-print?po_id=${savedPOId}&auto=1`;
      window.location.assign(printUrl);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <Card className="mt-4">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center">
            <FileText className="w-8 h-8 text-emerald-600 mr-3" />
            <div>
              <CardTitle>Purchase Invoice</CardTitle>
              <CardDescription>Create purchase orders and generate barcodes</CardDescription>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                setShowForm(false);
                setEditingInvoiceId(null);
                setOriginalInvoiceQuantities({});
                setSavedPOId(null);
                loadInvoices();
              }}
              variant="outline"
              className="flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Cancel
            </Button>
            {items.length > 0 && (
              <Button
                onClick={generateBarcodePreview}
                variant="secondary"
                className="flex items-center gap-2"
              >
                <Eye className="w-5 h-5" />
                Preview Barcodes
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <Label className="mb-2 block">
              Vendor <span className="text-red-500">*</span>
            </Label>
            <select
              value={selectedVendor}
              onChange={(e) => setSelectedVendor(e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="">Select Vendor</option>
              {vendors.map(v => (
                <option key={v.id} value={v.id}>{v.name} ({v.vendor_code})</option>
              ))}
            </select>
          </div>

          <div>
            <Label className="mb-2 block">Purchase Order (optional)</Label>
            <div className="flex gap-2">
              <select
                value={poNumberInput}
                onChange={(e) => setPoNumberInput(e.target.value)}
                className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                disabled={!selectedVendor || poLoading}
              >
                <option value="">
                  {selectedVendor ? 'Select Purchase Order' : 'Select vendor first'}
                </option>
                {vendorPOs.map(po => (
                  <option key={po.id} value={po.po_number}>
                    {po.po_number} - {new Date(po.order_date).toLocaleDateString()} - {po.status}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                onClick={handleLoadPurchaseOrder}
                disabled={!poNumberInput.trim() || poLoading}
                className="flex items-center"
              >
                {poLoading ? 'Loading...' : 'Load'}
              </Button>
            </div>
          </div>

          <div>
            <Label className="mb-2 block">
              Vendor Invoice Number <span className="text-red-500">*</span>
            </Label>
            <Input
              type="text"
              value={vendorInvoiceNumber}
              onChange={(e) => setVendorInvoiceNumber(e.target.value)}
              placeholder="INV-2024-001"
            />
          </div>

          <div>
            <Label className="mb-2 block">Vendor Invoice Date</Label>
            <Input
              type="date"
              value={vendorInvoiceDate}
              onChange={(e) => setVendorInvoiceDate(e.target.value)}
            />
          </div>

          <div>
            <Label className="mb-2 block">Order Date</Label>
            <Input
              type="date"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
            />
          </div>
        </div>

        <div className="mb-6">
          <Label className="mb-2 block">Vendor Invoice Attachment</Label>
          <div className="flex gap-2">
            <Input
              type="text"
              value={invoiceFileName || (invoiceAttachment ? 'Invoice uploaded' : '')}
              readOnly
              className="flex-1 bg-gray-50"
              placeholder="No invoice attached"
            />
            {invoiceAttachment && (
              <a
                href={invoiceAttachment}
                download={invoiceFileName || 'invoice'}
                className="inline-flex items-center justify-center whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
              >
                <Eye className="w-5 h-5 mr-2" />
                View
              </a>
            )}
            <label className="inline-flex items-center justify-center whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 cursor-pointer">
              <Upload className="w-5 h-5 mr-2" />
              Upload
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={handleInvoiceUpload}
                className="hidden"
                disabled={uploadingInvoice}
              />
            </label>
          </div>
        </div>

        <div className="border-t-2 border-gray-200 pt-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-gray-800">Purchase Items</h3>
            <Button
              onClick={() => {
                setShowItemForm(!showItemForm);
                setEditingIndex(null);
                setCurrentItem({
                  design_no: '',
                  product_group: '',
                  color: '',
                  sizes: [],
                  cost_per_item: 0,
                  mrp_markup_percent: 100,
                  mrp: 0,
                  gst_logic: 'AUTO_5_18',
                  image_url: '',
                  description: '',
                  order_number: '',
                });
                setNewItemSizes(sizes.map(s => ({ size: s.id, quantity: 0 })));
              }}
              className="flex items-center gap-2 shadow-md"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Item
            </Button>
          </div>

          {showItemForm && (
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-6 rounded-lg mb-6 border-2 border-emerald-200 shadow-md">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-lg font-bold text-gray-800">
                  {editingIndex !== null ? 'Edit Item' : 'Add New Item'}
                </h4>
                <button
                  onClick={() => {
                    setShowItemForm(false);
                    setEditingIndex(null);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="mb-4">
                <div className="flex gap-4 mb-4">
                  <label className="flex items-center bg-white px-4 py-2 rounded-lg border-2 border-emerald-300 cursor-pointer hover:bg-emerald-50">
                    <input
                      type="radio"
                      value="existing"
                      checked={itemMode === 'existing'}
                      onChange={(e) => setItemMode(e.target.value as 'existing')}
                      className="mr-2 text-emerald-600"
                    />
                    <span className="font-medium text-gray-700">Select Existing Design</span>
                  </label>
                  <label className="flex items-center bg-white px-4 py-2 rounded-lg border-2 border-purple-300 cursor-pointer hover:bg-purple-50">
                    <input
                      type="radio"
                      value="new"
                      checked={itemMode === 'new'}
                      onChange={(e) => setItemMode(e.target.value as 'new')}
                      className="mr-2 text-purple-600"
                    />
                    <span className="font-medium text-gray-700">Create New Design</span>
                  </label>
                </div>

                {itemMode === 'existing' && (
                  <div>
                    <Label className="mb-2 block">Select Design</Label>
                    <select
                      value={selectedDesignId}
                      onChange={(e) => {
                        setSelectedDesignId(e.target.value);
                        handleExistingDesignSelect(e.target.value);
                      }}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      disabled={!selectedVendor}
                    >
                      <option value="">Select Design</option>
                      {existingDesigns.map(design => (
                        <option key={design.id} value={design.id}>
                          {design.design_no} - {design.product_group?.name || 'Unknown'} - {design.color?.name || 'No Color'}
                        </option>
                      ))}
                    </select>
                    {!selectedVendor && (
                      <p className="text-xs text-orange-600 mt-1">Please select a vendor first</p>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <Label className="mb-2 block">
                    Design Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="text"
                    value={currentItem.design_no}
                    onChange={(e) => setCurrentItem({ ...currentItem, design_no: e.target.value })}
                    placeholder="DN458"
                    disabled={itemMode === 'existing'}
                  />
                </div>

                <div>
                  <Label className="mb-2 block">
                    Product Group <span className="text-red-500">*</span>
                  </Label>
                  <select
                    value={currentItem.product_group}
                    onChange={(e) => setCurrentItem({ ...currentItem, product_group: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    disabled={itemMode === 'existing'}
                  >
                    <option value="">Select</option>
                    {productGroups.map(pg => (
                      <option key={pg.id} value={pg.id}>{pg.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label className="mb-2 block">HSN Code</Label>
                  <Input
                    type="text"
                    value={currentItem.hsn_code || ''}
                    readOnly
                    className="bg-gray-50 text-gray-600"
                    placeholder="Auto-filled"
                  />
                </div>

                <div>
                  <Label className="mb-2 block">Floor</Label>
                  <select
                    value={currentItem.floor_id}
                    onChange={(e) => setCurrentItem({ ...currentItem, floor_id: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Default Floor</option>
                    {floors.map(f => (
                      <option key={f.id} value={f.id}>{f.name} ({f.floor_code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label className="mb-2 block">Barcodes per Item</Label>
                  <Input
                    type="number"
                    min="1"
                    value={currentItem.barcodes_per_item || ''}
                    onChange={(e) => setCurrentItem({ ...currentItem, barcodes_per_item: e.target.value === '' ? '' as any : parseInt(e.target.value) || 1 })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Number of labels to print for each item</p>
                </div>

                <div>
                  <Label className="mb-2 block">Color</Label>
                  <select
                    value={currentItem.color}
                    onChange={(e) => setCurrentItem({ ...currentItem, color: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    disabled={itemMode === 'existing' && !!existingDesigns.find(d => d.id === selectedDesignId)?.color}
                  >
                    <option value="">Select</option>
                    {colors.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label className="mb-2 block">Order Number</Label>
                  <Input
                    type="text"
                    value={currentItem.order_number}
                    onChange={(e) => setCurrentItem({ ...currentItem, order_number: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    placeholder="Optional"
                  />
                </div>

                <div>
                  <Label className="mb-2 block">
                    Cost Per Item <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={currentItem.cost_per_item}
                    onChange={(e) => setCurrentItem({ ...currentItem, cost_per_item: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <Label className="mb-2 block">
                    MRP Markup % <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={currentItem.mrp_markup_percent}
                    onChange={(e) => setCurrentItem({ ...currentItem, mrp_markup_percent: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    placeholder="100"
                  />
                  <p className="text-xs text-gray-500 mt-1">Markup % before GST</p>
                </div>

                <div>
                  <Label className="mb-2 block">Calculated MRP (including GST)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={currentItem.mrp}
                    onChange={(e) => setCurrentItem({ ...currentItem, mrp: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-emerald-300 rounded-lg bg-emerald-50 focus:ring-2 focus:ring-emerald-500"
                  />
                  <p className="text-xs text-emerald-600 mt-1">Auto: Cost × (1+Markup%) × (1+GST%)</p>
                </div>

                <div>
                  <Label className="mb-2 block">GST Logic</Label>
                  <select
                    value={currentItem.gst_logic}
                    onChange={(e) => setCurrentItem({ ...currentItem, gst_logic: e.target.value as GSTType })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="AUTO_5_18">AUTO (5% if &lt;2500, else 18%)</option>
                    <option value="FLAT_5">FLAT 5%</option>
                  </select>
                </div>
              </div>

              <div className="mb-4">
                <Label className="mb-2 block">Description</Label>
                <textarea
                  value={currentItem.description}
                  onChange={(e) => setCurrentItem({ ...currentItem, description: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  rows={2}
                />
              </div>

              <div className="mb-4">
                <Label className="mb-2 block">
                  Product Image <span className="text-red-500">*</span>
                </Label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={currentItem.image_url ? 'Image added' : ''}
                      readOnly
                      className="flex-1 bg-gray-50"
                      placeholder="No image"
                    />
                    <label className="inline-flex items-center justify-center whitespace-nowrap rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground shadow-sm transition-colors hover:bg-secondary/80 cursor-pointer">
                      <Upload className="w-5 h-5 mr-2" />
                      Upload
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                    <Button type="button" onClick={openCamera} className="shadow-md">
                      Take Photo
                    </Button>
                    <input
                      ref={hiddenCameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </div>
                  {currentItem.image_url && (
                    <div className="relative w-32 h-32 border-2 border-gray-300 rounded-lg overflow-hidden">
                      <img
                        src={currentItem.image_url}
                        alt="Product"
                        className="w-full h-full object-cover"
                      />
                      <Button
                        type="button"
                        onClick={clearImage}
                        title="Remove image"
                        size="icon"
                        variant="ghost"
                        className="absolute top-1 right-1 bg-white/80 hover:bg-white"
                      >
                        <X className="w-4 h-4 text-gray-700" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <div className="mb-4">
                <Label className="mb-2 block">Size Quantities</Label>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                  {newItemSizes.map((sq, idx) => {
                    const size = sizes.find(s => s.id === sq.size);
                    return (
                      <div key={sq.size} className="bg-gray-50 p-2 rounded border border-gray-200">
                        <Label className="block text-xs font-bold text-gray-700 mb-1 text-center truncate" title={size?.name}>{size?.name}</Label>
                        <Input
                          type="number"
                          min="0"
                          value={sq.quantity}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            const updated = [...newItemSizes];
                            updated[idx].quantity = val;
                            updated[idx].print_quantity = val * (currentItem.barcodes_per_item || 1);
                            setNewItemSizes(updated);
                          }}
                          className="w-full px-2 py-1 text-center font-bold"
                          placeholder="0"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowItemForm(false);
                    setEditingIndex(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="button" onClick={addItemToList} className="shadow-md">
                  {editingIndex !== null ? 'Update Item' : 'Add to List'}
                </Button>
              </div>
            </div>
          )}

          {items.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full border-2 border-gray-200">
                <thead className="bg-gradient-to-r from-emerald-100 to-teal-100">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase">Design</th>
                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase">Details</th>
                    <th className="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase">Sizes/Qty</th>
                    <th className="px-3 py-2 text-right text-xs font-bold text-gray-700 uppercase">Cost (Taxable)</th>
                    <th className="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase">Markup %</th>
                    <th className="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase">GST Rate</th>
                    <th className="px-3 py-2 text-right text-xs font-bold text-gray-700 uppercase">MRP</th>
                    <th className="px-3 py-2 text-right text-xs font-bold text-gray-700 uppercase">Total Cost</th>
                    <th className="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-gray-200">
                  {items.map((item, idx) => {
                    const totalQty = getTotalQuantity(item);
                    const totalCost = item.cost_per_item * totalQty;
                    const gstRate = item.gst_logic === 'FLAT_5' ? '5%' : (item.mrp < 2500 ? '5%' : '18%');

                    return (
                      <tr key={idx} className="hover:bg-emerald-50 transition-colors">
                        <td className="px-3 py-3">
                          <div className="font-bold text-gray-800">{item.design_no}</div>
                          {item.order_number && (
                            <div className="text-xs text-orange-600 font-semibold">Order: {item.order_number}</div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-sm">
                          <div>{productGroups.find(pg => pg.id === item.product_group)?.name}</div>
                          <div className="text-gray-600">{colors.find(c => c.id === item.color)?.name}</div>
                        </td>
                        <td className="px-3 py-3 text-center align-top">
                          <div className="inline-flex flex-wrap gap-1 justify-center">
                            {item.sizes
                              .filter(sq => sq.quantity > 0)
                              .map((sq, sqIdx) => (
                                <span
                                  key={sqIdx}
                                  className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs font-semibold border border-blue-200"
                                >
                                  {sizes.find(s => s.id === sq.size)?.name}: {sq.quantity}
                                </span>
                              ))}
                          </div>
                          <div className="text-xs font-bold text-gray-600 mt-1">
                            Total: <span className="text-gray-800">{totalQty}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right font-semibold">₹{item.cost_per_item.toFixed(2)}</td>
                        <td className="px-3 py-3 text-center font-semibold text-purple-700">{item.mrp_markup_percent}%</td>
                        <td className="px-3 py-3 text-center">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            gstRate === '5%' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                          }`}>
                            {gstRate}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right font-bold text-emerald-700">₹{item.mrp.toFixed(2)}</td>
                        <td className="px-3 py-3 text-right font-bold text-gray-800">₹{totalCost.toFixed(2)}</td>
                        <td className="px-3 py-3 text-center">
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={() => editItem(idx)}
                              className="text-emerald-600 hover:text-emerald-700 p-1"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => removeItem(idx)}
                              className="text-red-600 hover:text-red-700 p-1"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="border-t-2 border-gray-200 pt-6 mb-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">GST Calculation</h3>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                GST Type <span className="text-red-500">*</span>
              </label>
              <select
                value={gstType}
                onChange={(e) => setGstType(e.target.value as GSTTransactionType)}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                title="Select GST Type: CGST+SGST for same state, IGST for different state"
              >
                <option value="CGST_SGST">CGST + SGST</option>
                <option value="IGST">IGST</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Taxable Value (Auto-Calculated) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={taxableValue ? `₹${parseFloat(taxableValue).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '₹0.00'}
                readOnly
                className="w-full px-4 py-2 border-2 border-emerald-300 rounded-lg bg-emerald-50 font-bold"
                placeholder="Add items to calculate"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Calculated GST
              </label>
              <input
                type="text"
                value={`₹${calculatedGST.toFixed(2)}`}
                readOnly
                className="w-full px-4 py-2 border-2 border-emerald-300 rounded-lg bg-emerald-50 font-bold"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Manual GST Override
              </label>
              <input
                type="number"
                step="0.01"
                value={manualGST}
                onChange={(e) => setManualGST(e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                placeholder="Override GST"
              />
            </div>
          </div>

          {parseFloat(manualGST || '0') !== calculatedGST && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for GST Difference
              </label>
              <textarea
                value={gstDifferenceReason}
                onChange={(e) => setGstDifferenceReason(e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                rows={2}
                placeholder="Explain why GST was manually adjusted"
              />
            </div>
          )}
        </div>

        <div className="border-t-2 border-gray-200 pt-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            rows={3}
          />
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-6 rounded-lg mb-6 border-2 border-emerald-200 shadow-md">
          <div className="flex justify-between text-lg font-semibold text-gray-700">
            <span>Total Items:</span>
            <span className="text-emerald-700">{items.reduce((sum, item) => sum + getTotalQuantity(item), 0)}</span>
          </div>
          <div className="flex justify-between text-lg font-semibold text-gray-700 mt-2">
            <span>Subtotal:</span>
            <span className="text-emerald-700">₹{calculateTotal().toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-lg font-semibold text-gray-700 mt-2">
            <span>GST:</span>
            <span className="text-emerald-700">₹{parseFloat(manualGST || '0').toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-2xl font-bold text-emerald-700 border-t-2 border-emerald-300 mt-3 pt-3">
            <span>Grand Total:</span>
            <span>₹{(calculateTotal() + parseFloat(manualGST || '0')).toFixed(2)}</span>
          </div>
        </div>

        {error && (
          <div className="bg-gradient-to-r from-red-50 to-red-100 border-2 border-red-300 text-red-700 p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-300 text-green-700 p-4 rounded-lg mb-6">
            {success}
            {savedPOId && (
              <button
                onClick={handlePrintBarcodes}
                className="ml-4 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 inline-flex items-center shadow-md"
              >
                <Printer className="w-4 h-4 mr-2" />
                Print Barcodes
              </button>
            )}
          </div>
        )}

        <div className="flex justify-end gap-4">
          {items.length > 0 && (
            <Button
              onClick={generateBarcodePreview}
              variant="secondary"
              className="px-8 py-3 text-lg font-semibold shadow-lg flex items-center gap-2"
            >
              <Eye className="w-5 h-5" />
              Preview Barcodes
            </Button>
          )}
          <Button
            onClick={() => (editingInvoiceId ? updatePurchaseOrder() : savePurchaseOrder())}
            disabled={loading}
            className="px-8 py-3 text-lg font-semibold shadow-lg flex items-center gap-2"
          >
            <Save className="w-5 h-5" />
            {loading
              ? 'Saving...'
              : editingInvoiceId
                ? 'Update Purchase Order'
                : 'Save Purchase Order'}
          </Button>
        </div>
        </CardContent>
      </Card>

      {cameraOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-4 w-[92vw] max-w-md">
            <div className="aspect-video bg-black rounded overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            </div>
            <div className="mt-3 flex gap-3 justify-center">
              <Button type="button" onClick={capturePhoto}>
                Capture
              </Button>
              <Button type="button" variant="outline" onClick={closeCamera}>
                Cancel
              </Button>
            </div>
            {cameraError && (
              <div className="text-red-600 text-sm mt-2 text-center">
                {cameraError}
              </div>
            )}
          </div>
        </div>
      )}

      {showBarcodePreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 flex justify-between items-center">
              <h3 className="text-2xl font-bold text-white">Barcode Preview</h3>
              <button
                onClick={() => setShowBarcodePreview(false)}
                className="text-white hover:text-gray-200"
              >
                <X className="w-8 h-8" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-100px)]">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gradient-to-r from-gray-100 to-gray-200">
                      <th className="border-2 border-gray-300 p-3 text-left font-bold">Barcode Image</th>
                      <th className="border-2 border-gray-300 p-3 text-left font-bold">8-Digit Code</th>
                      <th className="border-2 border-gray-300 p-3 text-left font-bold">Structured Barcode</th>
                      <th className="border-2 border-gray-300 p-3 text-left font-bold">Design</th>
                      <th className="border-2 border-gray-300 p-3 text-left font-bold">Details</th>
                      <th className="border-2 border-gray-300 p-3 text-left font-bold">Qty / Print</th>
                      <th className="border-2 border-gray-300 p-3 text-left font-bold">Cost</th>
                      <th className="border-2 border-gray-300 p-3 text-left font-bold">MRP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {barcodePreviewList.map((preview, idx) => {
                      const barcodeImageURL = generateBarcodeDataURL(preview.barcode_structured, {
                        width: 2,
                        height: 50,
                        displayValue: false,
                      });

                      return (
                        <tr key={idx} className="hover:bg-purple-50 transition-colors">
                          <td className="border-2 border-gray-300 p-3">
                            <div className="bg-white p-2 rounded border border-gray-200 flex justify-center items-center min-h-[60px]">
                              {barcodeImageURL ? (
                                <img src={barcodeImageURL} alt="Barcode" className="max-w-full h-auto" />
                              ) : (
                                <span className="text-xs text-red-500">Error</span>
                              )}
                            </div>
                          </td>
                          <td className="border-2 border-gray-300 p-3">
                            <span className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-3 py-1 rounded-lg font-bold text-lg">
                              {preview.barcode_8digit}
                            </span>
                          </td>
                          <td className="border-2 border-gray-300 p-3 text-sm font-mono">{preview.barcode_structured}</td>
                          <td className="border-2 border-gray-300 p-3 font-bold">{preview.design_no}</td>
                          <td className="border-2 border-gray-300 p-3 text-sm">
                            <div>{preview.product_group}</div>
                            <div className="text-gray-600">{preview.color} - {preview.size}</div>
                            {preview.order_number && <div className="text-orange-600 font-semibold">Order: {preview.order_number}</div>}
                          </td>
                          <td className="border-2 border-gray-300 p-3 text-center font-bold">
                            {preview.quantity} {preview.quantity !== preview.print_quantity && <span className="text-blue-600">({preview.print_quantity})</span>}
                          </td>
                          <td className="border-2 border-gray-300 p-3 text-right font-semibold">₹{preview.cost}</td>
                          <td className="border-2 border-gray-300 p-3 text-right font-semibold">₹{preview.mrp}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
