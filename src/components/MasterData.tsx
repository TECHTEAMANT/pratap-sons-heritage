import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Database, Plus, Edit2, Save, X, Loader } from 'lucide-react';
import DiscountManagement from './DiscountManagement';
import PayoutCodeManagement from './PayoutCodeManagement';
import CommissionSlabManagement from './CommissionSlabManagement';

type MasterType = 'productGroups' | 'colors' | 'sizes' | 'vendors' | 'floors' | 'cities' | 'discounts' | 'payoutCodes' | 'commissionSlabs';

export default function MasterData() {
  const [activeTab, setActiveTab] = useState<MasterType>('productGroups');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [cities, setCities] = useState<any[]>([]);
  const [floors, setFloors] = useState<any[]>([]);

  const tabs = [
    { id: 'productGroups', label: 'Product Groups', table: 'product_groups' },
    { id: 'colors', label: 'Colors', table: 'colors' },
    { id: 'sizes', label: 'Sizes', table: 'sizes' },
    { id: 'vendors', label: 'Vendors', table: 'vendors' },
    { id: 'floors', label: 'Floors', table: 'floors' },
    { id: 'cities', label: 'Cities', table: 'cities' },
    { id: 'discounts', label: 'Discounts', table: 'discount_masters' },
    { id: 'payoutCodes', label: 'Payout Codes', table: 'payout_codes' },
    { id: 'commissionSlabs', label: 'Commission Slabs', table: 'commission_slabs' },
  ];

  useEffect(() => {
    setError('');
    setSuccess('');
    loadData();
    if (activeTab === 'vendors') {
      loadCities();
    }
    if (activeTab === 'productGroups') {
      loadFloors();
    }
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const currentTab = tabs.find(t => t.id === activeTab);
      if (!currentTab) return;

      let query = supabase
        .from(currentTab.table)
        .select('*')
        .order('created_at', { ascending: false });

      if (currentTab.id === 'vendors') {
        query = supabase
          .from(currentTab.table)
          .select('*, cities:city_id(name, city_code)')
          .order('created_at', { ascending: false });
      }

      if (currentTab.id === 'productGroups') {
        query = supabase
          .from(currentTab.table)
          .select('*, floors:floor_id(name, floor_code)')
          .order('created_at', { ascending: false });
      }

      const { data: result, error } = await query;

      if (error) throw error;
      setData(result || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadCities = async () => {
    try {
      const { data: citiesData, error } = await supabase
        .from('cities')
        .select('*')
        .eq('active', true)
        .order('name');

      if (error) throw error;
      setCities(citiesData || []);
    } catch (err) {
      console.error('Error loading cities:', err);
    }
  };

  const loadFloors = async () => {
    try {
      const { data: floorsData, error } = await supabase
        .from('floors')
        .select('*')
        .eq('active', true)
        .order('name');

      if (error) throw error;
      setFloors(floorsData || []);
    } catch (err) {
      console.error('Error loading floors:', err);
    }
  };

  const generateVendorCode = async (cityId: string) => {
    try {
      const city = cities.find(c => c.id === cityId);
      if (!city) return '';

      const { data: existingVendors, error } = await supabase
        .from('vendors')
        .select('vendor_code')
        .eq('city_id', cityId)
        .order('vendor_code', { ascending: false })
        .limit(1);

      if (error) throw error;

      let nextNumber = 1;
      if (existingVendors && existingVendors.length > 0) {
        const lastCode = existingVendors[0].vendor_code;
        // Extract numeric part based on the length of the city code
        const numberPart = lastCode.slice(city.city_code.length);
        nextNumber = parseInt(numberPart) + 1;
      }

      const vendorCode = `${city.city_code}${String(nextNumber).padStart(2, '0')}`;
      return vendorCode;
    } catch (err) {
      console.error('Error generating vendor code:', err);
      return '';
    }
  };

  const handleCityChange = async (cityId: string) => {
    const vendorCode = await generateVendorCode(cityId);
    setFormData({ ...formData, city_id: cityId, vendor_code: vendorCode });
  };

  const handleAdd = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const currentTab = tabs.find(t => t.id === activeTab);
      if (!currentTab) return;

      const { error } = await supabase
        .from(currentTab.table)
        .insert([formData]);

      if (error) throw error;

      setSuccess('Added successfully!');
      setFormData({});
      setShowAddForm(false);
      loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id: string) => {
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const currentTab = tabs.find(t => t.id === activeTab);
      if (!currentTab) return;

      const { error } = await supabase
        .from(currentTab.table)
        .update(formData)
        .eq('id', id);

      if (error) throw error;

      setSuccess('Updated successfully!');
      setEditingId(null);
      setFormData({});
      loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderFormFields = () => {
    switch (activeTab) {
      case 'productGroups':
        return (
          <>
            <input
              type="text"
              placeholder="Group Code (e.g., KRT)"
              value={formData.group_code || ''}
              onChange={(e) => setFormData({ ...formData, group_code: e.target.value })}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              required
            />
            <input
              type="text"
              placeholder="Name (e.g., Kurtis)"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              required
            />
            <input
              type="text"
              placeholder="HSN Code (optional)"
              value={formData.hsn_code || ''}
              onChange={(e) => setFormData({ ...formData, hsn_code: e.target.value })}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
            <select
              value={formData.floor_id || ''}
              onChange={(e) => setFormData({ ...formData, floor_id: e.target.value })}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Select Floor (optional)</option>
              {floors.map((floor) => (
                <option key={floor.id} value={floor.id}>
                  {floor.name} ({floor.floor_code})
                </option>
              ))}
            </select>
            <textarea
              placeholder="Description (optional)"
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              rows={3}
            />
          </>
        );

      case 'colors':
        return (
          <>
            <input
              type="text"
              placeholder="Color Code (e.g., RED)"
              value={formData.color_code || ''}
              onChange={(e) => setFormData({ ...formData, color_code: e.target.value })}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              required
            />
            <input
              type="text"
              placeholder="Name (e.g., Red)"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              required
            />
            <div className="flex gap-2">
              <input
                type="color"
                value={formData.hex_value || '#000000'}
                onChange={(e) => setFormData({ ...formData, hex_value: e.target.value })}
                className="w-16 h-10 border border-gray-300 rounded-lg cursor-pointer"
                title="Pick a color"
              />
              <input
                type="text"
                placeholder="Hex Value (e.g., #FF0000)"
                value={formData.hex_value || ''}
                onChange={(e) => setFormData({ ...formData, hex_value: e.target.value })}
                className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </>
        );

      case 'sizes':
        return (
          <>
            <input
              type="text"
              placeholder="Size Code (e.g., M)"
              value={formData.size_code || ''}
              onChange={(e) => setFormData({ ...formData, size_code: e.target.value })}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              required
            />
            <input
              type="text"
              placeholder="Name (e.g., Medium)"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              required
            />
            <input
              type="number"
              placeholder="Sort Order"
              value={formData.sort_order || ''}
              onChange={(e) => setFormData({ ...formData, sort_order: e.target.value === '' ? null : parseInt(e.target.value) })}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </>
        );

      case 'vendors':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">City *</label>
              <select
                value={formData.city_id || ''}
                onChange={(e) => handleCityChange(e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                required
              >
                <option value="">Select City</option>
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name}, {city.state} ({city.city_code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Vendor Code (Auto-generated)</label>
              <input
                type="text"
                value={formData.vendor_code || ''}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                readOnly
                disabled
              />
            </div>
            <input
              type="text"
              placeholder="Name"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              required
            />
            <input
              type="tel"
              placeholder="Mobile"
              value={formData.mobile || ''}
              onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
            <input
              type="email"
              placeholder="Email"
              value={formData.email || ''}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
            <input
              type="text"
              placeholder="ST Number"
              value={formData.st_number || ''}
              onChange={(e) => setFormData({ ...formData, st_number: e.target.value })}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
            <input
              type="text"
              placeholder="GSTIN"
              value={formData.gstin || ''}
              onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
            <textarea
              placeholder="Address"
              value={formData.address || ''}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              rows={3}
            />
          </>
        );

      case 'floors':
        return (
          <>
            <input
              type="text"
              placeholder="Floor Code (e.g., GF)"
              value={formData.floor_code || ''}
              onChange={(e) => setFormData({ ...formData, floor_code: e.target.value })}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              required
            />
            <input
              type="text"
              placeholder="Name (e.g., Ground Floor)"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              required
            />
            <textarea
              placeholder="Description"
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              rows={3}
            />
          </>
        );

      case 'cities':
        return (
          <>
            <input
              type="text"
              placeholder="City Code (e.g., RJ, RM)"
              value={formData.city_code || ''}
              onChange={(e) => setFormData({ ...formData, city_code: e.target.value.toUpperCase() })}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              required
              maxLength={3}
            />
            <input
              type="text"
              placeholder="City Name (e.g., Jaipur)"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              required
            />
            <input
              type="text"
              placeholder="State (e.g., Rajasthan)"
              value={formData.state || ''}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              required
            />
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.active !== false}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Active</span>
            </label>
          </>
        );

      default:
        return null;
    }
  };

  const renderTableRows = () => {
    return data.map((item) => (
      <tr key={item.id} className="border-b hover:bg-gray-50">
        {editingId === item.id ? (
          <td colSpan={100} className="p-4">
            <div className="space-y-3">
              {renderFormFields()}
              <div className="flex gap-2">
                <button
                  onClick={() => handleUpdate(item.id)}
                  disabled={loading}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </button>
                <button
                  onClick={() => {
                    setEditingId(null);
                    setFormData({});
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          </td>
        ) : (
          <>
            {Object.keys(item).filter(k => k !== 'id' && k !== 'created_at' && k !== 'updated_at' && k !== 'cities' && k !== 'city_id' && k !== 'floors' && k !== 'floor_id').map((key) => (
              <td key={key} className="p-4 text-sm text-gray-700">
                {typeof item[key] === 'boolean' ? (item[key] ? 'Yes' : 'No') : item[key]}
              </td>
            ))}
            {activeTab === 'vendors' && item.cities && (
              <td className="p-4 text-sm text-gray-700">
                {item.cities.name} ({item.cities.city_code})
              </td>
            )}
            {activeTab === 'productGroups' && item.floors && (
              <td className="p-4 text-sm text-gray-700">
                {item.floors.name} ({item.floors.floor_code})
              </td>
            )}
            <td className="p-4">
              <button
                onClick={() => {
                  setEditingId(item.id);
                  setFormData(item);
                }}
                className="text-blue-600 hover:text-blue-800"
              >
                <Edit2 className="w-5 h-5" />
              </button>
            </td>
          </>
        )}
      </tr>
    ));
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <Database className="w-8 h-8 text-blue-600 mr-3" />
            <h2 className="text-3xl font-bold text-gray-800">Master Data Management</h2>
          </div>
          {activeTab !== 'discounts' && activeTab !== 'payoutCodes' && activeTab !== 'commissionSlabs' && (
            <button
              onClick={() => {
                setShowAddForm(!showAddForm);
                setFormData({});
              }}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 flex items-center shadow-md"
            >
              {showAddForm ? <X className="w-5 h-5 mr-2" /> : <Plus className="w-5 h-5 mr-2" />}
              {showAddForm ? 'Cancel' : `Add ${tabs.find(t => t.id === activeTab)?.label}`}
            </button>
          )}
        </div>

        <div className="flex space-x-2 mb-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as MasterType);
                setShowAddForm(false);
                setEditingId(null);
                setFormData({});
              }}
              className={`px-6 py-3 rounded-lg font-medium whitespace-nowrap transition ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'discounts' ? (
          <DiscountManagement />
        ) : activeTab === 'payoutCodes' ? (
          <PayoutCodeManagement />
        ) : activeTab === 'commissionSlabs' ? (
          <CommissionSlabManagement />
        ) : (
          <>

        {showAddForm && (
          <div className="mb-6 bg-white rounded-lg shadow-md p-6 border-2 border-purple-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">
                Add New {tabs.find(t => t.id === activeTab)?.label}
              </h3>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setFormData({});
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              {renderFormFields()}
              <div className="flex justify-end">
                <button
                  onClick={handleAdd}
                  disabled={loading}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 disabled:bg-gray-400 flex items-center shadow-md"
                >
                  {loading ? (
                    <>
                      <Loader className="w-5 h-5 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5 mr-2" />
                      Add {tabs.find(t => t.id === activeTab)?.label}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 bg-red-50 text-red-600 p-4 rounded-lg">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 bg-green-50 text-green-600 p-4 rounded-lg">
            {success}
          </div>
        )}

        {loading && !showAddForm ? (
          <div className="flex justify-center py-12">
            <Loader className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-100">
                  {data[0] &&
                    Object.keys(data[0])
                      .filter(k => k !== 'id' && k !== 'created_at' && k !== 'updated_at' && k !== 'cities' && k !== 'city_id' && k !== 'floors' && k !== 'floor_id')
                      .map((key) => (
                        <th key={key} className="p-4 text-left text-sm font-semibold text-gray-700">
                          {key.replace(/_/g, ' ').toUpperCase()}
                        </th>
                      ))}
                  {activeTab === 'vendors' && <th className="p-4 text-left text-sm font-semibold text-gray-700">CITY</th>}
                  {activeTab === 'productGroups' && <th className="p-4 text-left text-sm font-semibold text-gray-700">FLOOR</th>}
                  <th className="p-4 text-left text-sm font-semibold text-gray-700">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr>
                    <td colSpan={100} className="p-8 text-center text-gray-500">
                      No data found. Click "Add New" to get started.
                    </td>
                  </tr>
                ) : (
                  renderTableRows()
                )}
              </tbody>
            </table>
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
}
