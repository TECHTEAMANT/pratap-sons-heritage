import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Package, Search, Image as ImageIcon, RefreshCw, Edit2, X, Save, Upload, Loader } from 'lucide-react';

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
  hsn_code: string;
  from_product_master?: boolean;
}

export default function Inventory() {
  const GLOBAL_CACHE_KEY = 'inventory_global_data';
  const CACHE_TTL = 15 * 60 * 1000;
  
  const getCacheKey = (page: number, search: string) => `inventory_cache_p${page}_s${search.trim().toLowerCase()}`;

  const [groupedItems, setGroupedItems] = useState<GroupedItem[]>(() => {
    const cached = localStorage.getItem(GLOBAL_CACHE_KEY);
    if (cached) {
      try {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_TTL) return data.slice(0, 20);
      } catch (e) {}
    }
    return [];
  });
  const [totalCount, setTotalCount] = useState<number>(() => {
    const cached = localStorage.getItem(GLOBAL_CACHE_KEY);
    if (cached) {
      try {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_TTL) return data.length;
      } catch (e) {}
    }
    return 0;
  });
  const [loading, setLoading] = useState(() => {
    const cached = localStorage.getItem(GLOBAL_CACHE_KEY);
    if (cached) {
      try {
        const { timestamp } = JSON.parse(cached);
        return Date.now() - timestamp >= CACHE_TTL;
      } catch (e) {}
    }
    return true;
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<GroupedItem | null>(null);
  const [floors, setFloors] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [imageUploading, setImageUploading] = useState(false);
  const [editCameraOpen, setEditCameraOpen] = useState(false);
  const editVideoRef = useRef<HTMLVideoElement | null>(null);
  const editStreamRef = useRef<MediaStream | null>(null);
  const editCameraInputRef = useRef<HTMLInputElement | null>(null);

  const [pageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [isSyncing, setIsSyncing] = useState(false);

  // In-memory store for images to bypass localStorage 5MB quota
  // Keyed by getBatchKey(item)
  const imageStore = useRef<{ [key: string]: string[] }>({});

  const stripImages = (items: GroupedItem[]): GroupedItem[] => {
    return items.map(item => ({ ...item, images: [] }));
  };

  const hydrateImages = (items: GroupedItem[]): { hydrated: GroupedItem[], missingTotal: number } => {
    let missingTotal = 0;
    const hydrated = items.map(item => {
      const key = getBatchKey(item);
      const stored = imageStore.current[key];
      const hasImages = (item.images && item.images.length > 0);
      if (!hasImages && (!stored || stored.length === 0)) {
        missingTotal++;
      }
      return { ...item, images: (stored && stored.length > 0) ? stored : item.images };
    });
    return { hydrated, missingTotal };
  };

  const updateImageStore = (items: GroupedItem[]) => {
    items.forEach(item => {
      if (item.images && item.images.length > 0) {
        const key = getBatchKey(item);
        // Only store if we don't have it or if it was empty
        if (!imageStore.current[key] || imageStore.current[key].length === 0) {
          imageStore.current[key] = item.images;
        }
      }
    });
  };

  useEffect(() => {
    loadInventory(currentPage);
  }, [currentPage]);

  const getBatchKey = (b: any) => {
    // Robust key with trim and lowercase to handle data inconsistencies
    const designNo = (b.design_no || '').toString().trim().toLowerCase();
    const vendorId = (b.vendor_id || (typeof b.vendor === 'object' ? b.vendor?.id : b.vendor) || '').toString().trim().toLowerCase();
    const pgId = b.product_group_id || (typeof b.product_group === 'object' ? b.product_group?.id : b.product_group);
    const pgIdStr = (pgId || '').toString().trim().toLowerCase();
    const colorId = b.color_id || (typeof b.color === 'object' ? b.color?.id : b.color);
    const colorIdStr = (colorId || '').toString().trim().toLowerCase();
    
    return `${designNo}||${vendorId}||${pgIdStr}||${colorIdStr}`;
  };

  const loadInventory = async (page = 1, forceRefresh = false, silent = false) => {
    setError('');
    const cacheKey = getCacheKey(page, searchTerm);
    
    // 1. Check Global Cache first (if no search)
    // CRITICAL: Bypass this if in 'silent' mode, otherwise it will just hit the same empty-image cache
    if (!searchTerm && !forceRefresh && !silent) { 
      const globalCached = localStorage.getItem(GLOBAL_CACHE_KEY);
      if (globalCached) {
        try {
          const { data, timestamp } = JSON.parse(globalCached);
          if (Date.now() - timestamp < CACHE_TTL) {
            const from = (page - 1) * pageSize;
            const to = from + pageSize;
            const pagedData = data.slice(from, to);
            
            if (page === currentPage && !searchTerm) {
              const { hydrated, missingTotal } = hydrateImages(pagedData);
              setGroupedItems(hydrated);
              // Don't update totalCount from cache if we have a fresher one, 
              // but for global cache we trust the data length if it's the full set.
              if (data.length > 0) setTotalCount(data.length);
              setLoading(false);
              
              // If current view is missing images, trigger a silent fetch even if cached
              if (missingTotal > 0) {
                loadInventory(page, false, true); 
              }
            }
            
            // If we don't have page cache for this, do a silent fetch to get images
            const pageCached = localStorage.getItem(cacheKey);
            if (!pageCached || forceRefresh) {
              loadInventory(page, false, true); // SILENT fetch
            }
            
            syncInventory();
            return;
          }
        } catch (e) {
          console.warn('Failed to parse global cache', e);
        }
      }
    }

    // 2. Check Page Cache
    if (!forceRefresh && !silent) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const { data, total, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_TTL) {
            const { hydrated, missingTotal } = hydrateImages(data);
            setGroupedItems(hydrated);
            setTotalCount(total);
            setLoading(false);

            // If images missing from session memory, fetch them silently
            if (missingTotal > 0) {
              loadInventory(page, false, true);
            }
            return;
          }
        } catch (e) {
          console.warn('Failed to parse cached inventory', e);
        }
      }
    }

    // 3. Not in cache or forced refresh or SILENT - Fetch from DB
    if (!silent) setLoading(true);
    try {
      const currentSearch = searchTerm;

      // Only fetch the full master count if we are on page 1 or searching
      if (!silent && !searchTerm && page === 1) {
          const { count: stableTotal } = await supabase.from('product_masters').select('*', { count: 'exact', head: true });
          if (stableTotal !== null) setTotalCount(stableTotal);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      // 1. Fetch Floors
      const { data: floorsData } = await supabase
        .from('floors')
        .select('*')
        .eq('active', true);
      setFloors(floorsData || []);

      // 2. Fetch Product Masters (Paginated)
      let masterQuery = supabase
        .from('product_masters')
        .select(`
          *,
          product_group:product_groups(id, name, group_code),
          color:colors(id, name, color_code),
          vendor:vendors(id, name, vendor_code)
        `, { count: 'exact' });

      if (searchTerm) {
        masterQuery = masterQuery.or(`design_no.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
      }

      const { data: masters, count, error: mastersError } = await masterQuery
        .order('created_at', { ascending: false })
        .range(from, to);

      if (mastersError) throw mastersError;
      
      // Update global total count only on fresh load or filters
      if (count !== null && page === 1) {
        setTotalCount(count);
      }

      if (!masters || masters.length === 0) {
        if (page === currentPage && searchTerm === currentSearch) {
          setGroupedItems([]);
        }
        return;
      }

      // 4. PRE-GROUP MASTERS: Handle DB duplicates (same design/vendor/color/group)
      const uniqueMastersMap: { [key: string]: any } = {};
      masters.forEach(m => {
        const key = getBatchKey(m);
        if (!uniqueMastersMap[key]) {
          uniqueMastersMap[key] = m;
        } else {
          // Merge photos if the first one was empty
          if ((!uniqueMastersMap[key].photos || uniqueMastersMap[key].photos.length === 0) && m.photos && m.photos.length > 0) {
            uniqueMastersMap[key].photos = m.photos;
          }
        }
      });
      const uniqueMasters = Object.values(uniqueMastersMap);

      // 5. Fetch Barcode Batches for these unique masters
      const designNos = Array.from(new Set(uniqueMasters.map(m => m.design_no)));
      const vendorIds = Array.from(new Set(uniqueMasters.map(m => m.vendor?.id).filter(Boolean)));

      const { data: batches, error: batchesError } = await supabase
        .from('barcode_batches')
        .select(`
          *,
          product_group:product_groups(id, name, group_code),
          color:colors(id, name, color_code),
          size:sizes(id, name, size_code),
          vendor:vendors(id, name, vendor_code),
          floor:floors(id, name, floor_code)
        `)
        .in('design_no', designNos)
        .in('vendor', vendorIds)
        .eq('status', 'active');

      if (batchesError) throw batchesError;

      // 6. Fetch Defective Stock
      const barcodes = (batches || []).map(b => b.barcode_alias_8digit);
      let defectiveData: any[] = [];
      if (barcodes.length > 0) {
        const { data: defData, error: defError } = await supabase
          .from('defective_stock')
          .select('*')
          .in('barcode', barcodes);
        if (defError) throw defError;
        defectiveData = defData || [];
      }

      // 7. Group and Merge
      const grouped = groupItemsByDesignVendor(batches || [], defectiveData);

      const masterItems: GroupedItem[] = uniqueMasters.reduce((acc: GroupedItem[], pm: any) => {
        const key = getBatchKey(pm);
        const existing = grouped.find(g => getBatchKey(g) === key);
        if (existing) {
          if ((!existing.images || existing.images.length === 0) && pm.photos && pm.photos.length > 0) {
            existing.images = pm.photos;
          }
          if (existing.cost === 0 && pm.cost_actual > 0) {
            existing.cost = pm.cost_actual;
          }
        } else {
          acc.push({
            design_no: pm.design_no,
            vendor_name: pm.vendor?.name || 'Unknown',
            vendor_code: pm.vendor?.vendor_code || '',
            vendor_id: pm.vendor?.id || '',
            product_group_name: pm.product_group?.name || '',
            product_group_id: pm.product_group?.id || '',
            color_name: pm.color?.name || '',
            color_id: pm.color?.id || '',
            description: pm.description || '',
            images: pm.photos || [],
            sizes: [],
            total_available: 0,
            total_quantity: 0,
            total_defective: 0,
            mrp: pm.mrp || 0,
            cost: pm.cost_actual || 0,
            order_number: null,
            gst_logic: pm.gst_logic || 'AUTO_5_18',
            mrp_markup_percent: pm.mrp_markup_percent || 100,
            hsn_code: pm.hsn_code || '',
            from_product_master: true,
          });
        }
        return acc;
      }, []);

      const finalItems = [...grouped, ...masterItems];
      updateImageStore(finalItems);

      if (page === currentPage && searchTerm === currentSearch) {
        setGroupedItems(finalItems);
      }

      // Save to cache (full page for quick lookup) - STRIP IMAGES
      try {
        localStorage.setItem(cacheKey, JSON.stringify({
          data: stripImages(finalItems),
          total: count || 0,
          timestamp: Date.now()
        }));
      } catch (e) {
        console.warn('Failed to save to inventory cache (possibly full)', e);
      }

      // Start background sync if not already syncing and doing initial load
      if (!searchTerm) {
        const globalCached = localStorage.getItem(GLOBAL_CACHE_KEY);
        let shouldSync = true;
        if (globalCached) {
          try {
            const { timestamp } = JSON.parse(globalCached);
            // Only sync if cache is older than 5 minutes
            if (Date.now() - timestamp < CACHE_TTL / 3) shouldSync = false;
          } catch (e) {}
        }
        if (shouldSync) syncInventory();
      }
    } catch (err: any) {
      console.error('Error loading inventory:', err);
      setError(err.message || 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  const syncInventory = async () => {
    if (isSyncing) return;
    
    // Check if global cache is still fresh enough to skip sync
    const globalCached = localStorage.getItem(GLOBAL_CACHE_KEY);
    if (globalCached) {
      try {
        const { timestamp } = JSON.parse(globalCached);
        if (Date.now() - timestamp < CACHE_TTL / 3) return; // Only sync every 5 mins
      } catch (e) {}
    }

    setIsSyncing(true);
    console.log('Starting background inventory sync...');

    try {
      let allGrouped: GroupedItem[] = [];
      let offset = 0;
      const syncBatchSize = 20; // Smaller batches for faster "pop-in"
      let hasMore = true;


      while (hasMore) {
        const { data: masters, error: mastersError } = await supabase
          .from('product_masters')
          .select(`
            *,
            product_group:product_groups(id, name, group_code),
            color:colors(id, name, color_code),
            vendor:vendors(id, name, vendor_code)
          `)
          .order('created_at', { ascending: false })
          .range(offset, offset + syncBatchSize - 1);

        if (mastersError) throw mastersError;
        if (!masters || masters.length === 0) break;

        const designNos = Array.from(new Set(masters.map(m => m.design_no)));
        const vendorIds = Array.from(new Set(masters.map(m => m.vendor?.id).filter(Boolean)));

        const { data: batches, error: batchesError } = await supabase
          .from('barcode_batches')
          .select(`
            *,
            product_group:product_groups(id, name, group_code),
            color:colors(id, name, color_code),
            size:sizes(id, name, size_code),
            vendor:vendors(id, name, vendor_code),
            floor:floors(id, name, floor_code)
          `)
          .in('design_no', designNos)
          .in('vendor', vendorIds)
          .eq('status', 'active');

        if (batchesError) throw batchesError;

        const barcodes = (batches || []).map(b => b.barcode_alias_8digit);
        let defectiveData: any[] = [];
        if (barcodes.length > 0) {
          const { data: defData } = await supabase
            .from('defective_stock')
            .select('*')
            .in('barcode', barcodes);
          defectiveData = defData || [];
        }

        const uniqueMastersMap: { [key: string]: any } = {};
        masters.forEach(m => {
          const key = getBatchKey(m);
          if (!uniqueMastersMap[key]) {
            uniqueMastersMap[key] = m;
          } else if (m.photos && m.photos.length > 0 && (!uniqueMastersMap[key].photos || uniqueMastersMap[key].photos.length === 0)) {
            uniqueMastersMap[key].photos = m.photos;
          }
        });
        const uniqueMasters = Object.values(uniqueMastersMap);

        const grouped = groupItemsByDesignVendor(batches || [], defectiveData);

        const masterItems: GroupedItem[] = uniqueMasters.reduce((acc: GroupedItem[], pm: any) => {
          const key = getBatchKey(pm);
          const existing = grouped.find(g => getBatchKey(g) === key);
          if (existing) {
            if ((!existing.images || existing.images.length === 0) && pm.photos && pm.photos.length > 0) {
              existing.images = pm.photos;
            }
          } else {
            acc.push({
              design_no: pm.design_no,
              vendor_name: pm.vendor?.name || 'Unknown',
              vendor_code: pm.vendor?.vendor_code || '',
              vendor_id: pm.vendor?.id || '',
              product_group_name: pm.product_group?.name || '',
              product_group_id: pm.product_group?.id || '',
              color_name: pm.color?.name || '',
              color_id: pm.color?.id || '',
              description: pm.description || '',
              images: pm.photos || [],
              sizes: [],
              total_available: 0,
              total_quantity: 0,
              total_defective: 0,
              mrp: pm.mrp || 0,
              cost: pm.cost_actual || 0,
              order_number: null,
              gst_logic: pm.gst_logic || 'AUTO_5_18',
              mrp_markup_percent: pm.mrp_markup_percent || 100,
              hsn_code: pm.hsn_code || '',
              from_product_master: true,
            });
          }
          return acc;
        }, []);

        // Add newly processed unique items to allGrouped, avoiding duplicates from previous batches
        const newBatchItems = [...grouped, ...masterItems];
        newBatchItems.forEach(newItem => {
          const key = getBatchKey(newItem);
          const existingInAll = allGrouped.find(exp => getBatchKey(exp) === key);
          if (!existingInAll) {
            allGrouped.push(newItem);
          } else {
            // Merge images if missing in existing
            if ((!existingInAll.images || existingInAll.images.length === 0) && newItem.images && newItem.images.length > 0) {
              existingInAll.images = newItem.images;
            }
          }
        });
        
        offset += syncBatchSize;
        hasMore = masters.length === syncBatchSize;

        updateImageStore(newBatchItems);

        // REACTIVE RE-RENDER: If any items on the CURRENT page were just fetched, update state
        setGroupedItems(currentItems => {
          const { hydrated, missingTotal } = hydrateImages(currentItems);
          const currentMissing = currentItems.filter(i => !i.images || i.images.length === 0).length;
          // Only update state if images were actually found/populated
          return missingTotal < currentMissing ? hydrated : currentItems;
        });

        // Small delay to keep UI snappy and network free for user actions
        await new Promise(r => setTimeout(r, 500));
      }

      console.log(`Background sync complete. Found ${allGrouped.length} unique items.`);
      
      // FINALLY save to global cache once complete
      try {
        localStorage.setItem(GLOBAL_CACHE_KEY, JSON.stringify({
          data: stripImages(allGrouped),
          timestamp: Date.now()
        }));
      } catch (e) {
        console.warn('Global cache quota exceeded', e);
      }

      // Update totalCount to the actual unique total found during sync
      if (allGrouped.length > 0) setTotalCount(allGrouped.length);
    } catch (err) {
      console.error('Background sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const groupItemsByDesignVendor = (items: any[], defectiveItems: any[]): GroupedItem[] => {
    const groupMap: { [key: string]: any } = {};

    items.forEach((item) => {
      const key = getBatchKey(item);

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
          hsn_code: item.hsn_code || '',
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
    setEditCameraOpen(false);
    if (editStreamRef.current) {
      editStreamRef.current.getTracks().forEach(t => t.stop());
      editStreamRef.current = null;
    }
  };

  const MAX_PHOTOS = 3;

  const handleEditImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingItem) return;
    if (!file.type.startsWith('image/')) { setError('Please select an image file'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Image size should be less than 5MB'); return; }
    if ((editingItem.images || []).length >= MAX_PHOTOS) { setError(`You can add up to ${MAX_PHOTOS} photos only`); return; }
    setImageUploading(true);
    setError('');
    const reader = new FileReader();
    reader.onloadend = () => {
      setEditingItem(prev => prev ? { ...prev, images: [...(prev.images || []), reader.result as string] } : null);
      setImageUploading(false);
    };
    reader.onerror = () => { setError('Failed to read image file'); setImageUploading(false); };
    reader.readAsDataURL(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  const openEditCamera = async () => {
    setError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera not supported');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      editStreamRef.current = stream;
      setEditCameraOpen(true);
    } catch {
      editCameraInputRef.current?.click();
    }
  };

  const closeEditCamera = () => {
    if (editStreamRef.current) {
      editStreamRef.current.getTracks().forEach(t => t.stop());
      editStreamRef.current = null;
    }
    setEditCameraOpen(false);
  };

  const captureEditPhoto = () => {
    const video = editVideoRef.current;
    if (!video || !editingItem) return;
    if ((editingItem.images || []).length >= MAX_PHOTOS) { setError(`You can add up to ${MAX_PHOTOS} photos only`); closeEditCamera(); return; }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      setEditingItem(prev => prev ? { ...prev, images: [...(prev.images || []), dataUrl] } : null);
    }
    closeEditCamera();
  };

  useEffect(() => {
    if (editCameraOpen && editStreamRef.current && editVideoRef.current) {
      editVideoRef.current.srcObject = editStreamRef.current;
      editVideoRef.current.play().catch(() => {});
    }
  }, [editCameraOpen]);

  useEffect(() => {
    return () => {
      if (editStreamRef.current) {
        editStreamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

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

      const newPhotos = editingItem.images && editingItem.images.length > 0 ? editingItem.images : [];

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
            hsn_code: editingItem.hsn_code,
            photos: newPhotos,
            floor: size.floor_id || null,
            modified_by: userRecord?.id || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', size.batch_id);
      }

      // Also update product_masters photos if a matching master exists
      if (editingItem.design_no && editingItem.vendor_id) {
        await supabase
          .from('product_masters')
          .update({ photos: newPhotos, updated_at: new Date().toISOString() })
          .eq('design_no', editingItem.design_no)
          .eq('vendor', editingItem.vendor_id);
      }

      setSuccess('Inventory updated successfully!');
      
      // Clear all caches on edit to ensure fresh data
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('inventory_cache_') || key === GLOBAL_CACHE_KEY) {
          localStorage.removeItem(key);
        }
      });

      setEditingItem(null);
      await loadInventory(currentPage, true);

      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('Error updating inventory:', err);
      setError(err.message || 'Failed to update inventory');
    } finally {
      setSaving(false);
    }
  };

  const handleEditingItemFieldChange = (field: string, value: any) => {
    if (!editingItem) return;
    
    setEditingItem(prev => {
      if (!prev) return null;
      const updated = { ...prev, [field]: value };
      
      if (field === 'cost' || field === 'mrp_markup_percent' || field === 'gst_logic') {
        const cost = typeof updated.cost === 'string' ? parseFloat(updated.cost) : updated.cost;
        const markup = typeof updated.mrp_markup_percent === 'string' ? parseFloat(updated.mrp_markup_percent) : updated.mrp_markup_percent;
        
        if (cost) {
          const basePrice = cost * (1 + markup / 100);
          let gstMultiplier = 1.05;
          if (updated.gst_logic === 'AUTO_5_18') {
            const estimatedMRP = basePrice * 1.05;
            gstMultiplier = estimatedMRP < 2500 ? 1.05 : 1.18;
          }
          updated.mrp = parseFloat((basePrice * gstMultiplier).toFixed(2));
        }
      } else if (field === 'mrp') {
        const cost = typeof updated.cost === 'string' ? parseFloat(updated.cost) : updated.cost;
        const mrp = typeof updated.mrp === 'string' ? parseFloat(updated.mrp) : updated.mrp;
        
        if (cost && mrp) {
          let gstMultiplier = 1.05;
          if (updated.gst_logic === 'AUTO_5_18') {
            gstMultiplier = mrp < 2500 ? 1.05 : 1.18;
          } else if (updated.gst_logic === 'FLAT_5') {
            gstMultiplier = 1.05;
          }
          
          const basePrice = mrp / gstMultiplier;
          const markup = ((basePrice / cost) - 1) * 100;
          updated.mrp_markup_percent = parseFloat(markup.toFixed(2));
        }
      }
      
      return updated;
    });
  };


  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center">
          <Package className="w-8 h-8 text-emerald-600 mr-3" />
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Inventory</h1>
            <div className="flex gap-2 mt-1">
              <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
                Master Records: {totalCount}
              </span>
              <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                Visible Variations: {totalCount > 400 ? 'Syncing...' : 'Live'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {isSyncing && (
            <div className="flex items-center text-emerald-600 animate-pulse">
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              <span className="text-xs font-medium">Syncing...</span>
            </div>
          )}
          <button
            onClick={() => loadInventory(currentPage, true)}
            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 transition flex items-center shadow-md"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setCurrentPage(1);
                  loadInventory(1);
                }
              }}
              className="w-full pl-10 pr-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Search by design or description and press Enter..."
            />
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700">
            {error}
          </div>
        )}

        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Showing <span className="font-bold text-emerald-700">{groupedItems.length}</span> unique items on this page • Total Unique Designs: <span className="font-bold text-emerald-700">{totalCount}</span>
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1 || loading}
              className="px-3 py-1 border-2 border-gray-200 rounded-lg hover:border-emerald-500 disabled:opacity-50"
            >
              Previous
            </button>
            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 font-bold rounded-lg border-2 border-emerald-200">
              Page {currentPage} of {Math.ceil(totalCount / pageSize)}
            </span>
            <button
              onClick={() => setCurrentPage(p => p + 1)}
              disabled={currentPage >= Math.ceil(totalCount / pageSize) || loading}
              className="px-3 py-1 border-2 border-gray-200 rounded-lg hover:border-emerald-500 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedItems.map((item, idx) => (
              <div
                key={`${item.design_no}-${item.vendor_code}-${idx}`}
                className={`border-2 rounded-lg p-4 hover:shadow-lg transition ${
                  item.from_product_master
                    ? 'border-blue-200 bg-blue-50 hover:border-blue-400'
                    : item.total_defective > 0
                    ? 'border-red-400 bg-red-50 hover:border-red-500'
                    : 'border-gray-200 hover:border-emerald-300'
                }`}
              >
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-32 h-32 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                    {item.images && (Array.isArray(item.images) ? item.images.length > 0 : !!item.images) ? (
                      <img
                        src={Array.isArray(item.images) ? item.images[0] : item.images}
                        alt={item.design_no}
                        className="w-full h-full object-cover cursor-pointer hover:opacity-80"
                        onClick={() => setSelectedImage(Array.isArray(item.images) ? item.images[0] : item.images)}
                        onError={(e) => {
                          e.currentTarget.src = '';
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.parentElement!.innerHTML = '<div class="text-gray-400"><svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg></div>';
                        }}
                      />
                    ) : (
                      <div className="text-gray-400 flex flex-col items-center">
                        <ImageIcon className="w-12 h-12" />
                        <div className="text-[9px] font-bold text-center mt-1">
                          Photos: {item.images?.length || 0}
                          {item.images && item.images.length > 0 && typeof item.images[0] !== 'string' && (
                            <div className="text-red-500 font-bold">Invalid Format</div>
                          )}
                          {item.from_product_master && <div className="text-blue-500">(Master)</div>}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-xl font-bold text-gray-800">{item.design_no}</h3>
                          {item.from_product_master && (
                            <span className="text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-300 px-2 py-0.5 rounded-full">
                              No Stock Received
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 font-medium">
                          {item.product_group_name} • {item.color_name} • HSN: {item.hsn_code}
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
                      {item.from_product_master && item.sizes.length === 0 && (
                        <p className="text-xs text-blue-600 italic">
                          This product has been registered but no stock has been received yet. Add stock via Purchase Invoice.
                        </p>
                      )}
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

            {groupedItems.length === 0 && (
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
                      handleEditingItemFieldChange('cost', val === '' ? 0 : val);
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
                      handleEditingItemFieldChange('mrp_markup_percent', val === '' ? 0 : val);
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
                      handleEditingItemFieldChange('mrp', val === '' ? 0 : val);
                    }}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">GST Logic</label>
                  <select
                    value={editingItem.gst_logic}
                    onChange={(e) => handleEditingItemFieldChange('gst_logic', e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="AUTO_5_18">AUTO (5% if &lt;2500, else 18%)</option>
                    <option value="FLAT_5">FLAT 5%</option>
                  </select>
                </div>
 
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">HSN Code</label>
                  <input
                    type="text"
                    value={editingItem.hsn_code}
                    onChange={(e) => setEditingItem({ ...editingItem, hsn_code: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
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

              {/* Product Images (up to 3) */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Product Photos <span className="text-gray-400 font-normal">({(editingItem.images || []).length}/{MAX_PHOTOS})</span>
                </label>
                <div className="flex gap-3 items-start flex-wrap">
                  {/* Existing image thumbnails */}
                  {(editingItem.images || []).map((img, imgIdx) => (
                    <div key={imgIdx} className="relative w-28 h-28 border-2 border-gray-300 rounded-lg overflow-hidden flex items-center justify-center bg-gray-100 flex-shrink-0">
                      <img
                        src={img}
                        alt={`Product ${imgIdx + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <button
                        type="button"
                        onClick={() => setEditingItem({ ...editingItem, images: editingItem.images.filter((_, i) => i !== imgIdx) })}
                        className="absolute top-1 right-1 p-1 bg-white/80 rounded-full shadow hover:bg-white"
                        title="Remove photo"
                      >
                        <X className="w-4 h-4 text-gray-700" />
                      </button>
                      <span className="absolute bottom-1 left-1 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded">{imgIdx + 1}</span>
                    </div>
                  ))}

                  {/* Add photo slots */}
                  {(editingItem.images || []).length < MAX_PHOTOS && (
                    <div className="flex flex-col gap-2">
                      <label className={`px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer flex items-center text-sm ${imageUploading ? 'opacity-70 pointer-events-none' : ''}`}>
                        {imageUploading ? (
                          <Loader className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4 mr-2" />
                        )}
                        Upload Photo
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleEditImageUpload}
                          className="hidden"
                          disabled={imageUploading}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={openEditCamera}
                        disabled={imageUploading}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center text-sm disabled:opacity-50"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Take Photo
                      </button>
                      <input
                        ref={editCameraInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleEditImageUpload}
                        className="hidden"
                      />
                      <p className="text-xs text-gray-500">Max 5MB per photo. Up to {MAX_PHOTOS} photos.</p>
                    </div>
                  )}
                </div>

                {/* Inline camera preview */}
                {editCameraOpen && (
                  <div className="mt-3 border-2 border-emerald-400 rounded-lg overflow-hidden bg-black">
                    <div className="aspect-video">
                      <video ref={editVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                    </div>
                    <div className="flex gap-3 justify-center p-3 bg-gray-900">
                      <button
                        type="button"
                        onClick={captureEditPhoto}
                        className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 text-sm"
                      >
                        Capture
                      </button>
                      <button
                        type="button"
                        onClick={closeEditCamera}
                        className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
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
