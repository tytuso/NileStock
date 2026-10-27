import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import type { LanguageModelV4StreamPart } from "@ai-sdk/provider";
import { POST } from "../app/api/ai/route";
import { demoData } from "./utils";

const mocks = vi.hoisted(() => ({ client: vi.fn(), model: vi.fn() }));
vi.mock("@/lib/supabase-server", () => ({ getSupabaseServerClient: mocks.client }));
vi.mock("@ai-sdk/openai", () => ({ openai: mocks.model }));
const businessId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const usage = { inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 10, text: 10, reasoning: undefined } };
const finish = (kind: "stop" | "tool-calls" = "stop"): LanguageModelV4StreamPart => ({ type: "finish", finishReason: { unified: kind, raw: undefined }, usage });
function streamed(parts: LanguageModelV4StreamPart[]) {
  return { stream: new ReadableStream<LanguageModelV4StreamPart>({ start(controller) { for (const part of parts) controller.enqueue(part); controller.close(); } }) };
}
const textParts = (text = "Here is a practical next step."): LanguageModelV4StreamPart[] => [{ type: "text-start", id: "answer" }, { type: "text-delta", id: "answer", delta: text }, { type: "text-end", id: "answer" }, finish()];

function setup() {
  const workspace = demoData(); workspace.business.plan = "pro"; workspace.business.adviserNotes = "Grow repeat customers with a small promotion budget.";
  workspace.products = Array.from({ length: 60 }, (_, i) => ({ id: `p${i}`, name: `Catalog product ${i}`, category: "General", price: 100, cost: 60, sku: `SKU-${i}`, barcode: "", qr: "", stock: 10, reorder: 2, unit: "piece", taxable: false, active: true, createdAt: "2026-01-01T00:00:00Z" }));
  const flags = { plan: "pro", status: "active", workspaceError: false, usageError: false, count: 0, member: true };
  const logged: unknown[] = [];
  const filters: [string, string, unknown][] = [];
  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: userId } }, error: null })) },
    from: vi.fn((table: string) => {
      const conditions = new Map<string, unknown>();
      const result = () => table === "nilestock_business_members"
        ? { data: flags.member && (!conditions.has("business_id") || conditions.get("business_id") === businessId) ? { business_id: businessId, role: "owner", status: "active" } : null, error: null }
        : table === "nilestock_businesses" ? { data: { name: workspace.business.name, plan: flags.plan, status: flags.status }, error: null }
        : table === "nilestock_workspace_data" ? { data: { payload: workspace, updated_at: "2026-10-27T10:00:00Z" }, error: flags.workspaceError ? { message: "Offline" } : null }
        : { count: flags.count, data: [], error: null };
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => { conditions.set(key, value); filters.push([table, key, value]); return query; },
        gte: () => query, order: () => query, limit: () => query,
        single: async () => result(), maybeSingle: async () => result(),
        insert: async (value: unknown) => { logged.push(value); return { error: flags.usageError ? { message: "Cannot log" } : null }; },
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve),
      };
      return query;
    }),
  };
  const model = new MockLanguageModelV4({ doStream: async () => streamed(textParts()) });
  mocks.client.mockReturnValue(client); mocks.model.mockReturnValue(model);
  return { workspace, flags, model, logged, filters, client };
}
const request = (extra: Record<string, unknown> = {}, signedIn = true) => new Request("http://localhost/api/ai", { method: "POST", headers: { "content-type": "application/json", ...(signedIn ? { authorization: "Bearer test-session" } : {}) }, body: JSON.stringify({ businessId, timeZone: "Africa/Kampala", messages: [{ role: "user", content: "What should I do to improve sales?" }], ...extra }) });

