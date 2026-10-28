import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Sale, Shift, Staff } from "./types";
import { demoData } from "./utils";
import {
  addStaffMember,
  assignLegacyShift,
  closeStaffShift,
  expectedShiftCash,
  findShiftStaff,
  openStaffShift,
  saleStaffAssignment,
  setStaffStatus,
  shiftCashSales,
} from "./staff-shifts";

const alice: Staff = {
  id: "alice",
  name: "Alice",
  email: "alice@example.com",
  role: "cashier",
  status: "active",
};
const bob: Staff = {
  id: "bob",
  name: "Bob",
  email: "bob@example.com",
  role: "cashier",
  status: "active",
};
const shift: Shift = {
  id: "shift-a",
  staffId: alice.id,
  cashier: alice.name,
  openedAt: "2026-10-28T09:00:00Z",
  opening: 10_000,
  status: "open",
};
function workspace() {
  const data = demoData();
  data.staff = [
    alice,
    bob,
    {
      id: "disabled",
      name: "Disabled",
      email: "disabled@example.com",
      role: "cashier",
      status: "disabled",
    },
  ];
  return data;
}
function sale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: "sale",
    receiptNo: "NS-1",
    createdAt: "2026-10-28T09:30:00Z",
    cashier: alice.name,
    staffId: alice.id,
    shiftId: shift.id,
    items: [],
    subtotal: 5_000,
    discount: 0,
    tax: 0,
    total: 5_000,
    payment: "Cash",
    paid: 10_000,
    change: 5_000,
    status: "completed",
    synced: false,
    ...overrides,
  };
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-28T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("staff assignment and shift lifecycle", () => {
  it("opens a shift for the chosen staff member and records the real actor", () => {
    const data = workspace();
    const next = openStaffShift(data, bob.id, 20_000, "Timothy", "owner");
    expect(next.shifts[0]).toMatchObject({
      staffId: bob.id,
      cashier: "Bob",
      opening: 20_000,
      status: "open",
    });
    expect(findShiftStaff(next.shifts[0], next.staff)?.id).toBe(bob.id);
    expect(next.audit[0]).toMatchObject({
      actor: "Timothy",
      action: "Shift opened",
      record: "Bob",
    });
    expect(data.shifts).toHaveLength(0);
  });
  it("requires active staff and prevents duplicate shop shifts, including a repeated submission", () => {
    const data = openStaffShift(workspace(), alice.id, 0, "Owner", "owner");
    expect(() => openStaffShift(data, bob.id, 0, "Owner", "owner")).toThrow(
      "already open",
    );
    expect(() =>
      openStaffShift(workspace(), "disabled", 0, "Owner", "owner"),
    ).toThrow("active staff");
    expect(() =>
      openStaffShift(workspace(), "missing", 0, "Owner", "owner"),
    ).toThrow("active staff");
  });
  it.each([-1, NaN, Infinity, Number.MAX_SAFE_INTEGER])(
    "rejects invalid cash amount %s without changing data",
    (value) => {
      const data = workspace();
      data.shifts = [shift];
      expect(() =>
        openStaffShift(workspace(), alice.id, value, "Owner", "owner"),
      ).toThrow("valid cash");
      expect(() =>
        closeStaffShift(data, shift.id, value, "Owner", "owner"),
      ).toThrow("valid cash");
      expect(data.shifts[0].status).toBe("open");
    },
  );
  it("allows managers to reconcile, blocks cashiers, and preserves the closing snapshot", () => {
    const data = workspace();
    data.shifts = [shift];
    data.sales = [sale()];
    expect(() =>
      closeStaffShift(data, shift.id, 15_000, "Alice", "cashier"),
    ).toThrow("permission");
    const next = closeStaffShift(data, shift.id, 14_000, "Manager", "manager");
    expect(next.shifts[0]).toMatchObject({
      status: "closed",
      counted: 14_000,
      expected: 15_000,
      closedAt: "2026-10-28T10:00:00.000Z",
    });
    expect(next.shifts[0].counted! - next.shifts[0].expected!).toBe(-1_000);
    expect(() =>
      closeStaffShift(next, shift.id, 0, "Manager", "manager"),
    ).toThrow("already closed");
    expect(findShiftStaff(next.shifts[0], next.staff)?.id).toBe(alice.id);
    expect(
      openStaffShift(next, bob.id, 0, "Manager", "manager").shifts[1],
    ).toEqual(next.shifts[0]);
  });
  it("keeps older shifts intact and requires an explicit assignment for generic names", () => {
    const data = workspace();
    const legacy = { ...shift, staffId: undefined, cashier: "Shop Owner" };
    data.shifts = [legacy];
    expect(findShiftStaff(legacy, data.staff)).toBeUndefined();
    expect(() => closeStaffShift(data, shift.id, 0, "Owner", "owner")).toThrow(
      "Assign this older shift",
    );
    const next = assignLegacyShift(data, shift.id, alice.id, "Owner", "owner");
    expect(next.shifts[0]).toMatchObject({
      staffId: alice.id,
      cashier: "Alice",
      openedAt: shift.openedAt,
      opening: shift.opening,
    });
    expect(() =>
      assignLegacyShift(next, shift.id, bob.id, "Owner", "owner"),
    ).toThrow("changed");
  });
  it("does not guess an old shift's staff member when names are duplicated", () => {
    const staff = [alice, { ...bob, name: "Alice" }];
    expect(
      findShiftStaff({ ...shift, staffId: undefined }, staff),
    ).toBeUndefined();
    expect(findShiftStaff(shift, staff)?.id).toBe(alice.id);
  });
  it("retains staff identity when the name printed on a receipt is edited", () => {
    const data = workspace();
    data.shifts = [shift];
    const assignment = saleStaffAssignment(data, alice.id);
    expect(assignment).toEqual({ staffId: alice.id, shiftId: shift.id });
    expect(
      expectedShiftCash(
        shift,
        [sale({ cashier: "Different receipt name", ...assignment })],
        data.staff,
      ),
    ).toBe(15_000);
    expect(saleStaffAssignment(data, bob.id)).toEqual({ staffId: bob.id });
    expect(saleStaffAssignment(data)).toEqual({});
    expect(() => saleStaffAssignment(data, "disabled")).toThrow("active staff");
    expect(
      saleStaffAssignment(
        closeStaffShift(data, shift.id, 10_000, "Owner", "owner"),
        alice.id,
      ),
    ).toEqual({ staffId: alice.id });
  });
});

