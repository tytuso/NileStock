import type { Business } from "./types";

export const DEFAULT_THEME: Business["theme"] = "light";

export function shouldUseDarkTheme(
  theme: Business["theme"] | null | undefined,
  systemPrefersDark = false,
) {
  return theme === "dark" || (theme === "system" && systemPrefersDark);
}
