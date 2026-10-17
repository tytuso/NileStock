// Structural types keep these optional browser APIs out of the global DOM types.
export type BleProfile = { service: string; characteristic: string };
export const BLE_PROFILES: BleProfile[] = [
  { service: "0000ffe0-0000-1000-8000-00805f9b34fb", characteristic: "0000ffe1-0000-1000-8000-00805f9b34fb" },
  { service: "0000ff00-0000-1000-8000-00805f9b34fb", characteristic: "0000ff02-0000-1000-8000-00805f9b34fb" },
  { service: "0000ae30-0000-1000-8000-00805f9b34fb", characteristic: "0000ae01-0000-1000-8000-00805f9b34fb" },
  { service: "6e400001-b5a3-f393-e0a9-e50e24dcca9e", characteristic: "6e400002-b5a3-f393-e0a9-e50e24dcca9e" },
];

type BleCharacteristic = {
  properties: { write: boolean; writeWithoutResponse: boolean };
  writeValueWithResponse(data: Uint8Array): Promise<void>;
  writeValueWithoutResponse(data: Uint8Array): Promise<void>;
};
type BleDevice = {
  name?: string;
  gatt?: {
    connect(): Promise<{ getPrimaryService(uuid: string): Promise<{
      getCharacteristic(uuid: string): Promise<BleCharacteristic>;
    }> }>;
    disconnect(): void;
  };
};
type SerialPort = {
  open(options: { baudRate: number; flowControl: "none" }): Promise<void>;
  writable: WritableStream<Uint8Array> | null;
  close(): Promise<void>;
};
type UsbAlternate = {
  alternateSetting: number;
  interfaceClass: number;
  endpoints: { direction: "in" | "out"; type: string; endpointNumber: number }[];
};
type UsbDevice = {
  productName?: string;
  configuration: null | { interfaces: { interfaceNumber: number; alternates: UsbAlternate[] }[] };
  open(): Promise<void>;
  selectConfiguration(value: number): Promise<void>;
  configurations: { configurationValue: number }[];
  claimInterface(value: number): Promise<void>;
  selectAlternateInterface(index: number, alternate: number): Promise<void>;
  transferOut(endpoint: number, bytes: Uint8Array): Promise<{ status: string; bytesWritten: number }>;
  releaseInterface(value: number): Promise<void>;
  close(): Promise<void>;
};
export type PrinterNavigator = {
  bluetooth?: { requestDevice(options: { acceptAllDevices: true; optionalServices: string[] }): Promise<BleDevice> };
  serial?: { requestPort(): Promise<SerialPort> };
  usb?: { requestDevice(options: { filters: { classCode: number }[] }): Promise<UsbDevice> };
};

export function printerCapabilities(nav: PrinterNavigator, userAgent: string, secure = true) {
  return {
    android: /Android/i.test(userAgent),
    ble: secure && !!nav.bluetooth,
    serial: secure && !!nav.serial,
    usb: secure && !!nav.usb,
  };
}

export function validateBleProfile(service: string, characteristic: string): BleProfile {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(service.trim()) || !uuid.test(characteristic.trim())) {
    throw new Error("Enter the full service and write-characteristic UUIDs from your printer manual.");
  }
  return { service: service.trim().toLowerCase(), characteristic: characteristic.trim().toLowerCase() };
}

export function printerError(error: unknown) {
  const name = error instanceof Error ? error.name : "";
  if (name === "PrinterSelectionCancelled") return "Printer selection cancelled. Nothing was sent.";
  if (name === "SecurityError" || name === "NotAllowedError") {
    return "Printer access was blocked. Open NileStock in Chrome or Edge over HTTPS and allow device access. You can also use system printing or the Android print app.";
  }
  const detail = error instanceof Error ? error.message : "Connection failed.";
  return `${detail} Check power, paper and connection. If printing started, check the receipt before retrying to avoid a duplicate. Try system printing or the Android print app if this connection is unavailable.`;
}

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function selection<T>(request: Promise<T>): Promise<T> {
  try { return await request; } catch (error) {
    if (error instanceof Error && ["NotFoundError", "AbortError"].includes(error.name)) {
      const cancelled = new Error("Printer selection cancelled.");
      cancelled.name = "PrinterSelectionCancelled";
      throw cancelled;
    }
    throw error;
  }
}

