import type { AppData } from "./types";

export type WorkspaceBackup = {
  savedAt: string;
  payload: AppData;
  /** The server revision that the local payload was based on. */
  cloudRevision?: number;
  /** Last acknowledged cloud payload, retained for offline three-way merges. */
  basePayload?: AppData;
};

type IdentifiedRecord = { id: string };
type CollectionKey = Exclude<keyof AppData, "business" | "onboarded">;

const collectionKeys: CollectionKey[] = [
  "products",
  "sales",
  "customers",
  "suppliers",
  "expenses",
  "purchases",
  "movements",
  "staff",
  "audit",
  "shifts",
  "held",
  "requests",
  "managedBusinesses",
];

function sameValue(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function mergeCollection<T extends IdentifiedRecord>(
  base: T[] | undefined,
  local: T[] | undefined,
  remote: T[] | undefined,
) {
  const baseById = new Map((base || []).map((item) => [item.id, item]));
  const localById = new Map((local || []).map((item) => [item.id, item]));
  const remoteById = new Map((remote || []).map((item) => [item.id, item]));
  const ids = new Set([...baseById.keys(), ...localById.keys(), ...remoteById.keys()]);
  const merged: T[] = [];

  for (const id of ids) {
    const original = baseById.get(id);
    const localItem = localById.get(id);
    const remoteItem = remoteById.get(id);
    const localChanged = !sameValue(original, localItem);
    const remoteChanged = !sameValue(original, remoteItem);

    // A simultaneous edit of the same record has no record-level timestamp in
    // the current data model. Keeping the cloud version prevents a stale local
    // snapshot from overwriting it; independent records are still merged below.
    const selected =
      localChanged && !remoteChanged
        ? localItem
        : remoteChanged
          ? remoteItem
          : localItem || remoteItem;
    if (selected) merged.push(selected);
  }
  return merged;
}

/**
 * Three-way merge used after an optimistic workspace write loses a revision
 * race. It preserves independent additions/changes and deliberately lets the
 * server win when two devices changed the same record from the same baseline.
 */
export function mergeWorkspaceChanges(
  base: AppData,
  local: AppData,
  remote: AppData,
): AppData {
  const merged = { ...remote } as AppData;
  for (const key of collectionKeys) {
    const baseValue = base[key] as IdentifiedRecord[] | undefined;
    const localValue = local[key] as IdentifiedRecord[] | undefined;
    const remoteValue = remote[key] as IdentifiedRecord[] | undefined;
    (merged as Record<string, unknown>)[key] = mergeCollection(
      baseValue,
      localValue,
      remoteValue,
    );
  }

  if (!sameValue(base.business, local.business) && sameValue(base.business, remote.business))
    merged.business = local.business;
  if (base.onboarded !== local.onboarded && base.onboarded === remote.onboarded)
    merged.onboarded = local.onboarded;
  return merged;
}

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
    if (
      !backup.savedAt ||
      !isAppData(backup.payload) ||
      (backup.basePayload !== undefined && !isAppData(backup.basePayload)) ||
      (backup.cloudRevision !== undefined &&
        (!Number.isInteger(backup.cloudRevision) || backup.cloudRevision < 0))
    )
      return null;
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
  cloudRevision,
  localBackup,
}: {
  cloudPayload: unknown;
  cloudUpdatedAt?: string | null;
  cloudRevision?: number | null;
  localBackup: WorkspaceBackup | null;
}): { payload: AppData | null; source: "cloud" | "local" | "empty" } {
  const cloud = isAppData(cloudPayload) ? cloudPayload : null;
  const cloudTime = cloudUpdatedAt ? Date.parse(cloudUpdatedAt) : 0;
  const localTime = localBackup ? Date.parse(localBackup.savedAt) : 0;

  // A backup based on an older server revision must not replace a workspace
  // that changed while this device was offline. Entry merges it separately
  // when its retained base payload makes that safe.
  if (
    cloud &&
    localBackup?.cloudRevision !== undefined &&
    typeof cloudRevision === "number" &&
    localBackup.cloudRevision < cloudRevision
  )
    return { payload: cloud, source: "cloud" };

  if (
    localBackup &&
    (!cloud || (Number.isFinite(localTime) && localTime > cloudTime))
  )
    return { payload: localBackup.payload, source: "local" };
  if (cloud) return { payload: cloud, source: "cloud" };
  return { payload: null, source: "empty" };
}

export function saveWorkspaceBackup(
  businessId: string,
  payload: AppData,
  cloudRevision?: number | null,
  basePayload?: AppData | null,
) {
  const existing = parseWorkspaceBackup(
    localStorage.getItem(workspaceBackupKey(businessId)),
  );
  const backup: WorkspaceBackup = {
    savedAt: new Date().toISOString(),
    payload,
    cloudRevision:
      typeof cloudRevision === "number"
        ? cloudRevision
        : existing?.cloudRevision,
    basePayload: basePayload || existing?.basePayload,
  };
  try {
    localStorage.setItem(workspaceBackupKey(businessId), JSON.stringify(backup));
  } catch {
    // Cloud sync still proceeds if storage is unavailable or full.
  }
  return backup;
}