describe("cash reconciliation", () => {
  it("uses net sale totals after change and excludes other cashiers, shifts, refunds, voids and non-cash payments", () => {
    const sales = [
      sale({ id: "included" }),
      sale({ id: "bob", shiftId: undefined, staffId: bob.id, cashier: "Bob" }),
      sale({ id: "other-shift", shiftId: "previous-shift" }),
      sale({ id: "refunded", status: "refunded" }),
      sale({ id: "voided", status: "voided" }),
      sale({ id: "mobile-money", payment: "Mobile Money" }),
      sale({ id: "credit", payment: "Customer Credit", creditPaid: 1_000 }),
    ];
    expect(
      shiftCashSales(shift, sales, workspace().staff).map(
        (record) => record.id,
      ),
    ).toEqual(["included"]);
    expect(expectedShiftCash(shift, sales, workspace().staff)).toBe(15_000);
  });
  it("matches legacy sales by staff name/email only inside the shift window", () => {
    const ended = {
      ...shift,
      closedAt: "2026-10-28T10:00:00Z",
      status: "closed" as const,
    };
    const old = { shiftId: undefined, staffId: undefined };
    const sales = [
      sale({ ...old, id: "name", cashier: " ALICE " }),
      sale({ ...old, id: "email", cashier: "ALICE@EXAMPLE.COM" }),
      sale({ ...old, id: "before", createdAt: "2026-10-28T08:59:59Z" }),
      sale({ ...old, id: "after", createdAt: "2026-10-28T10:00:00Z" }),
      sale({ ...old, id: "invalid-time", createdAt: "bad" }),
      sale({ ...old, id: "bob", cashier: "Bob" }),
    ];
    expect(
      shiftCashSales(ended, sales, workspace().staff).map(
        (record) => record.id,
      ),
    ).toEqual(["name", "email"]);
    expect(expectedShiftCash(ended, sales, workspace().staff)).toBe(20_000);
  });
  it("never attributes an ambiguous older cashier name or a different staff ID", () => {
    const staff = [alice, { ...bob, name: "Alice" }];
    expect(
      shiftCashSales(
        shift,
        [sale({ shiftId: undefined, staffId: undefined })],
        staff,
      ),
    ).toEqual([]);
    expect(
      shiftCashSales(
        shift,
        [sale({ shiftId: undefined, staffId: bob.id })],
        staff,
      ),
    ).toEqual([]);
  });
  it("rounds currency totals and accepts a zero opening/count", () => {
    const data = openStaffShift(workspace(), alice.id, 0, "Owner", "owner");
    expect(
      closeStaffShift(data, data.shifts[0].id, 0, "Owner", "owner").shifts[0]
        .expected,
    ).toBe(0);
    expect(
      expectedShiftCash(
        { ...shift, opening: 0.1 },
        [sale({ total: 0.2 })],
        data.staff,
      ),
    ).toBe(0.3);
  });
});

