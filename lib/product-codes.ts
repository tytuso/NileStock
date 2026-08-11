import type { Product } from "./types";

export function findProductByCode(products: Product[], rawCode: string) {
  const code = rawCode.trim().toLowerCase();
  if (!code) return undefined;
  return products.find(
    (product) =>
      product.barcode.trim().toLowerCase() === code ||
      product.qr.trim().toLowerCase() === code ||
      product.sku.trim().toLowerCase() === code,
  );
}
