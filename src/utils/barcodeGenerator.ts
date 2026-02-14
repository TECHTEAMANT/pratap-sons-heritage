import JsBarcode from 'jsbarcode';

export function generateBarcodeDataURL(text: string, options?: {
  width?: number;
  height?: number;
  displayValue?: boolean;
  fontSize?: number;
}): string {
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 150;

  try {
    JsBarcode(canvas, text, {
      format: 'CODE128',
      width: options?.width || 3,
      height: options?.height || 80,
      displayValue: options?.displayValue ?? false,
      fontSize: options?.fontSize || 14,
      margin: 10,
      background: '#ffffff',
      lineColor: '#000000',
    });

    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Error generating barcode:', error);
    return '';
  }
}

export function generateBarcodeSVG(text: string, options?: {
  width?: number;
  height?: number;
  displayValue?: boolean;
  fontSize?: number;
}): string {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

  try {
    JsBarcode(svg, text, {
      format: 'CODE128',
      width: options?.width || 3,
      height: options?.height || 80,
      displayValue: options?.displayValue ?? false,
      fontSize: options?.fontSize || 14,
      margin: 10,
      background: '#ffffff',
      lineColor: '#000000',
    });

    const serializer = new XMLSerializer();
    return serializer.serializeToString(svg);
  } catch (error) {
    console.error('Error generating barcode:', error);
    return '';
  }
}
