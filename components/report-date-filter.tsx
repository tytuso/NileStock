"use client";
import { useId } from "react";
import { CalendarDays } from "lucide-react";
import {
  reportPeriodLabel,
  reportPresetRange,
  reportRangeError,
  type ReportDateRange,
  type ReportPreset,
} from "@/lib/report-period";
import { Button, Card, Field, Input } from "./ui";

export type ReportPeriodProps = {
  range: ReportDateRange;
  onRangeChange: (range: ReportDateRange) => void;
};

const presets: { value: ReportPreset; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "week", label: "Last 7 days" },
  { value: "month", label: "This month" },
];

export function ReportDateFilter({ range, onRangeChange }: ReportPeriodProps) {
  const descriptionId = useId();
  const error = reportRangeError(range);
  return (
    <Card className="overflow-hidden rounded-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-gradient-to-r from-emerald-500/[.06] to-sky-500/[.05] p-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="rounded-xl bg-emerald-500/10 p-2.5 text-accent">
            <CalendarDays size={20} />
          </span>
          <div>
            <h2 className="text-sm font-semibold">Reporting period</h2>
            <p className="mt-0.5 text-xs text-muted">
              {error ? "Choose a valid date range" : reportPeriodLabel(range)}
            </p>
          </div>
        </div>
        {(range.from || range.to) && (
          <Button
            variant="ghost"
            className="min-h-8 px-3 text-xs"
            onClick={() => onRangeChange({ from: "", to: "" })}
          >
            Clear dates
          </Button>
        )}
      </div>
      <div className="space-y-4 p-4 sm:p-5">
        <div
          className="flex flex-wrap gap-2"
          aria-label="Quick reporting periods"
        >
          {presets.map((preset) => {
            const dates = reportPresetRange(preset.value);
            const selected = range.from === dates.from && range.to === dates.to;
            return (
              <Button
                key={preset.value}
                variant={selected ? "primary" : "secondary"}
                className="min-h-9 rounded-full px-3 text-xs"
                aria-pressed={selected}
                onClick={() => onRangeChange(dates)}
              >
                {preset.label}
              </Button>
            );
          })}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="From date">
            <Input
              type="date"
              aria-label="From date"
              value={range.from}
              max={range.to || undefined}
              aria-invalid={!!error}
              aria-describedby={descriptionId}
              onChange={(event) =>
                onRangeChange({ ...range, from: event.target.value })
              }
              className="min-w-0 bg-surface [color-scheme:light] dark:[color-scheme:dark]"
            />
          </Field>
          <Field label="To date">
            <Input
              type="date"
              aria-label="To date"
              value={range.to}
              min={range.from || undefined}
              aria-invalid={!!error}
              aria-describedby={descriptionId}
              onChange={(event) =>
                onRangeChange({ ...range, to: event.target.value })
              }
              className="min-w-0 bg-surface [color-scheme:light] dark:[color-scheme:dark]"
            />
          </Field>
        </div>
        <p
          id={descriptionId}
          role={error ? "alert" : undefined}
          className={`text-xs ${error ? "text-red-600 dark:text-red-400" : "text-muted"}`}
        >
          {error ||
            "Figures update instantly. Start and end dates are included."}
        </p>
      </div>
    </Card>
  );
}