beforeEach(() => { vi.stubEnv("OPENAI_API_KEY", "mock-provider-only-no-live-api-call"); vi.stubEnv("OPENAI_MODEL", "gpt-5.6-luna"); mocks.client.mockReset(); mocks.model.mockReset(); });
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("business manager API and real SDK tool loop", () => {
  it("streams an answer with the business brief and fresh, scoped records", async () => {
    const state = setup();
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("practical next step");
    expect(JSON.stringify(state.model.doStreamCalls[0].prompt)).toContain("Grow repeat customers");
    expect(state.filters).toContainEqual(["nilestock_business_members", "business_id", businessId]);
    expect(state.logged).toHaveLength(1);
    expect(mocks.model).toHaveBeenCalledWith("gpt-5.6-luna");
    expect(state.model.doStreamCalls[0].tools?.map((t) => t.type === "function" ? t.name : "")).toEqual(expect.arrayContaining(["business_report", "product_insights", "compare_performance", "pricing_scenario"]));
    expect(state.model.doStreamCalls[0].tools?.every((t) => t.type !== "function" || t.strict === false)).toBe(true);
    expect(state.model.doStreamCalls[0].providerOptions).toMatchObject({ openai: { parallelToolCalls: false } });
  });

  it("executes a product lookup beyond the old first-30 limit and returns its result to the model", async () => {
    const state = setup();
    const model: MockLanguageModelV4 = new MockLanguageModelV4({ doStream: async () => model.doStreamCalls.length === 1
      ? streamed([{ type: "tool-call", toolCallId: "lookup", toolName: "product_insights", input: JSON.stringify({ query: "SKU-59", period: "allTime" }) }, finish("tool-calls")])
      : streamed(textParts("Catalog product 59 has 10 units in stock.")) });
    mocks.model.mockReturnValue(model);
    const response = await POST(request({ messages: [{ role: "user", content: "Tell me about SKU-59." }] }));
    expect(await response.text()).toContain("Catalog product 59");
    expect(model.doStreamCalls).toHaveLength(2);
    expect(JSON.stringify(model.doStreamCalls[1].prompt)).toContain('Catalog product 59');
    expect(JSON.stringify(model.doStreamCalls[1].prompt)).toContain('currentUnitGrossProfit');
    expect(state.logged).toHaveLength(1); // Tool steps do not consume extra daily questions.
  });

  it("bounds repeated lookups and forces a final plain-text answer", async () => {
    setup();
    const model: MockLanguageModelV4 = new MockLanguageModelV4({ doStream: async (options) => options.toolChoice?.type === "none"
      ? streamed(textParts("Here is the plan based on the available records."))
      : streamed([{ type: "tool-call", toolCallId: `lookup-${model.doStreamCalls.length}`, toolName: "business_report", input: JSON.stringify({ period: "today" }) }, finish("tool-calls")]) });
    mocks.model.mockReturnValue(model);
    expect(await (await POST(request())).text()).toContain("Here is the plan");
    expect(model.doStreamCalls).toHaveLength(4);
  });

  it("rejects signed-out access and a workspace outside the user's membership", async () => {
    const state = setup();
    expect((await POST(request({}, false))).status).toBe(401);
    expect((await POST(request({ businessId: "33333333-3333-4333-8333-333333333333" }))).status).toBe(403);
    expect(state.logged).toHaveLength(0);
    expect(mocks.model).not.toHaveBeenCalled();
  });

  it("keeps Pro access and the existing daily allowance enforced", async () => {
    const state = setup(); state.flags.plan = "free";
    expect((await POST(request())).status).toBe(403);
    state.flags.plan = "pro"; state.flags.count = 50;
    expect((await POST(request())).status).toBe(429);
    expect(state.logged).toHaveLength(0);
  });

  it("does not invent business advice if workspace loading or usage logging fails", async () => {
    const state = setup(); state.flags.workspaceError = true;
    expect((await POST(request())).status).toBe(503);
    expect(state.logged).toHaveLength(0);
    state.flags.workspaceError = false; state.flags.usageError = true;
    expect((await POST(request())).status).toBe(503);
    expect(mocks.model).not.toHaveBeenCalled();
  });

  it("propagates provider stream errors instead of silently completing an empty answer", async () => {
    setup(); vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.model.mockReturnValue(new MockLanguageModelV4({ doStream: async () => streamed([{ type: "error", error: new Error("Provider failed") }]) }));
    const response = await POST(request());
    await expect(response.text()).rejects.toThrow("could not finish");
  });
});
