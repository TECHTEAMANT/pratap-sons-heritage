import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Barcode as BarcodeIcon, Save, Loader, Upload, X } from 'lucide-react';

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
    barcodesPerItem: 1,
    hsnCode: '',
  });

  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const hiddenCameraInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadMasterData();
  }, []);

  useEffect(() => {
    if (formData.productGroup) {
      const group = masters.productGroups.find(g => g.id === formData.productGroup);
      if (group) {
        setFormData(prev => ({ 
          ...prev, 
          floor: group.floor_id || prev.floor,
          hsnCode: group.hsn_code || ''
        }));
      }
    }
  }, [formData.productGroup, masters.productGroups]);

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

  const openCamera = async () => {
    setCameraError('');
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not supported by this browser');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
    } catch (err) {
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
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      setFormData(prev => ({ ...prev, imageUrl: dataUrl }));
    }
    closeCamera();
  };

  const clearImage = () => {
    setFormData(prev => ({ ...prev, imageUrl: '' }));
    setError('');
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

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.productGroup ||
        !formData.designNo || !formData.vendor || !formData.floor) {
      setError('Please fill in all required fields');
      return;
    }
    if (!formData.imageUrl) {
      setError('Product image is required');
      return;
    }

    const mrp = 0;

    setLoading(true);

    try {
      const { data: userData } = await supabase.auth.getUser();

      const { data: userRecord } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', userData?.user?.id)
        .maybeSingle();

      // Check for duplicate design_no + vendor before inserting
      const { data: existingMaster } = await supabase
        .from('product_masters')
        .select('id')
        .eq('design_no', formData.designNo)
        .eq('vendor', formData.vendor)
        .maybeSingle();

      if (existingMaster) {
        throw new Error('This design number already exists for the selected vendor.');
      }

      const masterData = {
        design_no: formData.designNo,
        product_group: formData.productGroup,
        color: formData.color || null,
        vendor: formData.vendor,
        mrp: mrp,
        gst_logic: formData.gstLogic,
        floor: formData.floor,
        photos: formData.imageUrl ? [formData.imageUrl] : [],
        description: formData.description || '',
        barcodes_per_item: formData.barcodesPerItem,
        payout_code: formData.payoutCode,
        hsn_code: formData.hsnCode,
        created_by: userRecord?.id || null,
      };

      const { error: insertError } = await supabase
        .from('product_masters')
        .insert([masterData]);

      if (insertError) {
        if (insertError.code === '23505') {
          throw new Error('This design number already exists for the selected vendor');
        }
        throw insertError;
      }

      setSuccess('Product Master created successfully! You can now use this design in Purchase Invoice.');

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
        barcodesPerItem: 1,
        hsnCode: '',
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
                Color
              </label>
              <select
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                Barcodes per Item
              </label>
              <input
                type="number"
                min="1"
                value={formData.barcodesPerItem || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  barcodesPerItem: e.target.value === '' ? ('' as any) : (parseInt(e.target.value) || 1),
                })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Default number of labels to print for this design</p>
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
              Payout Code
            </label>
            <input
              type="text"
              value={formData.payoutCode}
              onChange={(e) => setFormData({ ...formData, payoutCode: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Enter Payout Code"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              HSN Code
            </label>
            <input
              type="text"
              value={formData.hsnCode}
              readOnly
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
              placeholder="Auto-filled from Product Group"
            />
            <p className="text-xs text-gray-500 mt-1">Populated automatically when product group is selected</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Product Image <span className="text-red-500">*</span>
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
                <button
                  type="button"
                  onClick={openCamera}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center disabled:opacity-50"
                  disabled={uploading}
                >
                  {uploading ? (
                    <Loader className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Upload className="w-5 h-5 mr-2" />
                      Take Photo
                    </>
                  )}
                </button>
                <input
                  ref={hiddenCameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={uploading}
                />
              </div>
              {formData.imageUrl && (
                <div className="relative w-32 h-32 border border-gray-300 rounded-lg overflow-hidden">
                  <img
                    src={formData.imageUrl}
                    alt="Product preview"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={clearImage}
                    title="Remove image"
                    className="absolute top-1 right-1 p-1 bg-white/80 rounded-full shadow hover:bg-white"
                  >
                    <X className="w-4 h-4 text-gray-700" />
                  </button>
                </div>
              )}
              {cameraError && (
                <div className="text-red-600 text-sm">{cameraError}</div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">Required: Upload or capture a product image (max 5MB)</p>
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
      {cameraOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-4 w-[92vw] max-w-md">
            <div className="aspect-video bg-black rounded overflow-hidden">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            </div>
            <div className="mt-3 flex gap-3 justify-center">
              <button
                type="button"
                onClick={capturePhoto}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              >
                Capture
              </button>
              <button
                type="button"
                onClick={closeCamera}
                className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
