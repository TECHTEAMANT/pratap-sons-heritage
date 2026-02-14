import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Edit, Save, Loader, Search, Scan } from 'lucide-react';

export default function InventoryEdit() {
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [itemData, setItemData] = useState<any>(null);
  const [masters, setMasters] = useState({
    productGroups: [] as any[],
    colors: [] as any[],
    sizes: [] as any[],
    vendors: [] as any[],
    floors: [] as any[],
    discounts: [] as any[],
  });
  const [formData, setFormData] = useState({
    design_no: '',
    product_group: '',
    color: '',
    size: '',
    vendor: '',
    cost: '',
    mrp: '',
    floor: '',
    discount_code: '',
    gst_logic: 'AUTO_5_18',
    payout_code: '',
    notes: '',
    description: '',
  });
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadMasterData();
  }, []);

  const loadMasterData = async () => {
    try {
      const [pgRes, colorRes, sizeRes, vendorRes, floorRes, discountRes] = await Promise.all([
        supabase.from('product_groups').select('*').order('name'),
        supabase.from('colors').select('*').order('name'),
        supabase.from('sizes').select('*').order('sort_order'),
        supabase.from('vendors').select('*').eq('active', true).order('name'),
        supabase.from('floors').select('*').eq('active', true).order('name'),
        supabase.from('discount_master').select('*').eq('active_flag', true).order('discount_code'),
      ]);

      setMasters({
        productGroups: pgRes.data || [],
        colors: colorRes.data || [],
        sizes: sizeRes.data || [],
        vendors: vendorRes.data || [],
        floors: floorRes.data || [],
        discounts: discountRes.data || [],
      });
    } catch (err) {
      console.error('Error loading master data:', err);
      setError('Failed to load master data');
    }
  };

  const searchByBarcode = async () => {
    if (!barcode.trim()) {
      setError('Please enter a barcode');
      return;
    }

    setSearching(true);
    setError('');
    setItemData(null);

    try {
      const { data, error } = await supabase
        .from('barcode_batches')
        .select(`
          *,
          product_group:product_groups(id, name, group_code),
          color:colors(id, name, color_code),
          size:sizes(id, name, size_code),
          vendor:vendors(id, name, vendor_code),
          floor:floors(id, name, floor_code)
        `)
        .eq('barcode_alias_8digit', barcode)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setError('Item not found with this barcode');
        return;
      }

      setItemData(data);
      setFormData({
        design_no: data.design_no || '',
        product_group: data.product_group?.id || '',
        color: data.color?.id || '',
        size: data.size?.id || '',
        vendor: data.vendor?.id || '',
        cost: data.cost_actual?.toString() || '',
        mrp: data.mrp?.toString() || '',
        floor: data.floor?.id || '',
        discount_code: '',
        gst_logic: data.gst_logic || 'AUTO_5_18',
        payout_code: data.payout_code || '',
        notes: '',
        description: data.description || '',
      });
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

    if (!itemData) {
      setError('Please search for an item first');
      return;
    }

    setLoading(true);

    try {
      const updateData: any = {
        design_no: formData.design_no,
        product_group: formData.product_group,
        color: formData.color,
        size: formData.size,
        vendor: formData.vendor,
        cost_actual: parseFloat(formData.cost),
        mrp: parseFloat(formData.mrp),
        floor: formData.floor || null,
        gst_logic: formData.gst_logic,
        payout_code: formData.payout_code || null,
        description: formData.description || null,
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from('barcode_batches')
        .update(updateData)
        .eq('id', itemData.id);

      if (updateError) throw updateError;

      setSuccess(`Inventory item ${barcode} updated successfully!`);

      setTimeout(() => {
        setBarcode('');
        setItemData(null);
        setFormData({
          design_no: '',
          product_group: '',
          color: '',
          size: '',
          vendor: '',
          cost: '',
          mrp: '',
          floor: '',
          discount_code: '',
          gst_logic: 'AUTO_5_18',
          payout_code: '',
          notes: '',
          description: '',
        });
        setSuccess('');
      }, 3000);
    } catch (err: any) {
      console.error('Error updating item:', err);
      setError(err.message || 'Failed to update inventory item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="flex items-center mb-8">
          <Edit className="w-8 h-8 text-blue-600 mr-3" />
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Edit Inventory Details</h2>
            <p className="text-sm text-gray-600 mt-1">Scan barcode to load and edit item details</p>
          </div>
        </div>

        <div className="mb-8">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Scan or Enter Barcode <span className="text-red-500">*</span>
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

        {itemData && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-gray-800 mb-2">Current Item Status</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Barcode (8-Digit)</p>
                  <p className="font-medium">{itemData.barcode_alias_8digit}</p>
                </div>
                <div>
                  <p className="text-gray-600">Available Quantity</p>
                  <p className="font-medium">{itemData.available_quantity} / {itemData.total_quantity}</p>
                </div>
                <div>
                  <p className="text-gray-600">Status</p>
                  <p className="font-medium capitalize">{itemData.status}</p>
                </div>
                <div>
                  <p className="text-gray-600">Last Updated</p>
                  <p className="font-medium">{new Date(itemData.updated_at).toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Design Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.design_no}
                  onChange={(e) => setFormData({ ...formData, design_no: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Product Group <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.product_group}
                  onChange={(e) => setFormData({ ...formData, product_group: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Product Group</option>
                  {masters.productGroups.map((pg) => (
                    <option key={pg.id} value={pg.id}>
                      {pg.name} ({pg.group_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Color</option>
                  {masters.colors.map((color) => (
                    <option key={color.id} value={color.id}>
                      {color.name} ({color.color_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Size <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.size}
                  onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Size</option>
                  {masters.sizes.map((size) => (
                    <option key={size.id} value={size.id}>
                      {size.name} ({size.size_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vendor <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.vendor}
                  onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Vendor</option>
                  {masters.vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.name} ({vendor.vendor_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Floor
                </label>
                <select
                  value={formData.floor}
                  onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Floor</option>
                  {masters.floors.map((floor) => (
                    <option key={floor.id} value={floor.id}>
                      {floor.name} ({floor.floor_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cost <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.cost}
                  onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  MRP <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.mrp}
                  onChange={(e) => setFormData({ ...formData, mrp: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Discount Code
                </label>
                <select
                  value={formData.discount_code}
                  onChange={(e) => setFormData({ ...formData, discount_code: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">No Discount</option>
                  {masters.discounts.map((discount) => (
                    <option key={discount.id} value={discount.id}>
                      {discount.discount_code} ({discount.discount_type}: {discount.value})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  GST Logic <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.gst_logic}
                  onChange={(e) => setFormData({ ...formData, gst_logic: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="AUTO_5_18">AUTO (5% if &lt;2500, else 18%)</option>
                  <option value="FLAT_5">FLAT 5%</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payout Code
                </label>
                <input
                  type="text"
                  value={formData.payout_code}
                  onChange={(e) => setFormData({ ...formData, payout_code: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Optional payout code"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Item description"
                rows={2}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Additional notes"
                rows={2}
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
                disabled={loading}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition flex items-center"
              >
                {loading ? (
                  <>
                    <Loader className="w-5 h-5 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5 mr-2" />
                    Update Inventory
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
