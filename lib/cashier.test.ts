import { describe, expect, it } from "vitest";
import { resolveCashierName } from "./cashier";

describe("cashier receipt identity", () => {
  it("uses the signed-in display name when available", () => {
    expect(resolveCashierName("Titus Tytus", "titus@example.com")).toBe(
      "Titus Tytus",
    );
  });

  it("uses the account email instead of a generic role", () => {
    expect(resolveCashierName("Cashier", "cashier@example.com")).toBe(
      "cashier@example.com",
    );
    expect(resolveCashierName("Shop Owner", "owner@example.com")).toBe(
      "owner@example.com",
    );
  });

  it("keeps an edited receipt name", () => {
    expect(resolveCashierName("Front Desk - Sarah", "owner@example.com")).toBe(
      "Front Desk - Sarah",
    );
  });
});
