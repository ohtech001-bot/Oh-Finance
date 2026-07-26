export function displayOrderNumber(number: string): string {
  return number.replace(/^ORD-?/i, '');
}
