import type { AppData } from "./types";

export type WorkspaceBackup = {
  savedAt: string;
  payload: AppData;
};

export const workspaceBackupKey = (businessId: string) =>
  `nilestock.workspace.v10.${businessId}`;

export function isAppData(value: unknown): value is AppData {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AppData>;
  return Boolean(
    candidate.business &&
      typeof candidate.business === "object" &&
      Array.isArray(candidate.products) &&
      Array.isArray(candidate.sales) &&
      Array.isArray(candidate.movements),
  );
}

export function parseWorkspaceBackup(value: string | null) {
  if (!value) return null;
  try {
    const backup = JSON.parse(value) as Partial<WorkspaceBackup>;
    if (!backup.savedAt || !isAppData(backup.payload)) return null;
    return backup as WorkspaceBackup;
  } catch {
    return null;
  }
}

export function parseLegacyWorkspace(
  value: string | null,
  email: string,
  businessName: string,
) {
  if (!value) return null;
  try {
    const workspace = JSON.parse(value) as unknown;
    if (!isAppData(workspace)) return null;
    const savedEmail = workspace.business.email.trim().toLowerCase();
    const savedBusiness = workspace.business.name.trim().toLowerCase();
    const accountMatches =
      (savedEmail && savedEmail === email.trim().toLowerCase()) ||
      (savedBusiness && savedBusiness === businessName.trim().toLowerCase());
    return accountMatches ? workspace : null;
  } catch {
    return null;
  }
}

export function selectNewestWorkspace({
  cloudPayload,
  cloudUpdatedAt,
  localBackup,
}: {
  cloudPayload: unknown;
  cloudUpdatedAt?: string | null;
  localBackup: WorkspaceBackup | null;
}): { payload: AppData | null; source: "cloud" | "local" | "empty" } {
  const cloud = isAppData(cloudPayload) ? cloudPayload : null;
  const cloudTime = cloudUpdatedAt ? Date.parse(cloudUpdatedAt) : 0;
  const localTime = localBackup ? Date.parse(localBackup.savedAt) : 0;

  if (
    localBackup &&
    (!cloud || (Number.isFinite(localTime) && localTime > cloudTime))
  )
    return { payload: localBackup.payload, source: "local" };
  if (cloud) return { payload: cloud, source: "cloud" };
  return { payload: null, source: "empty" };
}

export function saveWorkspaceBackup(businessId: string, payload: AppData) {
  const backup: WorkspaceBackup = {
    savedAt: new Date().toISOString(),
    payload,
  };
  try {
    localStorage.setItem(workspaceBackupKey(businessId), JSON.stringify(backup));
  } catch {
    // Cloud sync still proceeds if storage is unavailable or full.
  }
  return backup;
}
