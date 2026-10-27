import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { demoData } from "./utils";
import { saveCloudWorkspace, WorkspaceConflictError } from "./workspace-save";
import { mergeWorkspaceChanges } from "./workspace-backup";

function clientWithFetch(fetch: typeof globalThis.fetch) {
  return createClient("https://example.supabase.co", "publishable-test-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch },
  });
}

describe("confirmed workspace saves", () => {
  it("executes the real Supabase request and waits for the server acknowledgement", async () => {
    let respond!: (response: Response) => void;
    const fetch = vi.fn(() => new Promise<Response>((resolve) => { respond = resolve; }));
    const payload = demoData();
    payload.business.name = "Renamed shop";
    let confirmed = false;
    const saving = saveCloudWorkspace(clientWithFetch(fetch), "business-1", payload, 3)
      .then((revision) => { confirmed = true; return revision; });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(confirmed).toBe(false);
    const [url, request] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://example.supabase.co/rest/v1/rpc/nilestock_save_workspace");
    expect(JSON.parse(String(request.body))).toEqual({
      p_business_id: "business-1", p_payload: payload, p_expected_revision: 3,
    });
    respond(new Response(JSON.stringify([{ revision: 4 }]), { status: 200 }));
    expect(await saving).toBe(4);
    expect(confirmed).toBe(true);
  });

  it("does not report a revision conflict as a successful save", async () => {
    const client = clientWithFetch(async () => new Response("[]", { status: 200 }));
    await expect(saveCloudWorkspace(client, "business-1", demoData(), 3))
      .rejects.toBeInstanceOf(WorkspaceConflictError);
  });

  it("surfaces a database error instead of showing success", async () => {
    const client = clientWithFetch(async () => new Response(JSON.stringify({ message: "Access denied" }), { status: 403 }));
    await expect(saveCloudWorkspace(client, "business-1", demoData(), 3))
      .rejects.toThrow("Access denied");
  });

  it("rejects a malformed or unadvanced acknowledgement", async () => {
    for (const revision of ["4", 3, 2, null]) {
      const client = clientWithFetch(async () => new Response(JSON.stringify([{ revision }]), { status: 200 }));
      await expect(saveCloudWorkspace(client, "business-1", demoData(), 3))
        .rejects.toThrow("did not confirm");
    }
  });

  it("keeps an offline rename when another device changes a different setting", () => {
    const base = demoData();
    const local = { ...base, business: { ...base.business, name: "New name", phone: "+256700000000" } };
    const remote = { ...base, business: { ...base.business, theme: "dark" as const } };
    const merged = mergeWorkspaceChanges(base, local, remote);
    expect(merged.business.name).toBe("New name");
    expect(merged.business.phone).toBe("+256700000000");
    expect(merged.business.theme).toBe("dark");
  });

  it("keeps the cloud value for a conflicting edit of the same field", () => {
    const base = demoData();
    const local = { ...base, business: { ...base.business, name: "Local name", phone: "New phone" } };
    const remote = { ...base, business: { ...base.business, name: "Remote name" } };
    const merged = mergeWorkspaceChanges(base, local, remote);
    expect(merged.business.name).toBe("Remote name");
    expect(merged.business.phone).toBe("New phone");
  });
});
