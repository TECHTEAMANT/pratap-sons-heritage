import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { generateBarcodeForItem } from '../utils/barcode';
import { Barcode as BarcodeIcon, Save, Loader, Upload } from 'lucide-react';

export default function AddItem() {
  const [loading, setLoading] = useState(false);
  const [masters, setMasters] = useState({
    productGroups: [] as any[],
    colors: [] as any[],
    sizes: [] as any[],
    vendors: [] as any[],
    floors: [] as any[],
  });

  const [formData, setFormData] = useState({
    productGroup: '',
    color: '',
    designNo: '',
    vendor: '',
    floor: '',
    gstLogic: 'AUTO_5_18',
    imageUrl: '',
    description: '',
    payoutCode: '',
  });

  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadMasterData();
  }, []);

  const loadMasterData = async () => {
    try {
      const [pgRes, colorRes, sizeRes, vendorRes, floorRes] = await Promise.all([
        supabase.from('product_groups').select('*').order('name'),
        supabase.from('colors').select('*').order('name'),
        supabase.from('sizes').select('*').order('sort_order'),
        supabase.from('vendors').select('*').eq('active', true).order('name'),
        supabase.from('floors').select('*').eq('active', true).order('name'),
      ]);

      setMasters({
        productGroups: pgRes.data || [],
        colors: colorRes.data || [],
        sizes: sizeRes.data || [],
        vendors: vendorRes.data || [],
        floors: floorRes.data || [],
      });
    } catch (err) {
      console.error('Error loading master data:', err);
      setError('Failed to load master data');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image size should be less than 5MB');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, imageUrl: reader.result as string });
        setUploading(false);
      };
      reader.onerror = () => {
        setError('Failed to read image file');
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Error uploading image:', err);
      setError('Failed to upload image');
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.productGroup || !formData.color ||
        !formData.designNo || !formData.vendor || !formData.floor) {
      setError('Please fill in all required fields');
      return;
    }

    const cost = 0;
    const mrp = 0;
    const quantity = 0;

    setLoading(true);

    try {
      const { data: userData } = await supabase.auth.getUser();

      const { data: userRecord } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', userData?.user?.id)
        .maybeSingle();

      const { data: pgData } = await supabase
        .from('product_groups')
        .select('group_code')
        .eq('id', formData.productGroup)
        .maybeSingle();

      const { data: colorData } = await supabase
        .from('colors')
        .select('color_code')
        .eq('id', formData.color)
        .maybeSingle();

      const { data: defaultSize } = await supabase
        .from('sizes')
        .select('id, size_code')
        .order('sort_order')
        .limit(1)
        .maybeSingle();

      const { data: vendorData } = await supabase
        .from('vendors')
        .select('vendor_code')
        .eq('id', formData.vendor)
        .maybeSingle();

      const { data: barcodeNumber } = await supabase.rpc('get_next_barcode_number');

      if (!barcodeNumber) {
        throw new Error('Failed to generate barcode number');
      }

      const mrpMarkup = cost > 0 ? ((mrp - cost) / cost) * 100 : 0;

      const barcodeStructured = `${pgData?.group_code || 'XX'}-${colorData?.color_code || 'XX'}-${defaultSize?.size_code || 'XX'}-${formData.designNo}-${vendorData?.vendor_code || 'XX'}`;

      const batchData = {
        barcode_alias_8digit: barcodeNumber,
        barcode_structured: barcodeStructured,
        design_no: formData.designNo,
        product_group: formData.productGroup,
        color: formData.color,
        size: defaultSize?.id || null,
        vendor: formData.vendor,
        cost_actual: cost,
        mrp: mrp,
        mrp_markup_percent: mrpMarkup,
        gst_logic: formData.gstLogic,
        total_quantity: quantity,
        available_quantity: quantity,
        floor: formData.floor,
        payout_code: formData.payoutCode || null,
        photos: formData.imageUrl ? [formData.imageUrl] : [],
        description: formData.description || '',
        status: 'active',
        created_by: userRecord?.id || null,
      };

      const { error: insertError } = await supabase
        .from('barcode_batches')
        .insert([batchData]);

      if (insertError) throw insertError;

      setSuccess(`Inventory item created successfully! Barcode: ${barcodeNumber}`);

      setFormData({
        productGroup: formData.productGroup,
        color: '',
        designNo: '',
        vendor: formData.vendor,
        floor: formData.floor,
        gstLogic: 'AUTO_5_18',
        imageUrl: '',
        description: '',
        payoutCode: '',
      });
    } catch (err: any) {
      console.error('Error adding item:', err);
      setError(err.message || 'Failed to add inventory item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="flex items-center mb-8">
          <BarcodeIcon className="w-8 h-8 text-blue-600 mr-3" />
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Add Inventory Item</h2>
            <p className="text-sm text-gray-600 mt-1">Create inventory item with barcode - will appear immediately in Inventory tab</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Product Group <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.productGroup}
                onChange={(e) => setFormData({ ...formData, productGroup: e.target.value })}
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
                Design Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.designNo}
                onChange={(e) => setFormData({ ...formData, designNo: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="DN458"
                required
              />
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
                Floor <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.floor}
                onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
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
                Payout Code
              </label>
              <input
                type="text"
                value={formData.payoutCode}
                onChange={(e) => setFormData({ ...formData, payoutCode: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Optional payout code"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                GST Logic <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.gstLogic}
                onChange={(e) => setFormData({ ...formData, gstLogic: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="AUTO_5_18">AUTO (5% if &lt;2500, else 18%)</option>
                <option value="FLAT_5">FLAT 5%</option>
              </select>
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
              placeholder="Enter item description (optional)"
              rows={3}
            />
            <p className="text-xs text-gray-500 mt-1">Optional: Add a detailed description for this item</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Product Image
            </label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.imageUrl ? 'Image uploaded' : ''}
                  readOnly
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  placeholder="No image selected"
                />
                <label className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer flex items-center disabled:opacity-50">
                  {uploading ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin" />
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5 mr-2" />
                      Upload
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>
              </div>
              {formData.imageUrl && (
                <div className="relative w-32 h-32 border border-gray-300 rounded-lg overflow-hidden">
                  <img
                    src={formData.imageUrl}
                    alt="Product preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">Optional: Upload product image (max 5MB)</p>
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
                  Adding Item...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5 mr-2" />
                  Add Item
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
