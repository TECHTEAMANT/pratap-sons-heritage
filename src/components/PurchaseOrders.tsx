import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Package, Loader, FileText, CheckCircle, Plus, X, Save, Eye, Pencil, Trash2, Edit2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import VendorAddModal from './VendorAddModal';

interface Vendor {
  id: string;
  name: string;
  vendor_code: string;
}

interface OrderItem {
  design_no: string;
  product_group: string;
  color: string;
  sizes: { size: string; quantity: number }[];
  cost_per_item: string;
  mrp: number;
  gst_logic: string;
  description: string;
  total_quantity: number;
  total_cost: number;
  hsn_code: string;
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
  const [productGroups, setProductGroups] = useState<any[]>([]);
  const [colors, setColors] = useState<any[]>([]);
  const [sizes, setSizes] = useState<any[]>([]);
  const [existingDesigns, setExistingDesigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedDesignId, setSelectedDesignId] = useState('');
  const [formData, setFormData] = useState({
    vendor_id: '',
    order_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const [showItemForm, setShowItemForm] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [itemMode, setItemMode] = useState<'existing' | 'new'>('existing');
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [selectedOrderItems, setSelectedOrderItems] = useState<any[]>([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

  const [items, setItems] = useState<OrderItem[]>([]);

  const [currentItem, setCurrentItem] = useState<OrderItem>({
    design_no: '',
    product_group: '',
    color: '',
    sizes: [],
    cost_per_item: '',
    mrp: 0,
    gst_logic: 'AUTO_5_18',
    description: '',
    total_quantity: 0,
    total_cost: 0,
    hsn_code: '',
  });

  const [newItemSizes, setNewItemSizes] = useState<{ size: string; quantity: number }[]>([]);

  useEffect(() => {
    loadOrders();
    loadVendors();
    loadMasterData();
  }, [filterStatus]);

  useEffect(() => {
    if (formData.vendor_id) {
      loadExistingDesigns(formData.vendor_id);
    } else {
      setExistingDesigns([]);
    }
  }, [formData.vendor_id]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('purchase_orders')
        .select('*, vendor:vendors(id, name, vendor_code)')
        .ilike('po_number', 'PO%')
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
        .eq('active', true)
        .order('name');

      if (error) throw error;
      setVendors(data || []);
    } catch (err: any) {
      console.error('Error loading vendors:', err);
    }
  };

  const loadMasterData = async () => {
    try {
      const [groupsRes, colorsRes, sizesRes] = await Promise.all([
        supabase.from('product_groups').select('*'),
        supabase.from('colors').select('*'),
        supabase.from('sizes').select('*').order('sort_order'),
      ]);

      setProductGroups(groupsRes.data || []);
      setColors(colorsRes.data || []);
      setSizes(sizesRes.data || []);
    } catch (err) {
      console.error('Error loading purchase order master data:', err);
    }
  };

  useEffect(() => {
    if (currentItem.product_group) {
      const group = productGroups.find(pg => pg.id === currentItem.product_group);
      if (group) {
        setCurrentItem(prev => ({ 
          ...prev, 
          hsn_code: group.hsn_code || prev.hsn_code || '' 
        }));
      }
    }
  }, [currentItem.product_group]);

  const loadExistingDesigns = async (vendorId: string) => {
    try {
      const { data, error } = await supabase
        .from('product_masters')
        .select(`
          id,
          design_no,
          product_group:product_groups(id, name, group_code),
          color:colors(id, name, color_code),
          vendor:vendors(id, name, vendor_code),
          description,
          hsn_code
        `)
        .eq('vendor', vendorId);

      if (error) throw error;

      const designs = (data || []).map((row: any) => ({
        id: row.id,
        design_no: row.design_no,
        product_group: row.product_group,
        color: row.color,
        vendor: row.vendor,
        description: row.description || '',
        hsn_code: row.hsn_code || '',
      }));

      setExistingDesigns(designs);
    } catch (err) {
      console.error('Error loading existing designs for purchase orders:', err);
    }
  };

  useEffect(() => {
    if (sizes.length > 0) {
      setNewItemSizes(sizes.map((s: any) => ({ size: s.id, quantity: 0 })));
    }
  }, [sizes]);


  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const openNewItemForm = () => {
    setCurrentItem({
      design_no: '',
      product_group: '',
      color: '',
      sizes: [],
      cost_per_item: "0",
      mrp: 0,
      gst_logic: 'AUTO_5_18',
      description: '',
      total_quantity: 0,
      total_cost: 0,
      hsn_code: '',
    });
    setNewItemSizes(sizes.map((s: any) => ({ size: s.id, quantity: 0 })));
    setEditingIndex(null);
    setShowItemForm(true);
  };

  const editItem = (index: number) => {
    const item = items[index];
    setCurrentItem(item);
    if (item.sizes && item.sizes.length > 0) {
      setNewItemSizes(item.sizes);
    } else {
      setNewItemSizes(sizes.map((s: any) => ({ size: s.id, quantity: 0 })));
    }
    setEditingIndex(index);
    setShowItemForm(true);
    setItemMode('new');
  };

  const saveItemToList = () => {
    const totalQuantity = newItemSizes.reduce((sum, sq) => sum + (sq.quantity || 0), 0);
    const cost = parseFloat(currentItem.cost_per_item || '0');

    if (!currentItem.design_no || !currentItem.product_group || !currentItem.description || totalQuantity <= 0 || cost <= 0) {
      setError('Please fill design, product group, description, sizes and cost for the item');
      return;
    }

    const item: OrderItem = {
      ...currentItem,
      sizes: newItemSizes,
      total_quantity: totalQuantity,
      total_cost: totalQuantity * cost,
    };

    if (editingIndex !== null) {
      const updated = [...items];
      updated[editingIndex] = item;
      setItems(updated);
    } else {
      setItems([...items, item]);
    }

    setShowItemForm(false);
    setEditingIndex(null);
    setError('');
  };

  const buildProductDescription = (item: OrderItem) => {
    const group = productGroups.find(pg => pg.id === item.product_group);
    const color = colors.find(c => c.id === item.color);
    const sizesSummary = item.sizes
      .filter(sq => sq.quantity > 0)
      .map(sq => {
        const size = sizes.find((s: any) => s.id === sq.size);
        return `${size?.name || ''}:${sq.quantity}`;
      })
      .filter(Boolean)
      .join(', ');

    const parts = [
      group?.name || '',
      color?.name || '',
      item.description || '',
      sizesSummary ? `Sizes ${sizesSummary}` : '',
    ].filter(Boolean);

    return parts.join(' | ') || 'Item';
  };

  const fetchOrderItems = async (orderId: string) => {
    const { data, error } = await supabase
      .from('purchase_order_items')
      .select('*')
      .eq('purchase_order_id', orderId);
    
    if (error) {
      console.error('Error fetching order items:', error);
      return [];
    }
    return data || [];
  };

  const handlePreview = async (order: PurchaseOrder) => {
    setSelectedOrder(order);
    const items = await fetchOrderItems(order.id);
    setSelectedOrderItems(items);
    setIsPreviewOpen(true);
  };

  const handleEditOrder = async (order: PurchaseOrder) => {
    setLoading(true);
    try {
      // 1. Set form data
      setFormData({
        vendor_id: order.vendor.id,
        order_date: order.order_date,
        notes: order.notes || '',
      });
      
      // 2. Fetch items
      const dbItems = await fetchOrderItems(order.id);
      
      // 3. Map to OrderItem structure
      // We try to extract info from description if possible, or leave as generic
      const mappedItems: OrderItem[] = dbItems.map(item => {
        const descParts = item.product_description.split(' | ');
        
        // Try to match group and color from description parts
        let groupId = '';
        let colorId = '';
        let description = '';
        let sizesStr = '';
        
        // Find group
        const group = productGroups.find(pg => descParts.some((part: string) => part === pg.name));
        if (group) groupId = group.id;
        
        // Find color
        const color = colors.find(c => descParts.some((part: string) => part === c.name));
        if (color) colorId = color.id;
        
        // Find sizes part and description
        const otherParts = descParts.filter((part: string) => {
          if (part.startsWith('Sizes ')) {
            sizesStr = part.replace('Sizes ', '');
            return false;
          }
          if (group && part === group.name) return false;
          if (color && part === color.name) return false;
          return true;
        });
        
        description = otherParts.join(' | ');

        // Parse sizes
        const parsedSizes: { size: string; quantity: number }[] = [];
        if (sizesStr) {
          const sizeParts = sizesStr.split(', ');
          sizeParts.forEach((sp: string) => {
            const [name, qty] = sp.split(':');
            const sizeObj = sizes.find((s: any) => s.name === name);
            if (sizeObj && qty) {
              parsedSizes.push({
                size: sizeObj.id,
                quantity: parseInt(qty)
              });
            }
          });
        }

        return {
          design_no: item.design_no || '',
          product_group: groupId,
          color: colorId,
          sizes: parsedSizes.length > 0 ? parsedSizes : [],
          cost_per_item: item.rate.toString(),
          mrp: 0,
          gst_logic: 'AUTO_5_18',
          description: description || item.product_description,
          hsn_code: item.hsn_code || '',
          total_quantity: item.quantity,
          total_cost: item.total,
        };
      });
      
      setItems(mappedItems);
      setEditingOrderId(order.id);
      setShowForm(true);
    } catch (err: any) {
      setError('Failed to load order for editing');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.vendor_id) {
      setError('Please select a vendor');
      return;
    }

    if (items.length === 0) {
      setError('Please add at least one item');
      return;
    }

    if (items.some(item => !item.design_no || (!item.product_group && !editingOrderId) || !item.description || item.total_quantity <= 0 || parseFloat(item.cost_per_item || '0') <= 0)) {
      setError('Please fill in all item details with valid values');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const totalItems = items.reduce((sum, item) => sum + item.total_quantity, 0);
      const totalAmount = items.reduce((sum, item) => sum + item.total_cost, 0);

      let orderId = editingOrderId;
      let poNumber = '';

      if (editingOrderId) {
        // Update existing order
        const { error: updateError } = await supabase
          .from('purchase_orders')
          .update({
            vendor: formData.vendor_id,
            order_date: formData.order_date,
            total_items: totalItems,
            total_amount: totalAmount,
            notes: formData.notes,
          })
          .eq('id', editingOrderId);

        if (updateError) throw updateError;
        
        // Delete existing items
        const { error: deleteError } = await supabase
          .from('purchase_order_items')
          .delete()
          .eq('purchase_order_id', editingOrderId);
          
        if (deleteError) throw deleteError;
        
        poNumber = orders.find(o => o.id === editingOrderId)?.po_number || '';
      } else {
        // Create new order
        poNumber = await generatePONumber();

        const { data: poData, error: poError } = await supabase
          .from('purchase_orders')
          .insert([
            {
              po_number: poNumber,
              vendor: formData.vendor_id,
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
        orderId = poData.id;
      }

      const itemsToInsert = items.map((item) => ({
        purchase_order_id: orderId,
        design_no: item.design_no,
        product_description: buildProductDescription(item),
        quantity: item.total_quantity,
        rate: parseFloat(item.cost_per_item || '0'),
        total: item.total_cost,
      }));

      const { error: itemsError } = await supabase
        .from('purchase_order_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      setSuccess(`Purchase Order ${poNumber} ${editingOrderId ? 'updated' : 'created'} successfully!`);
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
    const { count, error } = await supabase
      .from('purchase_orders')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('Error generating PO number:', error);
    }

    return `PO${String((count || 0) + 1).padStart(6, '0')}`;
  };

  const resetForm = () => {
    setFormData({
      vendor_id: '',
      order_date: new Date().toISOString().split('T')[0],
      notes: '',
    });
    setItems([]);
    setShowItemForm(false);
    setEditingIndex(null);
    setEditingOrderId(null);
    setShowForm(false);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
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
            <Button
              onClick={() => setShowForm(!showForm)}
              size="lg"
              className="flex items-center gap-2"
            >
              {showForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
              {showForm ? 'Cancel' : 'New PO'}
            </Button>
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


        {showForm && (
          <div className="bg-gray-50 p-6 rounded-lg mb-6">
            <h3 className="text-lg font-semibold mb-4">Create Purchase Order</h3>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <Label className="mb-2 block">Vendor *</Label>
                  <select
                    value={formData.vendor_id}
                    onChange={(e) => {
                      if (e.target.value === 'ADD_NEW') {
                        setShowVendorModal(true);
                      } else {
                        setFormData({ ...formData, vendor_id: e.target.value });
                      }
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select Vendor</option>
                    <option value="ADD_NEW" className="font-bold text-blue-600">+ Add New Vendor...</option>
                    {vendors.map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.name} ({vendor.vendor_code})
                      </option>
                    ))}
                  </select>

                  <VendorAddModal
                    isOpen={showVendorModal}
                    onClose={() => setShowVendorModal(false)}
                    onSuccess={(newVendor) => {
                      setVendors(prev => [...prev, newVendor].sort((a, b: any) => a.name.localeCompare(b.name)));
                      setFormData(prev => ({ ...prev, vendor_id: newVendor.id }));
                      setShowVendorModal(false);
                    }}
                  />
                </div>
                <div>
                  <Label className="mb-2 block">Order Date *</Label>
                  <Input
                    type="date"
                    value={formData.order_date}
                    onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="mb-6">
                <Label className="mb-2 block">Notes</Label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Enter any notes or special instructions"
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                />
              </div>

              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-md font-semibold text-gray-700">Order Items</h4>
                  <Button
                    type="button"
                    onClick={openNewItemForm}
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

                    <div className="flex gap-4 mb-4">
                      <label className="flex items-center bg-white px-4 py-2 rounded-lg border-2 border-emerald-300 cursor-pointer hover:bg-emerald-50">
                        <input
                          type="radio"
                          value="existing"
                          checked={itemMode === 'existing'}
                          onChange={(e) => {
                            setItemMode(e.target.value as 'existing');
                            setSelectedDesignId('');
                            setCurrentItem({
                              design_no: '',
                              product_group: '',
                              color: '',
                              sizes: [],
                              cost_per_item: "0",
                              mrp: 0,
                              gst_logic: 'AUTO_5_18',
                              description: '',
                              total_quantity: 0,
                              total_cost: 0,
                              hsn_code: '',
                            });
                            setNewItemSizes(sizes.map((s: any) => ({ size: s.id, quantity: 0 })));
                          }}
                          className="mr-2 text-emerald-600"
                        />
                        <span className="font-medium text-gray-700">Select Existing Design</span>
                      </label>
                      <label className="flex items-center bg-white px-4 py-2 rounded-lg border-2 border-purple-300 cursor-pointer hover:bg-purple-50">
                        <input
                          type="radio"
                          value="new"
                          checked={itemMode === 'new'}
                          onChange={(e) => {
                            setItemMode(e.target.value as 'new');
                            setSelectedDesignId('');
                            setCurrentItem({
                              design_no: '',
                              product_group: '',
                              color: '',
                              sizes: [],
                              cost_per_item: "0",
                              mrp: 0,
                              gst_logic: 'AUTO_5_18',
                              description: '',
                              total_quantity: 0,
                              total_cost: 0,
                              hsn_code: '',
                            });
                            setNewItemSizes(sizes.map((s: any) => ({ size: s.id, quantity: 0 })));
                          }}
                          className="mr-2 text-purple-600"
                        />
                        <span className="font-medium text-gray-700">Create New Design</span>
                      </label>
                    </div>

                    {itemMode === 'existing' && (
                      <div className="mb-4 text-left">
                        <Label className="mb-2 block italic text-emerald-700">Select Design</Label>
                        <select
                          value={selectedDesignId}
                          onChange={(e) => {
                            const id = e.target.value;
                            setSelectedDesignId(id);
                            const design = existingDesigns.find((d: any) => d.id === id);
                            if (design) {
                              setCurrentItem((prev) => ({
                                ...prev,
                                design_no: design.design_no,
                                product_group: design.product_group?.id || '',
                                color: design.color?.id || '',
                                description: design.description || '',
                                hsn_code: design.hsn_code || '',
                              }));
                            }
                          }}
                          className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                          disabled={!formData.vendor_id}
                        >
                          <option value="">Select Design</option>
                          {existingDesigns.map((design: any) => (
                            <option key={design.id} value={design.id}>
                              {design.design_no} - {design.product_group?.name || ''} - {design.color?.name || 'No Color'}
                            </option>
                          ))}
                        </select>
                        {!formData.vendor_id && (
                          <p className="text-xs text-orange-600 mt-1 italic">Please select a vendor first</p>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4 text-left">
                      <div>
                        <Label className="mb-2 block">Design No *</Label>
                        <Input
                          type="text"
                          value={currentItem.design_no}
                          onChange={(e) => setCurrentItem({ ...currentItem, design_no: e.target.value })}
                          className="border-2 border-gray-300"
                          disabled={itemMode === 'existing'}
                        />
                      </div>
                      <div>
                        <Label className="mb-2 block">Product Group</Label>
                        <select
                          value={currentItem.product_group}
                          onChange={(e) => {
                            const selectedPg = productGroups.find(pg => pg.id === e.target.value);
                            setCurrentItem({
                              ...currentItem,
                              product_group: e.target.value,
                              // Auto-populate description from product group name
                              description: currentItem.description || selectedPg?.name || '',
                              // Auto-populate HSN code if not already set
                              hsn_code: currentItem.hsn_code || selectedPg?.hsn_code || '',
                            });
                          }}
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
                          value={currentItem.hsn_code}
                          readOnly
                          className="border-2 border-gray-300 bg-gray-50 text-gray-500"
                          placeholder="Auto-filled"
                        />
                      </div>
                      <div>
                        <Label className="mb-2 block">Color</Label>
                        <select
                          value={currentItem.color}
                          onChange={(e) => setCurrentItem({ ...currentItem, color: e.target.value })}
                          className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                          disabled={itemMode === 'existing' && !!existingDesigns.find((d: any) => d.id === selectedDesignId)?.color}
                        >
                          <option value="">Select</option>
                          {colors.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label className="mb-2 block">Cost Per Item</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={currentItem.cost_per_item}
                          onChange={(e) => setCurrentItem({ ...currentItem, cost_per_item: e.target.value })}
                          className="border-2 border-gray-300"
                        />
                      </div>
                      <div>
                        <Label className="mb-2 block">Description *</Label>
                        <Input
                          type="text"
                          value={currentItem.description}
                          onChange={(e) => setCurrentItem({ ...currentItem, description: e.target.value })}
                          className="border-2 border-gray-300"
                        />
                      </div>
                    </div>

                    <div className="mb-4 text-left">
                      <Label className="mb-2 block">Size Quantities</Label>
                      <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-8 gap-3">
                        {newItemSizes.map((sq, idx) => {
                          const size = sizes.find((s: any) => s.id === sq.size);
                          return (
                            <div key={sq.size} className="bg-white p-2 rounded-lg border-2 border-emerald-100 shadow-sm transition-all hover:border-emerald-300">
                              <div className="text-xs font-bold mb-1 text-center text-emerald-800 uppercase tracking-wider">
                                {size?.name}
                              </div>
                              <input
                                type="number"
                                min="0"
                                value={sq.quantity}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 0;
                                  const updated = [...newItemSizes];
                                  updated[idx] = { ...updated[idx], quantity: val };
                                  setNewItemSizes(updated);
                                }}
                                className="w-full px-2 py-1 border border-gray-300 rounded-md text-center text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-emerald-50/30"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex justify-end space-x-2">
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
                      <Button
                        type="button"
                        onClick={saveItemToList}
                      >
                        {editingIndex !== null ? 'Update Item' : 'Add to List'}
                      </Button>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-200 shadow-sm rounded-lg overflow-hidden">
                    <thead className="bg-gray-50 border-b-2 border-gray-200">
                      <tr>
                        <th className="p-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Design</th>
                        <th className="p-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Details</th>
                        <th className="p-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Total Qty</th>
                        <th className="p-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Rate</th>
                        <th className="p-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Total</th>
                        <th className="p-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-4 text-center text-sm text-gray-500">
                            No items added. Click "Add Item" to start.
                          </td>
                        </tr>
                      ) : (
                        items.map((item, index) => {
                          const group = productGroups.find(pg => pg.id === item.product_group);
                          const color = colors.find(c => c.id === item.color);
                          const sizesSummary = item.sizes
                            .filter(sq => sq.quantity > 0)
                            .map(sq => {
                              const size = sizes.find((s: any) => s.id === sq.size);
                              return `${size?.name || ''}:${sq.quantity}`;
                            })
                            .join(', ');
                          return (
                            <tr key={index} className="border-t">
                              <td className="p-2 text-sm font-semibold">
                                {item.design_no}
                              </td>
                              <td className="p-2 text-xs">
                                <div>{group?.name}</div>
                                <div className="text-gray-600">{color?.name}</div>
                                {sizesSummary && (
                                  <div className="text-gray-500 text-xs">Sizes {sizesSummary}</div>
                                )}
                              </td>
                              <td className="p-2 text-sm">
                                {item.total_quantity}
                              </td>
                              <td className="p-2 text-sm">
                                ₹{parseFloat(item.cost_per_item || '0').toFixed(2)}
                              </td>
                              <td className="p-2 text-sm font-semibold">
                                ₹{item.total_cost.toFixed(2)}
                              </td>
                               <td className="p-2">
                                <div className="flex items-center space-x-2">
                                  <button
                                    type="button"
                                    onClick={() => editItem(index)}
                                    className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                    title="Edit"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeItem(index)}
                                    className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex justify-end space-x-4">
                  <div className="text-md font-semibold text-gray-700">
                    Total Items: {items.reduce((sum, item) => sum + item.total_quantity, 0)}
                  </div>
                  <div className="text-xl font-bold text-gray-800">
                    Total Amount: ₹{items.reduce((sum, item) => sum + item.total_cost, 0).toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
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
                </Button>
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
                    <th className="p-4 text-left text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-gray-500">
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
                        <td className="p-4">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handlePreview(order)}
                              className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                              title="Preview"
                            >
                              <Eye className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleEditOrder(order)}
                              className="p-1 text-green-600 hover:text-green-800 hover:bg-green-50 rounded"
                              title="Edit"
                            >
                              <Pencil className="w-5 h-5" />
                            </button>
                          </div>
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
        {isPreviewOpen && selectedOrder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b flex justify-between items-center sticky top-0 bg-white">
                <h3 className="text-xl font-bold text-gray-800">
                  Purchase Order Details - {selectedOrder.po_number}
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
                      <p className="font-bold text-lg text-gray-800">{selectedOrder.vendor?.name}</p>
                      <p className="text-gray-600">Code: {selectedOrder.vendor?.vendor_code}</p>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Order Info</h4>
                    <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Date:</span>
                        <span className="font-medium">{new Date(selectedOrder.order_date).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Status:</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getStatusColor(selectedOrder.status)}`}>
                          {selectedOrder.status}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Items:</span>
                        <span className="font-medium">{selectedOrder.total_items}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Amount:</span>
                        <span className="font-bold text-blue-600">₹{(selectedOrder.total_amount || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {selectedOrder.notes && (
                  <div className="mb-8">
                    <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Notes</h4>
                    <div className="bg-yellow-50 p-4 rounded-lg text-gray-700 border border-yellow-100">
                      {selectedOrder.notes}
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Order Items</h4>
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">#</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">Description</th>
                          <th className="px-4 py-3 text-right font-semibold text-gray-700">Qty</th>
                          <th className="px-4 py-3 text-right font-semibold text-gray-700">Rate</th>
                          <th className="px-4 py-3 text-right font-semibold text-gray-700">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {selectedOrderItems.map((item, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-gray-500">{index + 1}</td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-900">{item.design_no}</div>
                              <div className="text-gray-600 text-xs mt-0.5">{item.product_description}</div>
                            </td>
                            <td className="px-4 py-3 text-right font-medium">{item.quantity}</td>
                            <td className="px-4 py-3 text-right">₹{item.rate.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right font-bold text-gray-800">₹{item.total.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50 border-t">
                        <tr>
                          <td colSpan={2} className="px-4 py-3 text-right font-bold text-gray-700">Grand Total:</td>
                          <td className="px-4 py-3 text-right font-bold text-gray-800">{selectedOrder.total_items}</td>
                          <td className="px-4 py-3"></td>
                          <td className="px-4 py-3 text-right font-bold text-blue-600">₹{(selectedOrder.total_amount || 0).toFixed(2)}</td>
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
    </div>
  );
}
