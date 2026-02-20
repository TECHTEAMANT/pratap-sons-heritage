import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Save, Loader } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface VendorAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newVendor: any) => void;
}

export default function VendorAddModal({ isOpen, onClose, onSuccess }: VendorAddModalProps) {
  const [loading, setLoading] = useState(false);
  const [cities, setCities] = useState<any[]>([]);
  const [formData, setFormData] = useState<any>({
    city_id: '',
    vendor_code: '',
    name: '',
    address: '',
    gstin: '',
    mobile: '',
    active: true
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadCities();
    }
  }, [isOpen]);

  const loadCities = async () => {
    try {
      const { data, error } = await supabase
        .from('cities')
        .select('*')
        .eq('active', true)
        .order('name');
      if (error) throw error;
      setCities(data || []);
    } catch (err) {
      console.error('Error loading cities:', err);
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
        const numberPart = lastCode.slice(city.city_code.length);
        nextNumber = parseInt(numberPart) + 1;
      }

      return `${city.city_code}${String(nextNumber).padStart(2, '0')}`;
    } catch (err) {
      console.error('Error generating vendor code:', err);
      return '';
    }
  };

  const handleCityChange = async (cityId: string) => {
    const vendorCode = await generateVendorCode(cityId);
    setFormData({ ...formData, city_id: cityId, vendor_code: vendorCode });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!formData.city_id || !formData.name) {
        throw new Error('City and Name are required');
      }

      const { data, error: insertError } = await supabase
        .from('vendors')
        .insert([{
          city_id: formData.city_id,
          vendor_code: formData.vendor_code,
          name: formData.name,
          address: formData.address || null,
          gstin: formData.gstin || null,
          mobile: formData.mobile || null,
          active: true
        }])
        .select()
        .single();

      if (insertError) throw insertError;

      onSuccess(data);
      onClose();
      // Reset form
      setFormData({
        city_id: '',
        vendor_code: '',
        name: '',
        address: '',
        gstin: '',
        mobile: '',
        active: true
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-4 flex items-center justify-between text-white">
          <h3 className="text-xl font-bold">Add New Vendor</h3>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-medium border border-red-200">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">City *</Label>
              <select
                value={formData.city_id}
                onChange={(e) => handleCityChange(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
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
              <Label className="mb-2 block">Vendor Code (Auto-generated)</Label>
              <Input
                value={formData.vendor_code}
                className="bg-gray-100 font-mono"
                readOnly
                disabled
              />
            </div>

            <div>
              <Label className="mb-2 block">Vendor Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Krishna Textiles"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="mb-2 block">GSTIN</Label>
                <Input
                  value={formData.gstin}
                  onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                  placeholder="GST Number"
                />
              </div>
              <div>
                <Label className="mb-2 block">Mobile</Label>
                <Input
                  type="tel"
                  value={formData.mobile}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  placeholder="Phone Number"
                />
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Address</Label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 h-20 resize-none"
                placeholder="Vendor Address"
              />
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Vendor
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
