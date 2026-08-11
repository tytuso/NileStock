import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, shouldUseDarkTheme } from "./theme";

describe("theme defaults", () => {
  it("opens new and unconfigured workspaces in light mode", () => {
    expect(DEFAULT_THEME).toBe("light");
    expect(shouldUseDarkTheme(undefined, true)).toBe(false);
  });

  it("still respects deliberate dark and system choices", () => {
    expect(shouldUseDarkTheme("dark", false)).toBe(true);
    expect(shouldUseDarkTheme("light", true)).toBe(false);
    expect(shouldUseDarkTheme("system", true)).toBe(true);
  });
});
