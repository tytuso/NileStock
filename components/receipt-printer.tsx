"use client";

import { useEffect, useRef, useState } from "react";
import { Bluetooth, Printer, Usb, X } from "lucide-react";
import type { Business, Sale } from "@/lib/types";
import {
  escposBytes, printerTestText, rawbtIntent, RAWBT_STORE, receiptText,
  type ThermalPaper,
} from "@/lib/thermal-receipt";
import {
  printerCapabilities, printerError, sendBle, sendSerial, sendUsb,
  validateBleProfile, type PrinterNavigator,
} from "@/lib/printer-connections";
import { Button, Field, Input, Select } from "./ui";

type Method = "system" | "android" | "ble" | "usb" | "serial";
const preferenceKey = "nilestock.printer.method.v1";
const explanations: Record<Method, string> = {
  system: "Use a printer installed on your device: Wi-Fi, network, USB or Bluetooth through its driver. On iPhone/iPad use AirPrint, or share the receipt PDF to your printer's app. A paired Bluetooth printer alone may not appear here.",
  android: "For portable Bluetooth Classic receipt printers on Android. Install RawBT, pair your printer in Android settings, then select it in RawBT and run its test print. Return here to send a receipt. RawBT also supports compatible USB and network printers.",
  ble: "Connect directly to a compatible Bluetooth LE receipt printer in Chrome or Edge. Select only your receipt printer in the chooser. Older Bluetooth Classic printers need the Android print app or desktop serial option.",
  usb: "Connect a compatible ESC/POS receipt printer by USB (OTG adapter on Android). Use Chrome or Edge. If its driver owns the USB interface or access is blocked, use system printing or the Android print app instead.",
  serial: "For desktop Chrome/Edge: pair a Bluetooth Classic serial printer first, or connect a USB serial printer, then choose its port. Match the baud rate to the printer manual.",
};

