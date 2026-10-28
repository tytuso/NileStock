// @vitest-environment happy-dom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppProvider, useApp } from "./store";
import { demoData } from "./utils";
import { StaffView } from "@/components/staff";
import { POS } from "@/components/pos";

let app: ReturnType<typeof useApp>;
let root: Root;
let host: HTMLDivElement;

function Flow() {
  app = useApp();
  const [checkout, setCheckout] = useState(false);
  return (
    <>
      <button onClick={() => setCheckout(false)}>Show staff</button>
      <button onClick={() => setCheckout(true)}>Show checkout</button>
      {checkout ? (
        <POS signedInName="Test Owner" signedInEmail="owner@example.com" />
      ) : (
        <StaffView actor="Test Owner" signedInEmail="owner@example.com" />
      )}
    </>
  );
}

function fixture() {
  const data = demoData();
  data.business.plan = "business";
  data.staff = [
    {
      id: "owner",
      name: "Test Owner",
      email: "owner@example.com",
      role: "owner",
      status: "active",
    },
    {
      id: "alice",
      name: "Alice",
      email: "alice@example.com",
      role: "cashier",
      status: "active",
    },
    {
      id: "bob",
      name: "Bob",
      email: "bob@example.com",
      role: "cashier",
      status: "active",
    },
    {
      id: "disabled",
      name: "Disabled Staff",
      email: "disabled@example.com",
      role: "cashier",
      status: "disabled",
    },
  ];
  data.products = [
    {
      id: "rice",
      name: "Rice QA",
      category: "Food",
      price: 5000,
      cost: 3000,
      sku: "RICE",
      barcode: "123456",
      qr: "RICE",
      stock: 10,
      reorder: 2,
      unit: "bag",
      taxable: false,
      active: true,
      createdAt: new Date().toISOString(),
    },
  ];
  return data;
}
function button(text: string | RegExp) {
  const result = Array.from(host.querySelectorAll("button")).find((element) =>
    typeof text === "string"
      ? element.textContent?.trim() === text
      : text.test(element.textContent || ""),
  );
  if (!result) throw new Error(`Missing button: ${text}`);
  return result;
}
function field(label: string) {
  const result = Array.from(host.querySelectorAll("label"))
    .find((element) => element.querySelector("span")?.textContent === label)
    ?.querySelector<HTMLInputElement | HTMLSelectElement>("input,select");
  if (!result) throw new Error(`Missing field: ${label}`);
  return result;
}
async function click(text: string | RegExp) {
  await act(async () => button(text).click());
}
async function submit(text: string) {
  const target = button(text);
  expect(target.disabled).toBe(false);
  // Happy DOM's decimal-step validation incorrectly uses floating-point remainder.
  // Dispatch the submit event to exercise our real form and domain validation.
  await act(async () => {
    target.form!.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
  });
}
async function fill(label: string, value: string) {
  const element = field(label);
  await act(async () => {
    if (element instanceof HTMLSelectElement) element.value = value;
    else
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(element, value);
    element.dispatchEvent(
      new Event(element instanceof HTMLSelectElement ? "change" : "input", {
        bubbles: true,
      }),
    );
  });
}
async function mount() {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () =>
    root.render(
      <AppProvider>
        <Flow />
      </AppProvider>,
    ),
  );
}
async function openAliceShift() {
  await click("Manage shift");
  expect(field("Staff member on shift").innerHTML).not.toContain(
    "Disabled Staff",
  );
  await fill("Staff member on shift", "alice");
  await fill("Opening cash", "10000");
  await submit("Open shift");
  expect(app.data.shifts).toHaveLength(1);
}

beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear();
  localStorage.setItem("nilestock.v3.clean", JSON.stringify(fixture()));
  await mount();
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("staff → checkout → reconciliation user flow", () => {
  it("keeps every open shift visible after a cross-device merge and closes only the selected shift", async () => {
    await act(async () =>
      app.setData((data) => ({
        ...data,
        shifts: [
          {
            id: "shift-alice",
            cashier: "Alice",
            staffId: "alice",
            openedAt: "2026-10-28T09:00:00Z",
            opening: 10000,
            status: "open",
          },
          {
            id: "shift-bob",
            cashier: "Bob",
            staffId: "bob",
            openedAt: "2026-10-28T09:00:01Z",
            opening: 20000,
            status: "open",
          },
        ],
      })),
    );
    const working = Array.from(host.querySelectorAll("li")).filter((row) =>
      row.textContent?.includes("On shift"),
    );
    expect(working).toHaveLength(2);
    expect(host.textContent).toContain("2 shifts open");
    await click("Manage shift");
    await fill("Open shift to manage", "shift-bob");
    await fill("Counted cash", "20000");
    await submit("Close shift & reconcile");
    expect(
      app.data.shifts.find((shift) => shift.id === "shift-bob")?.status,
    ).toBe("closed");
    expect(
      app.data.shifts.find((shift) => shift.id === "shift-alice")?.status,
    ).toBe("open");
  });
  it("uses the latest staff status at checkout and lets the cashier recover from an error", async () => {
    await openAliceShift();
    await click("Show checkout");
    await click(/Rice QA/);
    await click(/^Pay/);
    await fill("Cash received", "10000");
    // An older app or another device changed the record while payment was open.
    await act(async () =>
      app.setData((data) => ({
        ...data,
        staff: data.staff.map((staff) =>
          staff.id === "alice" ? { ...staff, status: "disabled" } : staff,
        ),
      })),
    );
    await click("Complete sale");
    expect(app.data.sales).toHaveLength(0);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      "active staff",
    );
    await fill("Staff member recording this sale", "bob");
    await click("Complete sale");
    expect(app.data.sales).toHaveLength(1);
    expect(app.data.sales[0]).toMatchObject({ staffId: "bob", cashier: "Bob" });
    expect(app.data.sales[0].shiftId).toBeUndefined();
  });
  it("assigns an older generic shift without deleting or restarting it", async () => {
    const openedAt = "2026-10-28T09:00:00.000Z";
    await act(async () =>
      app.setData((data) => ({
        ...data,
        shifts: [
          {
            id: "old-shift",
            cashier: "Shop Owner",
            openedAt,
            opening: 10000,
            status: "open",
          },
        ],
      })),
    );
    expect(host.textContent).toContain("Staff assignment needed");
    await click("Manage shift");
    await fill("Assign this shift to", "alice");
    await submit("Assign staff");
    expect(app.data.shifts[0]).toMatchObject({
      id: "old-shift",
      staffId: "alice",
      cashier: "Alice",
      openedAt,
      opening: 10000,
    });
    expect(host.textContent).toContain("Expected cash:");
    await fill("Counted cash", "10000");
    await submit("Close shift & reconcile");
    expect(app.data.shifts[0]).toMatchObject({
      status: "closed",
      expected: 10000,
      counted: 10000,
    });
  });
  it("allocates different receipt numbers to sales committed before React rerenders", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-28T09:00:00Z"));
    try {
      const complete = app.completeSale;
      const payload = {
        cashier: "Alice",
        staffId: "alice",
        items: [],
        subtotal: 1000,
        discount: 0,
        tax: 0,
        total: 1000,
        payment: "Cash" as const,
        paid: 1000,
        change: 0,
      };
      await act(async () => {
        complete(payload);
        complete(payload);
      });
      expect(app.data.sales).toHaveLength(2);
      expect(new Set(app.data.sales.map((sale) => sale.receiptNo)).size).toBe(
        2,
      );
    } finally {
      vi.useRealTimers();
    }
  });
  it("shows the assigned person on shift, saves once on double click, preserves receipt identity, then reconciles and hands over", async () => {
    expect(host.textContent).toContain("No open shift");
    await openAliceShift();
    const shiftId = app.data.shifts[0].id;
    const aliceRow = Array.from(host.querySelectorAll("li")).find((row) =>
      row.textContent?.includes("alice@example.com"),
    )!;
    expect(aliceRow.textContent).toContain("On shift");
    expect(aliceRow.textContent).toContain("Account active");
    expect(aliceRow.querySelector("button")!.disabled).toBe(true);
    await click("Show checkout");
    await click(/Rice QA/);
    await click(/^Pay/);
    expect(
      (field("Staff member recording this sale") as HTMLSelectElement).value,
    ).toBe("alice");
    await fill("Cashier name on receipt", "Counter One");
    await fill("Cash received", "10000");
    const complete = button("Complete sale");
    expect(complete.disabled).toBe(false);
    await act(async () => {
      complete.click();
      complete.click();
    });
    expect(app.data.sales).toHaveLength(1);
    expect(app.data.sales[0]).toMatchObject({
      cashier: "Counter One",
      staffId: "alice",
      shiftId,
      total: 5000,
      change: 5000,
    });
    expect(app.data.products[0].stock).toBe(9);
    expect(host.textContent).toContain("Counter One");
    await click("Show staff");
    await click("Manage shift");
    expect(host.textContent).toContain("Expected cash:");
    expect(host.textContent).toMatch(/15,000/);
    await fill("Counted cash", "14000");
    await submit("Close shift & reconcile");
    expect(app.data.shifts[0]).toMatchObject({
      status: "closed",
      expected: 15000,
      counted: 14000,
    });
    expect(host.textContent).toContain("Recent shifts");
    expect(host.textContent).toContain("Difference:");
    expect(host.textContent).toMatch(/-.*1,000/);
    await click("Manage shift");
    await fill("Staff member on shift", "bob");
    await fill("Opening cash", "14000");
    await submit("Open shift");
    expect(app.data.shifts[0]).toMatchObject({
      staffId: "bob",
      cashier: "Bob",
      status: "open",
    });
    expect(app.data.shifts[1].status).toBe("closed");
  });
  it("restores the open shift and its owner after reloading the provider", async () => {
    await openAliceShift();
    const id = app.data.shifts[0].id;
    await act(async () => root.unmount());
    host.remove();
    await mount();
    expect(app.data.shifts[0]).toMatchObject({
      id,
      staffId: "alice",
      status: "open",
    });
    expect(host.textContent).toContain("On shift");
    expect(host.textContent).toContain("Alice");
  });
  it("keeps the staff dialog open with a useful duplicate-email error and prevents cashier edits", async () => {
    await click("Add staff");
    await fill("Name", "Another Alice");
    await fill("Email", "ALICE@example.com");
    const form = field("Name").closest("form")!;
    await act(async () =>
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      ),
    );
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      "already exists",
    );
    expect(app.data.staff).toHaveLength(4);
    await act(async () =>
      host
        .querySelector<HTMLButtonElement>('button[aria-label="Close"]')!
        .click(),
    );
    await act(async () => app.setRole("cashier"));
    expect(button("Add staff").disabled).toBe(true);
    expect(button("Manage shift").disabled).toBe(true);
    expect(host.querySelector('button[aria-label="Disable Alice"]')).toBeNull();
  });
});
