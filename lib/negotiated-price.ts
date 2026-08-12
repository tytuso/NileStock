import type { CartItem } from "./types";

export function enableNegotiatedPrice(item: CartItem): CartItem {
  if (item.negotiated) return item;
  return {
    ...item,
    negotiated: true,
    originalPrice: item.originalPrice ?? item.price,
  };
}

export function disableNegotiatedPrice(item: CartItem): CartItem {
  const { negotiated: _negotiated, originalPrice, ...rest } = item;
  return {
    ...rest,
    price: originalPrice ?? item.price,
  };
}

export function updateNegotiatedPrice(
  item: CartItem,
  price: number,
): CartItem {
  return {
    ...enableNegotiatedPrice(item),
    price: Number.isFinite(price) ? Math.max(0, price) : 0,
  };
}

export function hasValidSalePrice(item: CartItem) {
  return !item.negotiated || item.price > 0;
}
