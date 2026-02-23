import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Barcode as BarcodeIcon, Save, Loader, Upload, X } from 'lucide-react';
import VendorAddModal from './VendorAddModal';

export default function AddItem() {
  const [loading, setLoading] = useState(false);
  const [masters, setMasters] = useState({
    productGroups: [] as any[],
    colors: [] as any[],
    sizes: [] as any[],
    vendors: [] as any[],
    floors: [] as any[],
  });

  const MAX_PHOTOS = 3;

  const [formData, setFormData] = useState({
    productGroup: '',
    color: '',
    designNo: '',
    vendor: '',
    floor: '',
    gstLogic: 'AUTO_5_18',
    imageUrls: [] as string[],
    description: '',
    payoutCode: '',
    barcodesPerItem: 1,
    hsnCode: '',
  });

  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const hiddenCameraInputRef = useRef<HTMLInputElement | null>(null);
  const lastAutoFilledHsn = useRef<string>('');

  useEffect(() => {
    loadMasterData();
  }, []);

  useEffect(() => {
    if (formData.productGroup) {
      const group = masters.productGroups.find(g => g.id === formData.productGroup);
      if (group) {
        setFormData(prev => {
          const skipAutoFill = prev.hsnCode && prev.hsnCode !== lastAutoFilledHsn.current;
          const newHsn = (skipAutoFill ? prev.hsnCode : group.hsn_code) || '';
          if (!skipAutoFill) {
            lastAutoFilledHsn.current = group.hsn_code || '';
          }
          return { 
            ...prev, 
            floor: group.floor_id || prev.floor,
            hsnCode: newHsn
          };
        });
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

    if (formData.imageUrls.length >= MAX_PHOTOS) {
      setError(`You can add up to ${MAX_PHOTOS} photos only`);
      return;
    }

    setUploading(true);
    setError('');

    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, imageUrls: [...prev.imageUrls, reader.result as string] }));
        setUploading(false);
      };
      reader.onerror = () => {
        setError('Failed to read image file');
        setUploading(false);
      };
      reader.readAsDataURL(file);
      // Reset so same file can be re-selected
      e.target.value = '';
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
    if (formData.imageUrls.length >= MAX_PHOTOS) {
      setError(`You can add up to ${MAX_PHOTOS} photos only`);
      closeCamera();
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      setFormData(prev => ({ ...prev, imageUrls: [...prev.imageUrls, dataUrl] }));
    }
    closeCamera();
  };

  const removeImage = (idx: number) => {
    setFormData(prev => ({ ...prev, imageUrls: prev.imageUrls.filter((_, i) => i !== idx) }));
    setError('');
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
        !formData.designNo || !formData.vendor) {
      setError('Please fill in all required fields');
      return;
    }
    if (formData.imageUrls.length === 0) {
      setError('At least one product photo is required');
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
        floor: formData.floor || null,
        photos: formData.imageUrls,
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
        imageUrls: [],
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
                onChange={(e) => {
                  if (e.target.value === 'ADD_NEW') {
                    setShowVendorModal(true);
                  } else {
                    setFormData({ ...formData, vendor: e.target.value });
                  }
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select Vendor</option>
                <option value="ADD_NEW" className="font-bold text-blue-600">+ Add New Vendor...</option>
                {masters.vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name} ({vendor.vendor_code})
                  </option>
                ))}
              </select>

              <VendorAddModal
                isOpen={showVendorModal}
                onClose={() => setShowVendorModal(false)}
                onSuccess={(newVendor) => {
                  setMasters(prev => ({
                    ...prev,
                    vendors: [...prev.vendors, newVendor].sort((a, b) => a.name.localeCompare(b.name))
                  }));
                  setFormData(prev => ({ ...prev, vendor: newVendor.id }));
                  setShowVendorModal(false);
                }}
              />
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
                <option value="">Select Floor (Optional)</option>
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
              onChange={(e) => setFormData({ ...formData, hsnCode: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Auto-filled from Product Group"
            />
            <p className="text-xs text-gray-500 mt-1">Populated from product group, but can be manually changed if needed</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Product Photos <span className="text-red-500">*</span>
              <span className="text-gray-400 font-normal ml-1">({formData.imageUrls.length}/{MAX_PHOTOS})</span>
            </label>
            <div className="space-y-3">
              {/* Thumbnails of added photos */}
              {formData.imageUrls.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {formData.imageUrls.map((url, idx) => (
                    <div key={idx} className="relative w-28 h-28 border border-gray-300 rounded-lg overflow-hidden flex-shrink-0">
                      <img
                        src={url}
                        alt={`Product photo ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        title="Remove photo"
                        className="absolute top-1 right-1 p-1 bg-white/80 rounded-full shadow hover:bg-white"
                      >
                        <X className="w-4 h-4 text-gray-700" />
                      </button>
                      <span className="absolute bottom-1 left-1 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded">{idx + 1}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Add photo controls — hidden when limit reached */}
              {formData.imageUrls.length < MAX_PHOTOS && (
                <div className="flex gap-2">
                  <label className={`px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer flex items-center ${uploading ? 'opacity-70 pointer-events-none' : ''}`}>
                    {uploading ? (
                      <Loader className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Upload className="w-5 h-5 mr-2" />
                        Upload Photo
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
              )}

              {cameraError && (
                <div className="text-red-600 text-sm">{cameraError}</div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">Required: at least 1 photo. Up to {MAX_PHOTOS} photos, max 5MB each.</p>
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
