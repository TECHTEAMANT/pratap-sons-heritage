const ENCODING_MAP: { [key: string]: string } = {
  '0': 'C',
  '1': 'R',
  '2': 'A',
  '3': 'Z',
  '4': 'Y',
  '5': 'W',
  '6': 'O',
  '7': 'M',
  '8': 'E',
  '9': 'N',
  '.': 'X',
};

const DECODING_MAP: { [key: string]: string } = {
  'C': '0',
  'R': '1',
  'A': '2',
  'Z': '3',
  'Y': '4',
  'W': '5',
  'O': '6',
  'M': '7',
  'E': '8',
  'N': '9',
  'X': '.',
};

export function encodeCostForVendor(cost: number | string, vendorName: string): string {
  const costStr = typeof cost === 'number' ? cost.toString() : cost;

  if (vendorName.toUpperCase().includes('CRAZY') || vendorName.toUpperCase().includes('WOMEN')) {
    return costStr
      .split('')
      .map(char => ENCODING_MAP[char] || char)
      .join('');
  }

  return costStr;
}

export function decodeCostFromBarcode(encodedCost: string): string {
  return encodedCost
    .split('')
    .map(char => DECODING_MAP[char] || char)
    .join('');
}
