import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { scanBarcode, getAvailableBarcodes } from '../utils/barcodeScanning';
import { Calendar, Search, X, Save, Scan, Eye, CheckCircle, XCircle, Package } from 'lucide-react';

interface Booking {
  id: string;
  booking_number: string;
  customer_mobile: string;
  customer_name: string;
  barcode_8digit: string;
  floor: string;
  floor_name: string;
  booking_date: string;
  booking_expiry: string | null;
  status: string;
  invoice_number: string | null;
  notes: string | null;
  item_details: {
    design_no: string;
    product_group: string;
    color: string;
    size: string;
    mrp: number;
  };
}

export default function EBooking() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [floors, setFloors] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [showItemSelect, setShowItemSelect] = useState(false);
  const [availableItems, setAvailableItems] = useState<any[]>([]);
  const [selectedFloor, setSelectedFloor] = useState('');

  const [formData, setFormData] = useState({
    customer_mobile: '',
    customer_name: '',
    barcode_8digit: '',
    floor: '',
    booking_expiry: '',
    notes: '',
  });

  const [showCustomerPrompt, setShowCustomerPrompt] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [scannedItemDetails, setScannedItemDetails] = useState<any>(null);

  useEffect(() => {
    loadBookings();
    loadCustomers();
    loadFloors();
  }, []);

  const loadBookings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('e_bookings')
        .select(`
          *,
          floor:floors(id, name),
          user:users!created_by(id, name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const enrichedBookings = await Promise.all(
        (data || []).map(async (booking) => {
          const { data: customer } = await supabase
            .from('customers')
            .select('name')
            .eq('mobile', booking.customer_mobile)
            .maybeSingle();

          const itemInfo = await scanBarcode(booking.barcode_8digit);

          return {
            ...booking,
            customer_name: customer?.name || 'Unknown',
            floor_name: booking.floor?.name || 'Unknown',
            created_by_name: booking.user?.name || 'System',
            item_details: itemInfo ? {
              design_no: itemInfo.design_no,
              product_group: itemInfo.product_group_name,
              color: itemInfo.color_name,
              size: itemInfo.size_name,
              mrp: itemInfo.mrp,
            } : null,
          };
        })
      );

      setBookings(enrichedBookings);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const { data } = await supabase
        .from('customers')
        .select('*')
        .eq('status', 'active')
        .order('name');
      setCustomers(data || []);
    } catch (err) {
      console.error('Error loading customers:', err);
    }
  };

  const loadFloors = async () => {
    try {
      const { data } = await supabase
        .from('floors')
        .select('*')
        .eq('active', true)
        .order('name');
      setFloors(data || []);
    } catch (err) {
      console.error('Error loading floors:', err);
    }
  };

  const loadAvailableItemsByFloor = async (floorId: string) => {
    try {
      const items = await getAvailableBarcodes({ floor: floorId });
      setAvailableItems(items);
    } catch (err) {
      console.error('Error loading available items:', err);
    }
  };

  const checkCustomerExists = async (mobile: string) => {
    if (mobile.length !== 10) return;

    try {
      const { data: customer } = await supabase
        .from('customers')
        .select('*')
        .eq('mobile', mobile)
        .maybeSingle();

      if (customer) {
        setFormData(prev => ({ ...prev, customer_name: customer.name }));
        setError('');
      } else {
        setShowCustomerPrompt(true);
      }
    } catch (err: any) {
      console.error('Error checking customer:', err);
    }
  };

  const createNewCustomer = async () => {
    if (!newCustomerName.trim()) {
      setError('Please enter customer name');
      return;
    }

    try {
      const { error } = await supabase
        .from('customers')
        .insert([{
          mobile: formData.customer_mobile,
          name: newCustomerName.trim(),
          status: 'active',
        }]);

      if (error) throw error;

      setFormData(prev => ({ ...prev, customer_name: newCustomerName.trim() }));
      setShowCustomerPrompt(false);
      setNewCustomerName('');
      loadCustomers();
      setSuccess('New customer created successfully');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleScanBarcode = async (code: string) => {
    try {
      const itemInfo = await scanBarcode(code);
      if (!itemInfo) {
        setError('Item not found');
        setScannedItemDetails(null);
        return;
      }

      if (itemInfo.available_quantity <= 0) {
        setError('Item is out of stock');
        setScannedItemDetails(null);
        return;
      }

      setFormData({
        ...formData,
        barcode_8digit: code,
        floor: itemInfo.floor || formData.floor,
      });
      setScannedItemDetails(itemInfo);
      setError('');
      setSuccess('Item scanned successfully!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err: any) {
      setError(err.message);
      setScannedItemDetails(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.customer_mobile || !formData.barcode_8digit || !formData.floor) {
      setError('Please fill all required fields');
      return;
    }

    setLoading(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data: userRecord } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', userData?.user?.id)
        .maybeSingle();

      const { data: bookingNumber, error: rpcError } = await supabase.rpc('generate_booking_number');

      if (rpcError) {
        throw new Error('Failed to generate booking number: ' + rpcError.message);
      }

      if (!bookingNumber) {
        throw new Error('Booking number generation returned null');
      }

      const bookingData = {
        booking_number: bookingNumber,
        customer_mobile: formData.customer_mobile,
        barcode_8digit: formData.barcode_8digit,
        floor: formData.floor,
        booking_expiry: formData.booking_expiry || null,
        notes: formData.notes || null,
        created_by: userRecord?.id || null,
      };

      const { error } = await supabase
        .from('e_bookings')
        .insert([bookingData]);

      if (error) throw error;

      setSuccess(`Booking ${bookingNumber} created successfully!`);
      setShowBookingForm(false);
      resetForm();
      loadBookings();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to create booking');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this booking?')) return;

    try {
      const { error } = await supabase
        .from('e_bookings')
        .update({ status: 'cancelled' })
        .eq('id', id);

      if (error) throw error;
      setSuccess('Booking cancelled successfully');
      loadBookings();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const resetForm = () => {
    setFormData({
      customer_mobile: '',
      customer_name: '',
      barcode_8digit: '',
      floor: '',
      booking_expiry: '',
      notes: '',
    });
    setShowCustomerPrompt(false);
    setNewCustomerName('');
    setScannedItemDetails(null);
  };

  const filteredBookings = bookings.filter(booking => {
    const query = searchQuery.toLowerCase();
    return (
      booking.booking_number?.toLowerCase().includes(query) ||
      booking.customer_mobile?.includes(query) ||
      booking.customer_name?.toLowerCase().includes(query) ||
      booking.barcode_8digit?.toLowerCase().includes(query) ||
      booking.item_details?.design_no?.toLowerCase().includes(query)
    );
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'booked': return 'bg-blue-100 text-blue-800';
      case 'invoiced': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'expired': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Calendar className="w-8 h-8 text-blue-600 mr-3" />
            <div>
              <h2 className="text-3xl font-bold text-gray-800">E-Booking</h2>
              <p className="text-sm text-gray-600">Floor-wise item booking for customers</p>
            </div>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowBookingForm(true);
            }}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg hover:from-blue-700 hover:to-cyan-700 flex items-center shadow-md"
          >
            <Calendar className="w-5 h-5 mr-2" />
            New Booking
          </button>
        </div>

        {error && (
          <div className="bg-gradient-to-r from-red-50 to-red-100 border-2 border-red-300 text-red-700 p-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-300 text-green-700 p-3 rounded-lg mb-4">
            {success}
          </div>
        )}

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by booking number, customer, mobile, or barcode..."
              className="w-full pl-10 pr-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-2 border-gray-200">
            <thead className="bg-gradient-to-r from-blue-100 to-cyan-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Booking #</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">8-Digit Code</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Item Details</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Floor</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Date</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Status</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-gray-200">
              {filteredBookings.map(booking => (
                <tr key={booking.id} className="hover:bg-blue-50 transition-colors">
                  <td className="px-4 py-3 font-semibold">{booking.booking_number}</td>
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-semibold">{booking.customer_name}</div>
                      <div className="text-xs text-gray-600">{booking.customer_mobile}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-2 py-1 rounded font-mono font-semibold text-sm">
                      {booking.barcode_8digit}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {booking.item_details ? (
                      <div>
                        <div className="font-semibold">{booking.item_details.design_no}</div>
                        <div className="text-xs text-gray-600">
                          {booking.item_details.product_group} • {booking.item_details.color} • {booking.item_details.size}
                        </div>
                        <div className="text-xs font-semibold text-emerald-600">
                          MRP: ₹{booking.item_details.mrp}
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400">Loading...</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold">{booking.floor_name}</td>
                  <td className="px-4 py-3 text-sm">
                    {new Date(booking.booking_date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(booking.status)}`}>
                      {booking.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {booking.status === 'booked' && (
                      <button
                        onClick={() => handleCancelBooking(booking.id)}
                        className="text-red-600 hover:text-red-800 p-1"
                      >
                        <XCircle className="w-5 h-5" />
                      </button>
                    )}
                    {booking.status === 'invoiced' && (
                      <span className="text-green-600">
                        <CheckCircle className="w-5 h-5 inline" />
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredBookings.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p>No bookings found</p>
            </div>
          )}
        </div>
      </div>

      {showBookingForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-blue-600 to-cyan-600 p-6 flex justify-between items-center sticky top-0">
              <h3 className="text-2xl font-bold text-white">Create E-Booking</h3>
              <button
                onClick={() => {
                  setShowBookingForm(false);
                  resetForm();
                }}
                className="text-white hover:text-gray-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Customer Mobile <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    maxLength={10}
                    value={formData.customer_mobile}
                    onChange={(e) => {
                      const mobile = e.target.value.replace(/\D/g, '');
                      setFormData({ ...formData, customer_mobile: mobile, customer_name: '' });
                      if (mobile.length === 10) {
                        checkCustomerExists(mobile);
                      }
                    }}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter 10-digit mobile number"
                    required
                  />
                  {formData.customer_name && (
                    <p className="mt-2 text-sm text-green-700 font-semibold">
                      Customer: {formData.customer_name}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Floor <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.floor}
                    onChange={(e) => {
                      setFormData({ ...formData, floor: e.target.value });
                      setSelectedFloor(e.target.value);
                      if (e.target.value) {
                        loadAvailableItemsByFloor(e.target.value);
                      }
                    }}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Select Floor</option>
                    {floors.map(floor => (
                      <option key={floor.id} value={floor.id}>{floor.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    8-Digit Barcode <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={8}
                      value={formData.barcode_8digit}
                      onChange={(e) => {
                        setFormData({ ...formData, barcode_8digit: e.target.value });
                        if (e.target.value !== formData.barcode_8digit) {
                          setScannedItemDetails(null);
                        }
                      }}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && formData.barcode_8digit.length === 8) {
                          e.preventDefault();
                          handleScanBarcode(formData.barcode_8digit);
                        }
                      }}
                      className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter or scan 8-digit code"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowItemSelect(true)}
                      disabled={!selectedFloor}
                      className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                  </div>
                  {!selectedFloor && <p className="text-xs text-orange-600 mt-1">Select floor first to browse items</p>}
                </div>

                {scannedItemDetails && (
                  <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                      <Package className="w-5 h-5 mr-2 text-blue-600" />
                      Scanned Item Details
                    </h4>
                    <div className="flex gap-4">
                      {scannedItemDetails.photos && scannedItemDetails.photos.length > 0 ? (
                        <img
                          src={scannedItemDetails.photos[0]}
                          alt={scannedItemDetails.design_no}
                          className="w-32 h-32 object-cover rounded-lg border-2 border-gray-300 shadow-md"
                          onError={(e) => {
                            e.currentTarget.src = 'https://via.placeholder.com/128?text=No+Image';
                          }}
                        />
                      ) : (
                        <div className="w-32 h-32 bg-gray-200 rounded-lg flex items-center justify-center text-gray-400 border-2 border-gray-300">
                          <Package className="w-12 h-12" />
                        </div>
                      )}
                      <div className="flex-1 space-y-2">
                        <div>
                          <span className="text-sm text-gray-600">Design:</span>
                          <span className="ml-2 font-semibold text-gray-800">{scannedItemDetails.design_no}</span>
                        </div>
                        <div>
                          <span className="text-sm text-gray-600">Details:</span>
                          <span className="ml-2 text-sm text-gray-700">
                            {scannedItemDetails.product_group_name} • {scannedItemDetails.color_name} • {scannedItemDetails.size_name}
                          </span>
                        </div>
                        <div className="flex gap-4 items-center">
                          <div>
                            <span className="text-sm text-gray-600">MRP:</span>
                            <span className="ml-2 font-bold text-lg text-gray-800">₹{scannedItemDetails.mrp}</span>
                          </div>
                          {scannedItemDetails.discount_value && scannedItemDetails.discount_value > 0 && (
                            <>
                              <div>
                                <span className="text-sm text-gray-600">Discount:</span>
                                <span className="ml-2 font-semibold text-red-600">
                                  {scannedItemDetails.discount_type === 'percentage'
                                    ? `${scannedItemDetails.discount_value}%`
                                    : `₹${scannedItemDetails.discount_value}`}
                                </span>
                              </div>
                              <div>
                                <span className="text-sm text-gray-600">Final Price:</span>
                                <span className="ml-2 font-bold text-lg text-green-600">
                                  ₹{(scannedItemDetails.mrp - (
                                    scannedItemDetails.discount_type === 'percentage'
                                      ? (scannedItemDetails.mrp * scannedItemDetails.discount_value) / 100
                                      : scannedItemDetails.discount_value
                                  )).toFixed(2)}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                        <div>
                          <span className="text-sm text-gray-600">Available Quantity:</span>
                          <span className="ml-2 bg-emerald-100 text-emerald-800 px-2 py-1 rounded font-semibold text-sm">
                            {scannedItemDetails.available_quantity}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Booking Expiry (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.booking_expiry}
                    onChange={(e) => setFormData({ ...formData, booking_expiry: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={2}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowBookingForm(false);
                    resetForm();
                  }}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg hover:from-blue-700 hover:to-cyan-700 disabled:from-gray-400 disabled:to-gray-500 flex items-center shadow-md"
                >
                  <Save className="w-5 h-5 mr-2" />
                  {loading ? 'Creating...' : 'Create Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showItemSelect && selectedFloor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-white">Select Item from Floor</h3>
              <button
                onClick={() => setShowItemSelect(false)}
                className="p-2 hover:bg-white/20 rounded-lg transition text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-gray-100 to-gray-200 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Image</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">8-Digit Code</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Design</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Details</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Available</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">MRP</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Discount</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Final Price</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-gray-200">
                  {availableItems.map((item) => (
                    <tr key={item.barcode_8digit} className="hover:bg-purple-50 transition-colors">
                      <td className="px-4 py-3">
                        {item.photos && item.photos.length > 0 ? (
                          <img
                            src={item.photos[0]}
                            alt={item.design_no}
                            className="w-16 h-16 object-cover rounded-lg border-2 border-gray-200"
                            onError={(e) => {
                              e.currentTarget.src = 'https://via.placeholder.com/64?text=No+Image';
                            }}
                          />
                        ) : (
                          <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center text-gray-400 text-xs">
                            No Image
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-2 py-1 rounded font-mono font-semibold text-sm">
                          {item.barcode_8digit}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold">{item.design_no}</td>
                      <td className="px-4 py-3 text-sm">
                        {item.product_group_name} • {item.color_name} • {item.size_name}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="bg-emerald-100 text-emerald-800 px-2 py-1 rounded font-semibold">
                          {item.available_quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">₹{item.mrp}</td>
                      <td className="px-4 py-3 text-right">
                        {item.discount_value && item.discount_value > 0 ? (
                          <span className="text-red-600 font-semibold">
                            {item.discount_type === 'percentage' ? `${item.discount_value}%` : `₹${item.discount_value}`}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-green-600">
                        ₹{(item.mrp - (item.discount_type === 'percentage' ? (item.mrp * (item.discount_value || 0)) / 100 : (item.discount_value || 0))).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => {
                            setFormData({ ...formData, barcode_8digit: item.barcode_8digit });
                            setScannedItemDetails(item);
                            setShowItemSelect(false);
                            setSuccess('Item selected successfully!');
                            setTimeout(() => setSuccess(''), 2000);
                          }}
                          className="px-4 py-1 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded hover:from-blue-700 hover:to-cyan-700 text-sm font-semibold shadow-md"
                        >
                          Select
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {availableItems.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p>No available items on this floor</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showCustomerPrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-orange-600 to-red-600 p-6">
              <h3 className="text-2xl font-bold text-white">New Customer</h3>
              <p className="text-white text-sm mt-1">Mobile: {formData.customer_mobile}</p>
            </div>

            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Customer Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    createNewCustomer();
                  }
                }}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="Enter customer name"
                autoFocus
              />

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowCustomerPrompt(false);
                    setNewCustomerName('');
                    setFormData(prev => ({ ...prev, customer_mobile: '', customer_name: '' }));
                  }}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={createNewCustomer}
                  className="px-6 py-2 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-lg hover:from-orange-700 hover:to-red-700 shadow-md"
                >
                  Create Customer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
