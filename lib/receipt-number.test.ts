import { describe, expect, it } from "vitest";
import { createReceiptNumber } from "./receipt-number";

describe("receipt numbers", () => {
  it("matches the requested format at an exact hour", () => {
    expect(createReceiptNumber(new Date(2026, 7, 10, 16, 0, 0))).toBe(
      "NS-2026-1008-4PM",
    );
  });

  it("adds minutes and seconds when needed", () => {
    expect(createReceiptNumber(new Date(2026, 7, 10, 16, 7, 35))).toBe(
      "NS-2026-1008-4-07-35PM",
    );
  });

  it("adds a compact suffix rather than duplicating a receipt number", () => {
    const date = new Date(2026, 7, 10, 16, 7, 35);
    expect(
      createReceiptNumber(date, [
        "NS-2026-1008-4-07-35PM",
        "NS-2026-1008-4-07-35PM-2",
      ]),
    ).toBe("NS-2026-1008-4-07-35PM-3");
  });
});
