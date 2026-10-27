import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppData } from "./types";

export class WorkspaceConflictError extends Error {
  constructor() {
    super("The shared workspace changed on another device. Refresh and retry.");
    this.name = "WorkspaceConflictError";
  }
}

/** The RPC commits the workspace and business name in the same transaction. */
export async function saveCloudWorkspace(
  client: SupabaseClient,
  businessId: string,
  payload: AppData,
  expectedRevision: number,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const { data, error } = await client
      .rpc("nilestock_save_workspace", {
        p_business_id: businessId,
        p_payload: payload,
        p_expected_revision: expectedRevision,
      })
      .abortSignal(controller.signal);
    if (error) throw new Error(error.message);
    const saved = Array.isArray(data) ? data[0] : undefined;
    if (!saved) throw new WorkspaceConflictError();
    if (!Number.isSafeInteger(saved.revision) || saved.revision <= expectedRevision)
      throw new Error("The server did not confirm the workspace save.");
    return saved.revision as number;
  } finally {
    clearTimeout(timeout);
  }
}