describe("staff controls", () => {
  it("trims names, normalizes emails and prevents case-insensitive duplicate emails", () => {
    const next = addStaffMember(
      workspace(),
      { name: " Jane ", email: " JANE@EXAMPLE.COM ", role: "manager" },
      "Timothy",
      "owner",
    );
    expect(next.staff.at(-1)).toMatchObject({
      name: "Jane",
      email: "jane@example.com",
      role: "manager",
      status: "active",
    });
    expect(next.audit[0].actor).toBe("Timothy");
    expect(() =>
      addStaffMember(
        next,
        { name: "Another Jane", email: "Jane@Example.com", role: "cashier" },
        "Owner",
        "owner",
      ),
    ).toThrow("already exists");
  });
  it("rejects blank names, invalid emails/roles, and unauthorized staff edits", () => {
    const input = { name: "Jane", email: "jane@example.com", role: "cashier" };
    for (const bad of [
      { ...input, name: "  " },
      { ...input, email: "bad" },
      { ...input, role: "owner" },
    ])
      expect(() =>
        addStaffMember(workspace(), bad, "Owner", "owner"),
      ).toThrow();
    for (const role of ["manager", "cashier"] as const) {
      expect(() => addStaffMember(workspace(), input, "Someone", role)).toThrow(
        "permission",
      );
      expect(() =>
        setStaffStatus(workspace(), alice.id, false, "Someone", role),
      ).toThrow("permission");
    }
    expect(() =>
      openStaffShift(workspace(), alice.id, 0, "Alice", "cashier"),
    ).toThrow("permission");
  });
  it("requires closing a staff member's shift before disabling and protects owners", () => {
    const data = workspace();
    data.shifts = [shift];
    expect(() =>
      setStaffStatus(data, alice.id, false, "Owner", "owner"),
    ).toThrow("Close this staff member's shift");
    const closed = closeStaffShift(data, shift.id, 0, "Owner", "owner");
    expect(
      setStaffStatus(closed, alice.id, false, "Owner", "owner").staff[0].status,
    ).toBe("disabled");
    expect(
      setStaffStatus(workspace(), "disabled", true, "Owner", "owner").staff[2]
        .status,
    ).toBe("active");
    data.staff = [{ ...alice, role: "owner" }];
    expect(() =>
      setStaffStatus(data, alice.id, false, "Owner", "owner"),
    ).toThrow("cannot be changed");
  });
});
