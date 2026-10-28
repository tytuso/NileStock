"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useApp } from "@/lib/store";
import type { AppData } from "@/lib/types";
import { can, money } from "@/lib/utils";
import {
  addStaffMember,
  assignLegacyShift,
  closeStaffShift,
  expectedShiftCash,
  findShiftStaff,
  openStaffShift,
  setStaffStatus,
} from "@/lib/staff-shifts";
import { Badge, Button, Card, Empty, Field, Input, Modal, Select } from "./ui";

export function StaffView({
  actor,
  signedInEmail,
}: {
  actor: string;
  signedInEmail: string;
}) {
  const { data, getData, setData, role } = useApp();
  const [adding, setAdding] = useState(false);
  const [managing, setManaging] = useState(false);
  const [error, setError] = useState("");
  const [managedShiftId, setManagedShiftId] = useState("");
  const openShifts = data.shifts.filter((shift) => shift.status === "open");
  const openShift =
    openShifts.find((shift) => shift.id === managedShiftId) || openShifts[0];
  const activeStaff = data.staff.filter((staff) => staff.status === "active");
  const signedInStaff = activeStaff.find(
    (staff) => staff.email.toLowerCase() === signedInEmail.toLowerCase(),
  );
  const shiftStaff = openShift
    ? findShiftStaff(openShift, data.staff)
    : undefined;
  const canManageStaff = can(role, "staff-role");
  const canManageShift = can(role, "shift");
  const currency = data.business.currency;
  const history = data.shifts
    .filter((shift) => shift.status === "closed")
    .slice(0, 10);
  const expected = openShift?.staffId
    ? expectedShiftCash(openShift, data.sales, data.staff)
    : undefined;
  const dismiss = () => {
    setAdding(false);
    setManaging(false);
    setError("");
  };
  const change = (update: (latest: AppData) => AppData) => {
    try {
      setData(update(getData()));
      setError("");
      return true;
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The change could not be saved. Please try again.",
      );
      return false;
    }
  };
  const errorNote = error ? (
    <p
      role="alert"
      className="rounded-lg bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300"
    >
      {error}
    </p>
  ) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="secondary"
          disabled={!canManageShift}
          onClick={() => {
            setError("");
            setManaging(true);
          }}
        >
          Manage shift
        </Button>
        <Button
          disabled={!canManageStaff}
          onClick={() => {
            setError("");
            setAdding(true);
          }}
        >
          <Plus size={16} /> Add staff
        </Button>
      </div>
      {!adding && !managing && errorNote}
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Currently on shift
          </p>
          <p className="mt-1 break-words font-semibold">
            {openShifts.length
              ? openShifts
                  .map((shift) =>
                    shift.staffId ? shift.cashier : "Staff assignment needed",
                  )
                  .join(", ")
              : "No open shift"}
          </p>
          <p className="mt-1 text-xs text-muted">
            {openShift
              ? openShifts.length > 1
                ? "Several shifts are open. Reconcile each before the next handover."
                : `Started ${new Date(openShift.openedAt).toLocaleString()}`
              : "Open a shift and choose the staff member working at the till."}
          </p>
        </div>
        <Badge tone={openShift ? "green" : "neutral"}>
          {openShifts.length > 1
            ? `${openShifts.length} shifts open`
            : openShift
              ? "Shift open"
              : "Shift closed"}
        </Badge>
      </Card>
      <Card>
        {data.staff.length ? (
          <ul>
            {data.staff.map((staff) => {
              const staffShift = openShifts.find(
                (shift) => findShiftStaff(shift, data.staff)?.id === staff.id,
              );
              const onShift = !!staffShift;
              return (
                <li
                  className="flex flex-wrap items-center gap-3 border-b border-line p-4 last:border-0"
                  key={staff.id}
                >
                  <div
                    aria-hidden="true"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-black/5 font-bold dark:bg-white/10"
                  >
                    {staff.name.trim()[0]?.toUpperCase() || "?"}
                  </div>
                  <div className="min-w-0 flex-1 basis-36">
                    <b className="break-words">{staff.name}</b>
                    <span className="block break-all text-xs text-muted">
                      {staff.email} • {staff.role}
                    </span>
                    {onShift && (
                      <span className="mt-1 block text-xs text-muted">
                        Since {new Date(staffShift.openedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={onShift ? "green" : "neutral"}>
                      {onShift ? "On shift" : "Off shift"}
                    </Badge>
                    <Badge
                      tone={staff.status === "active" ? "green" : "neutral"}
                    >
                      Account {staff.status}
                    </Badge>
                  </div>
                  {staff.role !== "owner" && canManageStaff && (
                    <Button
                      variant="ghost"
                      disabled={onShift && staff.status === "active"}
                      title={
                        onShift && staff.status === "active"
                          ? "Close this staff member's shift before disabling them."
                          : undefined
                      }
                      aria-label={`${staff.status === "active" ? "Disable" : "Enable"} ${staff.name}`}
                      onClick={() =>
                        change((latest) =>
                          setStaffStatus(
                            latest,
                            staff.id,
                            staff.status !== "active",
                            actor,
                            role,
                          ),
                        )
                      }
                    >
                      {staff.status === "active" ? "Disable" : "Enable"}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty
            title="No staff members yet"
            copy="Add a staff member to assign them a shift."
          />
        )}
      </Card>
      {history.length > 0 && (
        <Card className="overflow-hidden">
          <h3 className="border-b border-line p-4 font-semibold">
            Recent shifts
          </h3>
          <ul className="divide-y divide-line">
            {history.map((shift) => {
              const difference =
                shift.counted !== undefined && shift.expected !== undefined
                  ? Math.round((shift.counted - shift.expected) * 100) / 100
                  : undefined;
              return (
                <li key={shift.id} className="space-y-2 p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <b className="break-words">{shift.cashier}</b>
                    <Badge>Closed</Badge>
                  </div>
                  <p className="text-xs text-muted">
                    {new Date(shift.openedAt).toLocaleString()}
                    {shift.closedAt
                      ? ` – ${new Date(shift.closedAt).toLocaleString()}`
                      : ""}
                  </p>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
                    <span>
                      Expected:{" "}
                      <b>
                        {shift.expected === undefined
                          ? "Not recorded"
                          : money(shift.expected, currency)}
                      </b>
                    </span>
                    <span>
                      Counted:{" "}
                      <b>
                        {shift.counted === undefined
                          ? "Not recorded"
                          : money(shift.counted, currency)}
                      </b>
                    </span>
                    {difference !== undefined && (
                      <span>
                        Difference:{" "}
                        <b
                          className={
                            difference < 0
                              ? "text-red-600 dark:text-red-300"
                              : difference > 0
                                ? "text-amber-700 dark:text-amber-300"
                                : "text-emerald-700 dark:text-emerald-300"
                          }
                        >
                          {money(difference, currency)}
                        </b>
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      <Modal open={adding} onClose={dismiss} title="Add staff member">
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const fields = new FormData(event.currentTarget);
            if (
              change((latest) =>
                addStaffMember(
                  latest,
                  {
                    name: String(fields.get("name") || ""),
                    email: String(fields.get("email") || ""),
                    role: String(fields.get("role") || ""),
                  },
                  actor,
                  role,
                ),
              )
            )
              dismiss();
          }}
        >
          {errorNote}
          <Field label="Name">
            <Input name="name" autoComplete="name" required />
          </Field>
          <Field label="Email">
            <Input name="email" type="email" autoComplete="email" required />
          </Field>
          <Field label="Role">
            <Select name="role">
              <option value="cashier">Cashier</option>
              <option value="manager">Manager</option>
            </Select>
          </Field>
          <Button type="submit" disabled={!canManageStaff}>
            Add staff
          </Button>
        </form>
      </Modal>
      <Modal open={managing} onClose={dismiss} title="Shift management">
        <div className="space-y-4">
          {errorNote}
          {openShifts.length > 1 && (
            <Field label="Open shift to manage">
              <Select
                value={openShift.id}
                onChange={(event) => {
                  setManagedShiftId(event.target.value);
                  setError("");
                }}
              >
                {openShifts.map((shift) => (
                  <option key={shift.id} value={shift.id}>
                    {shift.cashier} —{" "}
                    {new Date(shift.openedAt).toLocaleString()}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {openShift ? (
            <>
              <div className="rounded-lg border border-line p-3 text-sm">
                <p>
                  Staff member:{" "}
                  <b>
                    {openShift.staffId ? openShift.cashier : "Not assigned"}
                  </b>
                </p>
                <p className="mt-1 text-xs text-muted">
                  Opened {new Date(openShift.openedAt).toLocaleString()}
                </p>
                <p className="mt-2">
                  Opening cash: <b>{money(openShift.opening, currency)}</b>
                </p>
              </div>
              {!openShift.staffId ? (
                <form
                  key={openShift.id}
                  className="grid gap-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const fields = new FormData(event.currentTarget);
                    change((latest) =>
                      assignLegacyShift(
                        latest,
                        openShift.id,
                        String(fields.get("staffId") || ""),
                        actor,
                        role,
                      ),
                    );
                  }}
                >
                  <p className="text-sm text-muted">
                    This older shift has no staff assignment. Choose who worked
                    it before reconciling. Earlier sales are matched by their
                    cashier name.
                  </p>
                  <Field label="Assign this shift to">
                    <Select
                      name="staffId"
                      defaultValue={shiftStaff?.id || ""}
                      required
                    >
                      <option value="" disabled>
                        Choose staff member
                      </option>
                      {activeStaff.map((staff) => (
                        <option key={staff.id} value={staff.id}>
                          {staff.name} ({staff.email})
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Button
                    type="submit"
                    disabled={!canManageShift || !activeStaff.length}
                  >
                    Assign staff
                  </Button>
                </form>
              ) : (
                <form
                  key={openShift.id}
                  className="grid gap-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const fields = new FormData(event.currentTarget);
                    if (
                      change((latest) =>
                        closeStaffShift(
                          latest,
                          openShift.id,
                          Number(fields.get("counted")),
                          actor,
                          role,
                        ),
                      )
                    )
                      dismiss();
                  }}
                >
                  <div className="rounded-lg bg-black/5 p-3 text-sm dark:bg-white/5">
                    <p>
                      Cash sales:{" "}
                      <b>
                        {money(
                          (expected ?? openShift.opening) - openShift.opening,
                          currency,
                        )}
                      </b>
                    </p>
                    <p className="mt-1">
                      Expected cash:{" "}
                      <b>{money(expected ?? openShift.opening, currency)}</b>
                    </p>
                    <p className="mt-2 text-xs text-muted">
                      Opening cash plus this staff member's completed cash
                      sales. Refunded and voided sales are excluded.
                    </p>
                  </div>
                  <Field label="Counted cash">
                    <Input
                      name="counted"
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      required
                    />
                  </Field>
                  <Button type="submit" disabled={!canManageShift}>
                    Close shift & reconcile
                  </Button>
                </form>
              )}
            </>
          ) : (
            <form
              className="grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                const fields = new FormData(event.currentTarget);
                if (
                  change((latest) =>
                    openStaffShift(
                      latest,
                      String(fields.get("staffId") || ""),
                      Number(fields.get("opening")),
                      actor,
                      role,
                    ),
                  )
                )
                  dismiss();
              }}
            >
              <p className="text-sm text-muted">
                Assign the person working at the till. Close and reconcile this
                shift before the next handover.
              </p>
              {!activeStaff.length && (
                <p className="text-sm text-muted">
                  Add or enable a staff member before opening a shift.
                </p>
              )}
              <Field label="Staff member on shift">
                <Select
                  name="staffId"
                  defaultValue={signedInStaff?.id || ""}
                  required
                >
                  <option value="" disabled>
                    Choose staff member
                  </option>
                  {activeStaff.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.name} ({staff.email})
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Opening cash">
                <Input
                  name="opening"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  required
                />
              </Field>
              <Button
                type="submit"
                disabled={!canManageShift || !activeStaff.length}
              >
                Open shift
              </Button>
            </form>
          )}
        </div>
      </Modal>
    </div>
  );
}
