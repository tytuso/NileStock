import { describe, expect, it } from "vitest";
import { resolveNileStockAuthRedirect } from "./auth-redirect";

describe("resolveNileStockAuthRedirect", () => {
  it("prefers the configured nilestock.shop production site", () => {
    expect(
      resolveNileStockAuthRedirect({
        configuredUrl: "https://nilestock.shop",
        currentOrigin: "https://nilestock-preview-team.vercel.app",
      }),
    ).toBe("https://nilestock.shop/");
  });

  it("keeps a NileStock Vercel preview when no site is configured", () => {
    expect(
      resolveNileStockAuthRedirect({
        currentOrigin: "https://nilestock-aaukwtgia-team.vercel.app",
      }),
    ).toBe("https://nilestock-aaukwtgia-team.vercel.app/");
  });

  it("still supports the old NileStock domain during migration", () => {
    expect(
      resolveNileStockAuthRedirect({
        currentOrigin: "https://nilestock.nileai.solutions",
      }),
    ).toBe("https://nilestock.nileai.solutions/");
  });

  it("rejects a configured URL for another Nile app", () => {
    expect(
      resolveNileStockAuthRedirect({
        configuredUrl: "https://zabuni.nileai.solutions",
        currentOrigin: "https://nilestock.shop",
      }),
    ).toBe("https://nilestock.shop/");
  });

  it("supports local development", () => {
    expect(
      resolveNileStockAuthRedirect({
        currentOrigin: "http://localhost:3000",
      }),
    ).toBe("http://localhost:3000/");
  });

  it("falls back to nilestock.shop", () => {
    expect(
      resolveNileStockAuthRedirect({
        configuredUrl: "not a URL",
        currentOrigin: "https://zabuni.nileai.solutions",
      }),
    ).toBe("https://nilestock.shop/");
  });
});