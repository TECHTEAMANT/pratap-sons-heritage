import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Package, Search, Image as ImageIcon, RefreshCw, Edit2, X, Save } from 'lucide-react';

interface GroupedItem {
  design_no: string;
  vendor_name: string;
  vendor_code: string;
  vendor_id: string;
  product_group_name: string;
  product_group_id: string;
  color_name: string;
  color_id: string;
  description: string;
  images: string[];
  sizes: Array<{
    batch_id: string;
    size_id: string;
    size_name: string;
    barcode_8digit: string;
    available: number;
    total: number;
    floor_name: string;
    floor_id: string;
    defective_qty: number;
  }>;
  total_available: number;
  total_quantity: number;
  total_defective: number;
  mrp: number;
  cost: number;
  order_number: string | null;
  gst_logic: string;
  mrp_markup_percent: number;
}

export default function Inventory() {
  const [groupedItems, setGroupedItems] = useState<GroupedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<GroupedItem | null>(null);
  const [floors, setFloors] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadInventory();
  }, []);

  const loadInventory = async () => {
    setLoading(true);

    try {
      const [batchesRes, defectiveRes, floorsRes] = await Promise.all([
        supabase
          .from('barcode_batches')
          .select(`
            *,
            product_group:product_groups(id, name, group_code),
            color:colors(id, name, color_code),
            size:sizes(id, name, size_code),
            vendor:vendors(id, name, vendor_code),
            floor:floors(id, name, floor_code)
          `)
          .eq('status', 'active')
          .order('created_at', { ascending: false }),
        supabase
          .from('defective_stock')
          .select('*'),
        supabase
          .from('floors')
          .select('*')
          .eq('active', true)
      ]);

      if (batchesRes.error) throw batchesRes.error;

      setFloors(floorsRes.data || []);
      const grouped = groupItemsByDesignVendor(batchesRes.data || [], defectiveRes.data || []);
      setGroupedItems(grouped);
    } catch (error) {
      console.error('Error loading inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupItemsByDesignVendor = (items: any[], defectiveItems: any[]): GroupedItem[] => {
    const groupMap: { [key: string]: any } = {};

    items.forEach((item) => {
      const key = `${item.design_no}-${item.vendor?.vendor_code || 'UNKNOWN'}-${item.product_group?.id}-${item.color?.id}`;

      if (!groupMap[key]) {
        groupMap[key] = {
          design_no: item.design_no,
          vendor_name: item.vendor?.name || 'Unknown',
          vendor_code: item.vendor?.vendor_code || '',
          vendor_id: item.vendor?.id || '',
          product_group_name: item.product_group?.name || '',
          product_group_id: item.product_group?.id || '',
          color_name: item.color?.name || '',
          color_id: item.color?.id || '',
          description: item.description || '',
          images: item.photos || [],
          sizes: {},
          total_available: 0,
          total_quantity: 0,
          total_defective: 0,
          mrp: item.mrp,
          cost: item.cost_actual,
          order_number: item.order_number,
          gst_logic: item.gst_logic,
          mrp_markup_percent: item.mrp_markup_percent || 100,
        };
      }

      const sizeName = item.size?.name || 'Unknown';
      const sizeKey = item.size?.id || sizeName;

      if (!groupMap[key].sizes[sizeKey]) {
        groupMap[key].sizes[sizeKey] = {
          batch_id: item.id,
          size_id: item.size?.id || '',
          size_name: sizeName,
          barcode_8digit: item.barcode_alias_8digit,
          available: 0,
          total: 0,
          floor_name: item.floor?.name || 'Unassigned',
          floor_id: item.floor?.id || '',
          defective_qty: 0,
        };
      }

      groupMap[key].sizes[sizeKey].available += item.available_quantity || 0;
      groupMap[key].sizes[sizeKey].total += item.total_quantity || 0;
      groupMap[key].total_available += item.available_quantity || 0;
      groupMap[key].total_quantity += item.total_quantity || 0;

      const defectiveForBarcode = defectiveItems.filter(d => d.barcode === item.barcode_alias_8digit);
      const defectiveQty = defectiveForBarcode.reduce((sum, d) => sum + (d.quantity || 0), 0);
      groupMap[key].sizes[sizeKey].defective_qty += defectiveQty;
      groupMap[key].total_defective += defectiveQty;

      if (item.photos && item.photos.length > 0 && groupMap[key].images.length === 0) {
        groupMap[key].images = item.photos;
      }
    });

    return Object.values(groupMap).map((group) => ({
      ...group,
      sizes: Object.values(group.sizes).sort((a: any, b: any) =>
        a.size_name.localeCompare(b.size_name)
      ),
    }));
  };

  const handleEditItem = (item: GroupedItem) => {
    setEditingItem(item);
    setError('');
    setSuccess('');
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;

    setSaving(true);
    setError('');

    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data: userRecord } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', userData?.user?.id)
        .maybeSingle();

      for (const size of editingItem.sizes) {
        await supabase
          .from('barcode_batches')
          .update({
            design_no: editingItem.design_no,
            cost_actual: editingItem.cost,
            mrp: editingItem.mrp,
            mrp_markup_percent: editingItem.mrp_markup_percent,
            gst_logic: editingItem.gst_logic,
            description: editingItem.description,
            floor: size.floor_id || null,
            modified_by: userRecord?.id || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', size.batch_id);
      }

      setSuccess('Inventory updated successfully!');
      setEditingItem(null);
      await loadInventory();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('Error updating inventory:', err);
      setError(err.message || 'Failed to update inventory');
    } finally {
      setSaving(false);
    }
  };

  const filteredItems = groupedItems.filter((item) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      item.design_no.toLowerCase().includes(searchLower) ||
      item.product_group_name.toLowerCase().includes(searchLower) ||
      item.color_name.toLowerCase().includes(searchLower) ||
      item.vendor_name.toLowerCase().includes(searchLower) ||
      item.vendor_code.toLowerCase().includes(searchLower) ||
      item.description.toLowerCase().includes(searchLower) ||
      (item.order_number && item.order_number.toLowerCase().includes(searchLower))
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Package className="w-8 h-8 text-emerald-600 mr-3" />
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Inventory</h1>
            <p className="text-sm text-gray-600">Real-time stock from barcode batches</p>
          </div>
        </div>
        <button
          onClick={loadInventory}
          className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 transition flex items-center shadow-md"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Search by design, vendor, product, color, order number..."
            />
          </div>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-600">
            Showing <span className="font-bold text-emerald-700">{filteredItems.length}</span> unique items • Total Available: <span className="font-bold text-emerald-700">{filteredItems.reduce((sum, item) => sum + item.total_available, 0)}</span>
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredItems.map((item, idx) => (
              <div
                key={`${item.design_no}-${item.vendor_code}-${idx}`}
                className={`border-2 rounded-lg p-4 hover:shadow-lg transition ${
                  item.total_defective > 0
                    ? 'border-red-400 bg-red-50 hover:border-red-500'
                    : 'border-gray-200 hover:border-emerald-300'
                }`}
              >
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-32 h-32 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                    {item.images && item.images.length > 0 ? (
                      <img
                        src={item.images[0]}
                        alt={item.design_no}
                        className="w-full h-full object-cover cursor-pointer hover:opacity-80"
                        onClick={() => setSelectedImage(item.images[0])}
                        onError={(e) => {
                          e.currentTarget.src = '';
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.parentElement!.innerHTML = '<div class="text-gray-400"><svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg></div>';
                        }}
                      />
                    ) : (
                      <div className="text-gray-400">
                        <ImageIcon className="w-12 h-12" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-xl font-bold text-gray-800">{item.design_no}</h3>
                        <p className="text-sm text-gray-600 font-medium">
                          {item.product_group_name} • {item.color_name}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Vendor: <span className="font-semibold">{item.vendor_name}</span> ({item.vendor_code})
                        </p>
                        {item.order_number && (
                          <p className="text-xs text-orange-600 font-semibold mt-1">
                            Order: {item.order_number}
                          </p>
                        )}
                        {item.description && (
                          <p className="text-sm text-gray-500 mt-1">{item.description}</p>
                        )}
                      </div>
                      <div className="text-right flex flex-col items-end gap-2">
                        <button
                          onClick={() => handleEditItem(item)}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center text-sm shadow-md transition"
                        >
                          <Edit2 className="w-4 h-4 mr-1" />
                          Edit
                        </button>
                        <div>
                          <p className="text-xl font-bold text-emerald-700">₹{item.mrp?.toFixed(2)}</p>
                          <p className="text-xs text-gray-500">Cost: ₹{item.cost?.toFixed(2)}</p>
                          <p className="text-xs font-semibold text-purple-600 mt-1">
                            Profit: ₹{(item.mrp - item.cost).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                      <div>
                        <p className="text-xs font-medium text-gray-600 mb-1">Stock Summary</p>
                        <div className="flex gap-3 flex-wrap">
                          <div className="flex items-center">
                            <span className="w-3 h-3 bg-emerald-500 rounded-full mr-1"></span>
                            <span className="text-sm">
                              <span className="font-bold text-emerald-700">{item.total_available}</span> Available
                            </span>
                          </div>
                          <div className="flex items-center">
                            <span className="text-sm font-semibold text-gray-700">
                              Total: {item.total_quantity}
                            </span>
                          </div>
                          {item.total_defective > 0 && (
                            <div className="flex items-center">
                              <span className="w-3 h-3 bg-red-500 rounded-full mr-1"></span>
                              <span className="text-sm">
                                <span className="font-bold text-red-700">{item.total_defective}</span> Defective
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-2">Size Breakdown (Available/Total) • 8-Digit Code</p>
                      <div className="flex flex-wrap gap-2">
                        {item.sizes.map((size: any, sizeIdx: number) => (
                          <div
                            key={`${size.barcode_8digit}-${sizeIdx}`}
                            className={`px-3 py-2 rounded-lg border-2 ${
                              size.defective_qty > 0
                                ? 'border-red-400 bg-red-100'
                                : size.available > 0
                                ? 'border-emerald-300 bg-emerald-50'
                                : 'border-gray-300 bg-gray-50'
                            }`}
                          >
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold">{size.size_name}:</span>
                                <span className={`text-sm ${size.available > 0 ? 'text-emerald-700 font-bold' : 'text-gray-500'}`}>
                                  {size.available}/{size.total}
                                </span>
                                {size.defective_qty > 0 && (
                                  <span className="text-sm text-red-700 font-bold">
                                    ({size.defective_qty} defective)
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-600 mt-1">
                                <span className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-2 py-0.5 rounded font-mono font-semibold">
                                  {size.barcode_8digit}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500 mt-0.5">
                                Floor: {size.floor_name}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {filteredItems.length === 0 && (
              <div className="py-12 text-center text-gray-500">
                <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg">No items found</p>
                <p className="text-sm">Purchase items will appear here automatically</p>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="max-w-4xl max-h-full">
            <img
              src={selectedImage}
              alt="Product"
              className="max-w-full max-h-full object-contain rounded-lg"
            />
          </div>
        </div>
      )}

      {editingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 flex justify-between items-center">
              <h3 className="text-2xl font-bold text-white">Edit Inventory Item</h3>
              <button
                onClick={() => setEditingItem(null)}
                className="text-white hover:text-gray-200"
              >
                <X className="w-8 h-8" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Design Number</label>
                  <input
                    type="text"
                    value={editingItem.design_no}
                    onChange={(e) => setEditingItem({ ...editingItem, design_no: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Cost per Item</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingItem.cost === 0 ? '' : editingItem.cost}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditingItem({ ...editingItem, cost: val === '' ? 0 : parseFloat(val) || 0 });
                    }}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">MRP Markup %</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingItem.mrp_markup_percent === 0 ? '' : editingItem.mrp_markup_percent}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditingItem({ ...editingItem, mrp_markup_percent: val === '' ? 0 : parseFloat(val) || 0 });
                    }}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">MRP</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingItem.mrp === 0 ? '' : editingItem.mrp}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditingItem({ ...editingItem, mrp: val === '' ? 0 : parseFloat(val) || 0 });
                    }}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">GST Logic</label>
                  <select
                    value={editingItem.gst_logic}
                    onChange={(e) => setEditingItem({ ...editingItem, gst_logic: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="AUTO_5_18">AUTO (5% if &lt;2500, else 18%)</option>
                    <option value="FLAT_5">FLAT 5%</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Product Group</label>
                  <input
                    type="text"
                    value={editingItem.product_group_name}
                    disabled
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg bg-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                  <input
                    type="text"
                    value={editingItem.color_name}
                    disabled
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg bg-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Vendor</label>
                  <input
                    type="text"
                    value={`${editingItem.vendor_name} (${editingItem.vendor_code})`}
                    disabled
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg bg-gray-100"
                  />
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={editingItem.description}
                  onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>

              <div className="mb-6">
                <h4 className="font-bold text-gray-800 mb-3">Floor Assignment by Size</h4>
                <div className="grid grid-cols-2 gap-4">
                  {editingItem.sizes.map((size, idx) => (
                    <div key={idx} className="border-2 border-gray-200 rounded-lg p-3">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {size.size_name} (Stock: {size.total})
                      </label>
                      <select
                        value={size.floor_id || ''}
                        onChange={(e) => {
                          const updatedSizes = [...editingItem.sizes];
                          updatedSizes[idx] = {
                            ...updatedSizes[idx],
                            floor_id: e.target.value,
                            floor_name: floors.find(f => f.id === e.target.value)?.name || 'Unassigned'
                          };
                          setEditingItem({ ...editingItem, sizes: updatedSizes });
                        }}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Unassigned</option>
                        {floors.map(floor => (
                          <option key={floor.id} value={floor.id}>{floor.name}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-4 border-2 border-red-200">
                  {error}
                </div>
              )}

              {success && (
                <div className="bg-green-50 text-green-600 p-4 rounded-lg mb-4 border-2 border-green-200">
                  {success}
                </div>
              )}
            </div>

            <div className="bg-gray-50 p-6 flex justify-end gap-4">
              <button
                onClick={() => setEditingItem(null)}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 flex items-center shadow-lg transition"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5 mr-2" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
