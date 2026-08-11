import { describe, expect, it } from "vitest";
import { resolveNileStockAuthRedirect } from "./auth-redirect";

describe("resolveNileStockAuthRedirect", () => {
  it("prefers the configured NileStock site", () => {
    expect(
      resolveNileStockAuthRedirect({
        configuredUrl: "https://nilestock.nileai.solutions/path",
        currentOrigin: "https://nilestock-preview-team.vercel.app",
      }),
    ).toBe("https://nilestock.nileai.solutions/");
  });

  it("keeps a NileStock Vercel preview when no site is configured", () => {
    expect(
      resolveNileStockAuthRedirect({
        currentOrigin: "https://nilestock-aaukwtgia-team.vercel.app",
      }),
    ).toBe("https://nilestock-aaukwtgia-team.vercel.app/");
  });

  it("rejects a configured URL for another Nile app", () => {
    expect(
      resolveNileStockAuthRedirect({
        configuredUrl: "https://zabuni.nileai.solutions",
        currentOrigin: "https://nilestock-preview-team.vercel.app",
      }),
    ).toBe("https://nilestock-preview-team.vercel.app/");
  });

  it("supports local development", () => {
    expect(
      resolveNileStockAuthRedirect({
        currentOrigin: "http://localhost:3000",
      }),
    ).toBe("http://localhost:3000/");
  });

  it("falls back to the stable NileStock deployment", () => {
    expect(
      resolveNileStockAuthRedirect({
        configuredUrl: "not a URL",
        currentOrigin: "https://zabuni.nileai.solutions",
      }),
    ).toBe("https://nilestock.vercel.app/");
  });
});
