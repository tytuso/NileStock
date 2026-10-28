import type { AppData, Role, Sale, Shift, Staff } from "./types";
import { can, now, uid } from "./utils";

const normalized = (value: string) => value.trim().toLowerCase();
const amount = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

function requirePermission(role: Role, action: string) {
  if (!can(role, action))
    throw new Error("You do not have permission to make this change.");
}

function validateCash(value: number) {
  if (
    !Number.isFinite(value) ||
    value < 0 ||
    value > Number.MAX_SAFE_INTEGER / 100
  )
    throw new Error("Enter a valid cash amount of zero or more.");
  return amount(value);
}

function activeStaff(data: AppData, id: string) {
  const staff = data.staff.find((record) => record.id === id);
  if (!staff || staff.status !== "active")
    throw new Error("Choose an active staff member.");
  return staff;
}

/** Old named shifts can be identified only when the name/email is unambiguous. */
export function findShiftStaff(shift: Shift, staff: Staff[]) {
  if (shift.staffId) return staff.find((record) => record.id === shift.staffId);
  if (
    ["shop owner", "owner", "cashier", "google user"].includes(
      normalized(shift.cashier),
    )
  )
    return undefined;
  const matches = staff.filter((record) =>
    [record.name, record.email].some(
      (value) => normalized(value) === normalized(shift.cashier),
    ),
  );
  return matches.length === 1 ? matches[0] : undefined;
}

/** Exact shift links win; older sales fall back to staff identity and the time window. */
export function shiftCashSales(shift: Shift, sales: Sale[], staff: Staff[]) {
  const person = findShiftStaff(shift, staff);
  return sales.filter((sale) => {
    if (sale.status !== "completed" || sale.payment !== "Cash") return false;
    if (sale.shiftId) return sale.shiftId === shift.id;
    const created = Date.parse(sale.createdAt);
    if (
      !Number.isFinite(created) ||
      created < Date.parse(shift.openedAt) ||
      (shift.closedAt && created >= Date.parse(shift.closedAt))
    )
      return false;
    if (sale.staffId) return sale.staffId === (shift.staffId || person?.id);
    // A shared display name is not enough to attribute an older sale safely.
    if (
      staff.some(
        (record) =>
          record.id !== person?.id &&
          [record.name, record.email].some(
            (value) => normalized(value) === normalized(sale.cashier),
          ),
      )
    )
      return false;
    const names = person
      ? [person.name, person.email, shift.cashier]
      : [shift.cashier];
    return names.some((name) => normalized(name) === normalized(sale.cashier));
  });
}

export function expectedShiftCash(shift: Shift, sales: Sale[], staff: Staff[]) {
  return amount(
    shift.opening +
      shiftCashSales(shift, sales, staff).reduce(
        (total, sale) => total + sale.total,
        0,
      ),
  );
}

/** Called with the latest workspace when a sale is committed, not an old render. */
export function saleStaffAssignment(
  data: AppData,
  staffId?: string,
): Pick<Sale, "staffId" | "shiftId"> {
  if (!staffId) return {};
  const staff = activeStaff(data, staffId);
  const shift = data.shifts.find(
    (record) => record.status === "open" && record.staffId === staff.id,
  );
  return { staffId: staff.id, ...(shift ? { shiftId: shift.id } : {}) };
}

export function addStaffMember(
  data: AppData,
  input: { name: string; email: string; role: string },
  actor: string,
  role: Role,
): AppData {
  requirePermission(role, "staff-role");
  const name = input.name.trim();
  const email = normalized(input.email);
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error("Enter the staff member's name and a valid email address.");
  if (!["cashier", "manager"].includes(input.role))
    throw new Error("Choose Cashier or Manager.");
  if (data.staff.some((record) => normalized(record.email) === email))
    throw new Error("A staff member with this email already exists.");
  const staff: Staff = {
    id: uid(),
    name,
    email,
    role: input.role as Role,
    status: "active",
  };
  return {
    ...data,
    staff: [...data.staff, staff],
    audit: [
      {
        id: uid(),
        actor,
        action: "Staff added",
        record: name,
        createdAt: now(),
      },
      ...data.audit,
    ],
  };
}

