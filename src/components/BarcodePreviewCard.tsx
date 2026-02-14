import React, { useEffect, useState } from 'react';
import { generateBarcodeDataURL } from '../utils/barcodeGenerator';

interface BarcodePreviewCardProps {
  barcode: {
    barcode_id: string;
    design_no: string;
    product_group_name: string;
    color_name: string;
    size_name: string;
    mrp: number;
    invoice_number?: string;
    order_number?: string;
    is_sample?: boolean;
    total_qty?: number;
  };
}

export default function BarcodePreviewCard({ barcode }: BarcodePreviewCardProps) {
  const [barcodeImage, setBarcodeImage] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(false);

    const generateBarcode = () => {
      try {
        const dataURL = generateBarcodeDataURL(barcode.barcode_id, {
          width: 3,
          height: 60,
          displayValue: false,
        });

        if (mounted && dataURL) {
          setBarcodeImage(dataURL);
          setLoading(false);
        } else if (mounted) {
          setError(true);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error generating barcode:', err);
        if (mounted) {
          setError(true);
          setLoading(false);
        }
      }
    };

    setTimeout(generateBarcode, 0);

    return () => {
      mounted = false;
    };
  }, [barcode.barcode_id]);

  return (
    <div className="relative">
      <div className="border-2 border-gray-300 rounded-lg p-4 bg-white shadow-sm">
        <div className="text-center mb-2">
          <strong className="text-sm font-bold">{barcode.product_group_name}</strong>
        </div>
        <div className="text-center text-xs mb-2 text-gray-700">
          {barcode.design_no} | {barcode.color_name} | {barcode.size_name}
        </div>
        {(barcode.invoice_number || barcode.order_number) && (
          <div className="text-center text-xs text-gray-600 mb-2">
            {barcode.order_number ? `Ord: ${barcode.order_number}` : `Inv: ${barcode.invoice_number}`}
          </div>
        )}

        <div className="flex justify-center my-3 bg-white p-2 border border-gray-200 rounded min-h-[70px] items-center">
          {loading && (
            <div className="text-xs text-gray-400">Generating...</div>
          )}
          {error && (
            <div className="text-xs text-red-500">Error generating barcode</div>
          )}
          {!loading && !error && barcodeImage && (
            <img src={barcodeImage} alt="Barcode" className="max-w-full h-auto" style={{ pointerEvents: 'none' }} />
          )}
        </div>

        <div
          className="text-center text-xs font-mono font-medium my-2 text-gray-700"
          style={{ fontFamily: "'Courier New', monospace", letterSpacing: '0.5px' }}
        >
          {barcode.barcode_id}
        </div>
        <div className="text-center text-base font-bold text-blue-600">
          MRP: ₹{parseFloat(barcode.mrp.toString()).toFixed(2)}
        </div>
      </div>
      {barcode.is_sample && barcode.total_qty && (
        <div className="absolute top-2 right-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded-full font-medium">
          +{barcode.total_qty - 2} more
        </div>
      )}
    </div>
  );
}
