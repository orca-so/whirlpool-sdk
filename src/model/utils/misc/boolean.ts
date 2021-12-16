export function xor(a: any, b: any): boolean {
  const bitA = Boolean(a) ? 1 : 0;
  const bitB = Boolean(b) ? 1 : 0;

  return Boolean(bitA ^ bitB);
}
