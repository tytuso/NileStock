const GENERIC_CASHIER_NAMES = new Set([
  "cashier",
  "google user",
  "owner",
  "shop owner",
]);

export function resolveCashierName(name?: string, email?: string) {
  const preferred = name?.trim() || "";
  if (preferred && !GENERIC_CASHIER_NAMES.has(preferred.toLowerCase()))
    return preferred;

  const accountEmail = email?.trim() || "";
  if (accountEmail) return accountEmail;

  return preferred || "Signed-in user";
}
