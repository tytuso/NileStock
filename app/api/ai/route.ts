import { openai } from "@ai-sdk/openai";
import { createTextStreamResponse, streamText, toTextStream } from "ai";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

const requestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .min(1)
    .max(40),
});

function sanitizeMessages(
  messages: z.infer<typeof requestSchema>["messages"],
) {
  return messages
    .map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, 1_200),
    }))
    .filter((message) => message.content.length > 0)
    .slice(-8);
}

const list = (value: unknown) => (Array.isArray(value) ? value : []);
const number = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

function businessContext(payload: unknown, businessName: string) {
  const workspace =
    payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const products = list(workspace.products) as Record<string, unknown>[];
  const sales = list(workspace.sales) as Record<string, unknown>[];
  const expenses = list(workspace.expenses) as Record<string, unknown>[];
  const requests = list(workspace.requests) as Record<string, unknown>[];
  const customers = list(workspace.customers) as Record<string, unknown>[];
  const suppliers = list(workspace.suppliers) as Record<string, unknown>[];
  const completed = sales.filter((sale) => sale.status === "completed");
  const revenue = completed.reduce((sum, sale) => sum + number(sale.total), 0);
  const expenseTotal = expenses.reduce(
    (sum, expense) => sum + number(expense.amount),
    0,
  );
  const stockValue = products.reduce(
    (sum, product) => sum + number(product.stock) * number(product.cost),
    0,
  );
  const lowStock = products
    .filter((product) => number(product.stock) <= number(product.reorder))
    .slice(0, 12)
    .map((product) => ({
      name: String(product.name || "Product"),
      stock: number(product.stock),
      reorder: number(product.reorder),
    }));
  const productSummary = products.slice(0, 30).map((product) => ({
    name: String(product.name || "Product"),
    category: String(product.category || "Uncategorised"),
    price: number(product.price),
    cost: number(product.cost),
    stock: number(product.stock),
  }));
  const openRequests = requests
    .filter((request) => request.status === "open")
    .slice(0, 15)
    .map((request) => ({
      product: String(request.product || "Unknown product"),
      quantity: number(request.quantity),
    }));

  return JSON.stringify({
    business: businessName,
    totals: {
      products: products.length,
      completedSales: completed.length,
      revenue,
      expenses: expenseTotal,
      stockValue,
      customerCreditOutstanding: customers.reduce(
        (sum, customer) => sum + number(customer.balance),
        0,
      ),
      supplierBalanceOutstanding: suppliers.reduce(
        (sum, supplier) => sum + number(supplier.balance),
        0,
      ),
    },
    lowStock,
    products: productSummary,
    openCustomerRequests: openRequests,
  });
}

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const accessToken = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";
  if (!accessToken)
    return Response.json({ error: "Sign in to use NileStock AI." }, { status: 401 });

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ error: "That AI request is not valid." }, { status: 400 });

  const messages = sanitizeMessages(parsed.data.messages);
  if (!messages.length)
    return Response.json(
      { error: "Enter a question for NileStock AI." },
      { status: 400 },
    );

  const supabase = getSupabaseServerClient(accessToken);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(accessToken);
  if (userError || !user)
    return Response.json({ error: "Your session has expired." }, { status: 401 });

  const { data: membership, error: membershipError } = await supabase
    .from("nilestock_business_members")
    .select("business_id,role,status")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .single();
  if (membershipError || !membership)
    return Response.json({ error: "No active NileStock business was found." }, { status: 403 });

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const [{ data: business }, { data: workspace }, { count }] = await Promise.all([
    supabase
      .from("nilestock_businesses")
      .select("name,plan,status")
      .eq("id", membership.business_id)
      .single(),
    supabase
      .from("nilestock_workspace_data")
      .select("payload")
      .eq("business_id", membership.business_id)
      .maybeSingle(),
    supabase
      .from("nilestock_ai_usage")
      .select("id", { count: "exact", head: true })
      .eq("business_id", membership.business_id)
      .gte("created_at", startOfDay.toISOString()),
  ]);
  if (!business || business.status !== "active")
    return Response.json({ error: "This business is not active." }, { status: 403 });
  if (business.plan !== "pro")
    return Response.json(
      { error: "NileStock AI is available on the Pro plan." },
      { status: 403 },
    );
  if (!process.env.OPENAI_API_KEY)
    return Response.json(
      { error: "NileStock AI is built and ready. Connect the OpenAI API key to activate answers." },
      { status: 503 },
    );

  if ((count || 0) >= 50)
    return Response.json(
      { error: "Todayâ€™s 50 AI-question allowance has been used. Try again tomorrow." },
      { status: 429 },
    );

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-5.6-luna";
  const context = businessContext(workspace?.payload, business.name);
  await supabase.from("nilestock_ai_usage").insert({
    business_id: membership.business_id,
    user_id: user.id,
    model,
  });

  const result = streamText({
    model: openai(model),
    reasoning: "none",
    system: `You are NileStock AI, a practical senior retail business adviser for an African small shop. Use only the supplied live business summary for business-specific facts. Never invent sales, prices, stock or profit. Explain conclusions in plain language, use UGX unless the summary shows otherwise, and finish with 2-4 concrete next actions. Protect privacy: the summary intentionally excludes customer and supplier contact details. Return polished plain text only. Never use Markdown symbols such as #, *, _, backticks or Markdown tables. Use short title lines and the bullet character â€¢ when a list helps.\n\nLIVE BUSINESS SUMMARY:\n${context}`,
    messages,
    maxOutputTokens: 700,
  });

  return createTextStreamResponse({ stream: toTextStream({ stream: result.stream }) });
}