export async function sendBle(nav: PrinterNavigator, bytes: Uint8Array, custom?: BleProfile) {
  if (!nav.bluetooth) throw new Error("Direct Bluetooth LE is unavailable in this browser.");
  const profiles = custom ? [custom] : BLE_PROFILES;
  // Called directly from the button handler, before any await: preserves gesture.
  const device = await selection(nav.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: [...new Set(profiles.map((profile) => profile.service))],
  }));
  try {
    if (!device.gatt) throw new Error("This printer has no Bluetooth LE connection. On Android use the print app for Bluetooth Classic.");
    const server = await device.gatt.connect();
    let output: BleCharacteristic | undefined;
    for (const profile of profiles) {
      try {
        const service = await server.getPrimaryService(profile.service);
        const candidate = await service.getCharacteristic(profile.characteristic);
        if (candidate.properties.write || candidate.properties.writeWithoutResponse) {
          output = candidate;
          break;
        }
      } catch {
        // Discovery only. Never retry a write or send to an arbitrary endpoint.
      }
    }
    if (!output) throw new Error("No supported receipt service found. Try the printer's service UUIDs in advanced settings, or use the Android print app.");
    // 20-byte chunks fit older BLE printers; sequential writes avoid GATT races.
    for (let offset = 0; offset < bytes.length; offset += 20) {
      const chunk = bytes.slice(offset, offset + 20);
      if (output.properties.write) await output.writeValueWithResponse(chunk);
      else await output.writeValueWithoutResponse(chunk);
      await pause(20);
    }
    await pause(150);
    return device.name || "Bluetooth LE printer";
  } finally {
    device.gatt?.disconnect();
  }
}

export async function sendSerial(nav: PrinterNavigator, bytes: Uint8Array, baudRate = 9600) {
  if (!nav.serial) throw new Error("Serial printing is unavailable in this browser.");
  const port = await selection(nav.serial.requestPort());
  let opened = false;
  let writer: WritableStreamDefaultWriter<Uint8Array> | undefined;
  try {
    await port.open({ baudRate, flowControl: "none" });
    opened = true;
    if (!port.writable) throw new Error("The selected port is not writable.");
    writer = port.writable.getWriter();
    for (let offset = 0; offset < bytes.length; offset += 256) {
      const chunk = bytes.slice(offset, offset + 256);
      await writer.write(chunk);
      // Allow a slow physical serial printer to consume each block.
      await pause(Math.ceil(chunk.length * 10 * 1000 / baudRate) + 20);
    }
    await writer.close();
    return "Serial printer";
  } finally {
    writer?.releaseLock();
    if (opened) await port.close().catch(() => undefined);
  }
}

export async function sendUsb(nav: PrinterNavigator, bytes: Uint8Array) {
  if (!nav.usb) throw new Error("Direct USB is unavailable in this browser.");
  // Only show printer and vendor-class devices. User explicitly chooses printer.
  const device = await selection(nav.usb.requestDevice({ filters: [{ classCode: 7 }, { classCode: 255 }] }));
  let claimed: number | undefined;
  let opened = false;
  try {
    await device.open();
    opened = true;
    if (!device.configuration) {
      const first = device.configurations[0];
      if (!first) throw new Error("This USB printer has no configuration.");
      await device.selectConfiguration(first.configurationValue);
    }
    let target: { interfaceNumber: number; alternate: UsbAlternate; endpoint: number } | undefined;
    for (const iface of device.configuration?.interfaces || []) {
      for (const alternate of iface.alternates) {
        const endpoint = alternate.endpoints.find((item) => item.direction === "out" && item.type === "bulk");
        if (endpoint && [7, 255].includes(alternate.interfaceClass)) {
          target = { interfaceNumber: iface.interfaceNumber, alternate, endpoint: endpoint.endpointNumber };
          break;
        }
      }
      if (target) break;
    }
    if (!target) throw new Error("No compatible USB receipt endpoint found.");
    await device.claimInterface(target.interfaceNumber);
    claimed = target.interfaceNumber;
    await device.selectAlternateInterface(target.interfaceNumber, target.alternate.alternateSetting);
    for (let offset = 0; offset < bytes.length; offset += 64) {
      const chunk = bytes.slice(offset, offset + 64);
      const result = await device.transferOut(target.endpoint, chunk);
      if (result.status !== "ok" || result.bytesWritten !== chunk.length) {
        throw new Error("The printer did not accept the complete receipt.");
      }
      await pause(20);
    }
    await pause(150);
    return device.productName || "USB printer";
  } finally {
    if (claimed !== undefined) await device.releaseInterface(claimed).catch(() => undefined);
    if (opened) await device.close().catch(() => undefined);
  }
}