export function setStaffStatus(
  data: AppData,
  id: string,
  enabled: boolean,
  actor: string,
  role: Role,
): AppData {
  requirePermission(role, "staff-role");
  const staff = data.staff.find((record) => record.id === id);
  if (!staff || staff.role === "owner")
    throw new Error("This staff account cannot be changed here.");
  if (
    !enabled &&
    data.shifts.some(
      (shift) =>
        shift.status === "open" && findShiftStaff(shift, data.staff)?.id === id,
    )
  )
    throw new Error("Close this staff member's shift before disabling them.");
  return {
    ...data,
    staff: data.staff.map((record) =>
      record.id === id
        ? { ...record, status: enabled ? "active" : "disabled" }
        : record,
    ),
    audit: [
      {
        id: uid(),
        actor,
        action: enabled ? "Staff enabled" : "Staff disabled",
        record: staff.name,
        createdAt: now(),
      },
      ...data.audit,
    ],
  };
}

export function openStaffShift(
  data: AppData,
  staffId: string,
  opening: number,
  actor: string,
  role: Role,
): AppData {
  requirePermission(role, "shift");
  const staff = activeStaff(data, staffId);
  const cash = validateCash(opening);
  if (data.shifts.some((shift) => shift.status === "open"))
    throw new Error(
      "A shift is already open. Close and reconcile it before starting another.",
    );
  const openedAt = now();
  return {
    ...data,
    shifts: [
      {
        id: uid(),
        staffId,
        cashier: staff.name,
        openedAt,
        opening: cash,
        status: "open",
      },
      ...data.shifts,
    ],
    audit: [
      {
        id: uid(),
        actor,
        action: "Shift opened",
        record: staff.name,
        createdAt: openedAt,
      },
      ...data.audit,
    ],
  };
}

export function assignLegacyShift(
  data: AppData,
  id: string,
  staffId: string,
  actor: string,
  role: Role,
): AppData {
  requirePermission(role, "shift");
  const staff = activeStaff(data, staffId);
  const shift = data.shifts.find((record) => record.id === id);
  if (!shift || shift.status !== "open" || shift.staffId)
    throw new Error(
      "This shift has changed. Reopen shift management and try again.",
    );
  return {
    ...data,
    shifts: data.shifts.map((record) =>
      record.id === id ? { ...record, staffId, cashier: staff.name } : record,
    ),
    audit: [
      {
        id: uid(),
        actor,
        action: "Shift staff assigned",
        record: staff.name,
        createdAt: now(),
      },
      ...data.audit,
    ],
  };
}

export function closeStaffShift(
  data: AppData,
  id: string,
  counted: number,
  actor: string,
  role: Role,
): AppData {
  requirePermission(role, "shift");
  const cash = validateCash(counted);
  const shift = data.shifts.find((record) => record.id === id);
  if (!shift || shift.status !== "open")
    throw new Error(
      "This shift is already closed. Reopen shift management to see the latest status.",
    );
  if (!shift.staffId)
    throw new Error(
      "Assign this older shift to a staff member before reconciling it.",
    );
  const closedAt = now();
  const closed = { ...shift, closedAt };
  return {
    ...data,
    shifts: data.shifts.map((record) =>
      record.id === id
        ? {
            ...closed,
            status: "closed",
            counted: cash,
            expected: expectedShiftCash(closed, data.sales, data.staff),
          }
        : record,
    ),
    audit: [
      {
        id: uid(),
        actor,
        action: "Shift closed and reconciled",
        record: shift.cashier,
        createdAt: closedAt,
      },
      ...data.audit,
    ],
  };
}
