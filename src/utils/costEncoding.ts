const ENCODING_MAP: { [key: string]: string } = {
  '1': 'C',
  '2': 'R',
  '3': 'A',
  '4': 'Z',
  '5': 'Y',
  '6': 'W',
  '7': 'O',
  '8': 'M',
  '9': 'E',
  '0': 'N',
  '.': 'X',
};

const DECODING_MAP: { [key: string]: string } = {
  'C': '1',
  'R': '2',
  'A': '3',
  'Z': '4',
  'Y': '5',
  'W': '6',
  'O': '7',
  'M': '8',
  'E': '9',
  'N': '0',
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