export function ReceiptPrinter({ business, sale, onClose }: {
  business: Business; sale: Sale; onClose: () => void;
}) {
  const [capabilities, setCapabilities] = useState({ android: false, ble: false, usb: false, serial: false });
  const [method, setMethod] = useState<Method>("system");
  const [paper, setPaper] = useState<ThermalPaper>(business.paper === "80mm" ? "80mm" : "58mm");
  const [baudRate, setBaudRate] = useState(9600);
  const [service, setService] = useState("");
  const [characteristic, setCharacteristic] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const inProgress = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const caps = printerCapabilities(navigator as unknown as PrinterNavigator, navigator.userAgent, window.isSecureContext);
    setCapabilities(caps);
    try {
      const saved = localStorage.getItem(preferenceKey) as Method | null;
      if (saved === "system" || (saved && saved in caps && caps[saved as keyof typeof caps])) setMethod(saved);
      else if (caps.android) setMethod("android");
    } catch {
      if (caps.android) setMethod("android");
    }
    heading.current?.focus();
  }, []);

  const chooseMethod = (value: Method) => {
    setMethod(value);
    setStatus("");
    setError("");
    try { localStorage.setItem(preferenceKey, value); } catch { /* Optional preference. */ }
  };

  const print = async (test = false) => {
    if (inProgress.current) return;
    inProgress.current = true;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      if (method === "system") {
        window.print();
        setStatus("Print dialog requested. If no printer appears, install its print service or use Share PDF. NileStock cannot confirm whether paper printed.");
        return;
      }
      const bytes = escposBytes(test ? printerTestText(paper) : receiptText(business, sale, paper));
      if (method === "android") {
        if (!capabilities.android) throw new Error("The Android print app option is only available on Android.");
        // Keep app navigation in the original tap; Android intent fallback opens
        // the official store listing if RawBT is missing.
        window.location.href = rawbtIntent(bytes);
        setStatus(`${test ? "Test" : "Receipt"} handed to the Android print app. Finish printing there. If nothing opens, install RawBT and select your printer in it first. Printing is not confirmed by NileStock.`);
        return;
      }
      const nav = navigator as unknown as PrinterNavigator;
      const custom = method === "ble" && (service || characteristic)
        ? validateBleProfile(service, characteristic) : undefined;
      const target = method === "ble" ? await sendBle(nav, bytes, custom)
        : method === "usb" ? await sendUsb(nav, bytes) : await sendSerial(nav, bytes, baudRate);
      setStatus(`${test ? "Test" : "Receipt"} data sent to ${target}. Check the paper to confirm printing. If it is incomplete, check the connection before retrying.`);
    } catch (failure) {
      setError(printerError(failure));
    } finally {
      inProgress.current = false;
      setBusy(false);
    }
  };

  return (
    <section aria-label="Receipt printer options" className="no-print mt-4 rounded-2xl border border-line bg-surface p-4 text-left text-ink shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 ref={heading} tabIndex={-1} className="flex items-center gap-2 font-bold outline-none"><Printer size={18} /> Print receipt</h3>
        <Button aria-label="Close printer options" variant="ghost" className="h-9 min-h-9 w-9 p-0" disabled={busy} onClick={onClose}><X size={17} /></Button>
      </div>
      <div className="space-y-4">
        <Field label="Connection">
          <Select value={method} disabled={busy} onChange={(event) => chooseMethod(event.target.value as Method)}>
            <option value="system">Device / system printer</option>
            <option value="android" disabled={!capabilities.android}>Android Bluetooth / print app{!capabilities.android ? " (Android only)" : ""}</option>
            <option value="ble" disabled={!capabilities.ble}>Direct Bluetooth LE{!capabilities.ble ? " (unavailable in this browser)" : ""}</option>
            <option value="usb" disabled={!capabilities.usb}>Direct USB{!capabilities.usb ? " (unavailable in this browser)" : ""}</option>
            <option value="serial" disabled={!capabilities.serial}>Desktop Bluetooth / serial{!capabilities.serial ? " (unavailable in this browser)" : ""}</option>
          </Select>
        </Field>
        <p className="text-xs leading-5 text-muted">{explanations[method]}</p>
        {method === "android" && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-950">
            <p className="mb-1 flex items-center gap-1.5 font-bold"><Bluetooth size={15} /> One-time phone setup</p>
            <ol className="ml-4 list-decimal space-y-1">
              <li>Install <a href={RAWBT_STORE} target="_blank" rel="noopener noreferrer" className="font-bold underline">RawBT from Google Play</a>.</li>
              <li>Pair your printer and choose it in RawBT. Allow its Bluetooth permissions.</li>
              <li>Print a test in RawBT, then return here and tap Test print.</li>
            </ol>
            <p className="mt-2">RawBT is a separate third-party app with its own terms and pricing. The receipt is passed to that app on your phone.</p>
          </div>
        )}
        {method !== "system" ? (
          <>
            <Field label="Thermal paper width">
              <Select value={paper} disabled={busy} onChange={(event) => setPaper(event.target.value as ThermalPaper)}>
                <option value="58mm">58 mm (32 columns)</option>
                <option value="80mm">80 mm (48 columns)</option>
              </Select>
            </Field>
            <p className="text-xs text-muted">For ESC/POS receipt printers. Thermal output uses plain text; use PDF for original characters and the full receipt design.</p>
          </>
        ) : <p className="text-xs text-muted">Receipt format: <b>{business.paper}</b>. Change it in Settings → Receipt paper. Match the paper size in the print dialog and disable browser headers/footers.</p>}
        {method === "serial" && (
          <Field label="Printer baud rate">
            <Select value={baudRate} disabled={busy} onChange={(event) => setBaudRate(Number(event.target.value))}>
              {[9600, 19200, 38400, 57600, 115200].map((rate) => <option key={rate} value={rate}>{rate}</option>)}
            </Select>
          </Field>
        )}
        {method === "ble" && (
          <details className="text-xs">
            <summary className="cursor-pointer font-semibold">Advanced Bluetooth settings</summary>
            <div className="mt-3 space-y-3">
              <p className="leading-5 text-muted">Leave blank to try common receipt-printer profiles. For another ESC/POS Bluetooth LE printer, use the full UUIDs supplied by its manufacturer.</p>
              <Field label="Service UUID"><Input value={service} disabled={busy} onChange={(event) => setService(event.target.value)} placeholder="0000ffe0-0000-1000-8000-00805f9b34fb" /></Field>
              <Field label="Write characteristic UUID"><Input value={characteristic} disabled={busy} onChange={(event) => setCharacteristic(event.target.value)} placeholder="0000ffe1-0000-1000-8000-00805f9b34fb" /></Field>
            </div>
          </details>
        )}
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => void print()}>{method === "usb" ? <Usb size={16} /> : <Printer size={16} />}{busy ? "Sending…" : method === "android" ? "Open print app" : "Print receipt"}</Button>
          {method !== "system" && <Button variant="secondary" disabled={busy} onClick={() => void print(true)}>Test print</Button>}
        </div>
        {busy && <p role="status" className="text-xs text-muted">Choose your receipt printer and keep this page open while it sends.</p>}
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs leading-5 text-red-800">{error}</p>}
        {status && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-xs leading-5 text-emerald-900">{status}</p>}
        <a className="inline-block text-xs font-semibold text-accent underline" href="/printing" target="_blank" rel="noopener noreferrer">Printer setup and troubleshooting</a>
      </div>
    </section>
  );
}
