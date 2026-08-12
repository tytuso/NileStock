import { describe, expect, it } from "vitest";
import type { CartItem } from "./types";
import {
  disableNegotiatedPrice,
  enableNegotiatedPrice,
  hasValidSalePrice,
  updateNegotiatedPrice,
} from "./negotiated-price";

const item: CartItem = {
  productId: "product-1",
  name: "Plastic basin",
  price: 20_000,
  cost: 12_000,
  qty: 1,
  discount: 0,
};

describe("negotiated cart prices", () => {
  it("keeps normal products unchanged until negotiation is enabled", () => {
    expect(hasValidSalePrice(item)).toBe(true);
    expect(item).not.toHaveProperty("negotiated");
  });

  it("stores the listed price and applies the agreed price", () => {
    const negotiated = updateNegotiatedPrice(
      enableNegotiatedPrice(item),
      17_000,
    );
    expect(negotiated).toMatchObject({
      price: 17_000,
      originalPrice: 20_000,
      negotiated: true,
    });
  });

  it("restores the listed price when negotiation is turned off", () => {
    const restored = disableNegotiatedPrice(
      updateNegotiatedPrice(enableNegotiatedPrice(item), 17_000),
    );
    expect(restored.price).toBe(20_000);
    expect(restored).not.toHaveProperty("negotiated");
    expect(restored).not.toHaveProperty("originalPrice");
  });

  it("blocks a negotiated sale until a positive agreed price exists", () => {
    expect(
      hasValidSalePrice(updateNegotiatedPrice(enableNegotiatedPrice(item), 0)),
    ).toBe(false);
  });
});
