const DEFAULT_NILESTOCK_URL = "https://nilestock.vercel.app/";

type RedirectSources = {
  configuredUrl?: string | null;
  currentOrigin?: string | null;
  deploymentUrl?: string | null;
};

function normalizeUrl(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    return new URL(
      /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`,
    );
  } catch {
    return null;
  }
}

function isNileStockHost(hostname: string) {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "[::1]" ||
    host === "nilestock.vercel.app" ||
    host === "nilestock.nileai.solutions" ||
    (host.startsWith("nilestock-") && host.endsWith(".vercel.app"))
  );
}

/**
 * Resolves an OAuth/email return URL that belongs to NileStock. This prevents
 * a shared Supabase project's Site URL from becoming NileStock's intentional
 * auth destination.
 */
export function resolveNileStockAuthRedirect({
  configuredUrl,
  currentOrigin,
  deploymentUrl,
}: RedirectSources) {
  for (const source of [configuredUrl, currentOrigin, deploymentUrl]) {
    const url = normalizeUrl(source);
    if (url && isNileStockHost(url.hostname)) return `${url.origin}/`;
  }

  return DEFAULT_NILESTOCK_URL;
}
