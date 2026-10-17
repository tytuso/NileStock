import { afterEach, describe, expect, it, vi } from "vitest";
import {
  printerCapabilities, printerError, sendBle, sendSerial, sendUsb, validateBleProfile,
} from "./printer-connections";

afterEach(() => vi.useRealTimers());

describe("printer capability detection", () => {
  it("offers Android app printing independently of direct browser APIs", () => {
    expect(printerCapabilities({}, "Mozilla Android")).toEqual({ android: true, ble: false, serial: false, usb: false });
    expect(printerCapabilities({}, "iPhone Safari")).toEqual({ android: false, ble: false, serial: false, usb: false });
  });
  it("validates custom BLE endpoints before requesting access", () => {
    expect(() => validateBleProfile("xyz", "abc")).toThrow("full service");
    expect(validateBleProfile(" 0000FFE0-0000-1000-8000-00805F9B34FB ", "0000FFE1-0000-1000-8000-00805F9B34FB").service)
      .toBe("0000ffe0-0000-1000-8000-00805f9b34fb");
  });
});

function bleFixture(writeWithoutResponse = false) {
  const characteristic = {
    properties: { write: !writeWithoutResponse, writeWithoutResponse },
    writeValueWithResponse: vi.fn().mockResolvedValue(undefined),
    writeValueWithoutResponse: vi.fn().mockResolvedValue(undefined),
  };
  const disconnect = vi.fn();
  const getPrimaryService = vi.fn().mockResolvedValue({ getCharacteristic: vi.fn().mockResolvedValue(characteristic) });
  const requestDevice = vi.fn().mockResolvedValue({ name: "TestPrinter", gatt: {
    connect: vi.fn().mockResolvedValue({ getPrimaryService }), disconnect,
  } });
  return { characteristic, disconnect, getPrimaryService, requestDevice, nav: { bluetooth: { requestDevice } } };
}

describe("Bluetooth LE transport", () => {
  it.each([false, true])("sends the complete receipt in ordered 20-byte chunks (without-response=%s)", async (withoutResponse) => {
    vi.useFakeTimers();
    const fixture = bleFixture(withoutResponse);
    const bytes = Uint8Array.from({ length: 53 }, (_, index) => index);
    const result = sendBle(fixture.nav, bytes);
    await vi.runAllTimersAsync();
    await expect(result).resolves.toBe("TestPrinter");
    const writer = withoutResponse ? fixture.characteristic.writeValueWithoutResponse : fixture.characteristic.writeValueWithResponse;
    expect(writer.mock.calls.map(([chunk]) => [...chunk])).toEqual([
      [...bytes.slice(0, 20)], [...bytes.slice(20, 40)], [...bytes.slice(40)],
    ]);
    expect(fixture.disconnect).toHaveBeenCalledOnce();
  });
  it("stops after a partial failure, disconnects and does not silently retry", async () => {
    vi.useFakeTimers();
    const fixture = bleFixture();
    fixture.characteristic.writeValueWithResponse.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("Disconnected"));
    const assertion = expect(sendBle(fixture.nav, new Uint8Array(60))).rejects.toThrow("Disconnected");
    await vi.runAllTimersAsync();
    await assertion;
    expect(fixture.characteristic.writeValueWithResponse).toHaveBeenCalledTimes(2);
    expect(fixture.disconnect).toHaveBeenCalledOnce();
  });
  it("does not write if no supported service exists", async () => {
    const fixture = bleFixture();
    fixture.getPrimaryService.mockRejectedValue(new Error("Not found"));
    await expect(sendBle(fixture.nav, new Uint8Array([1]))).rejects.toThrow("No supported receipt service");
    expect(fixture.characteristic.writeValueWithResponse).not.toHaveBeenCalled();
    expect(fixture.disconnect).toHaveBeenCalledOnce();
  });
  it("identifies cancellation at selection only, without claiming a later failure sent nothing", async () => {
    const error = new Error("Cancelled"); error.name = "NotFoundError";
    let caught: unknown;
    try { await sendBle({ bluetooth: { requestDevice: vi.fn().mockRejectedValue(error) } }, new Uint8Array()); }
    catch (failure) { caught = failure; }
    expect(printerError(caught)).toBe("Printer selection cancelled. Nothing was sent.");
    expect(printerError(error)).toContain("avoid a duplicate");
  });
});

describe("USB transport", () => {
  function usbFixture() {
    const device = {
      productName: "USB receipt", configuration: { interfaces: [{ interfaceNumber: 2,
        alternates: [{ alternateSetting: 1, interfaceClass: 7,
          endpoints: [{ direction: "out" as const, type: "bulk", endpointNumber: 3 }] }],
      }] },
      configurations: [{ configurationValue: 1 }],
      open: vi.fn().mockResolvedValue(undefined), selectConfiguration: vi.fn().mockResolvedValue(undefined),
      claimInterface: vi.fn().mockResolvedValue(undefined), selectAlternateInterface: vi.fn().mockResolvedValue(undefined),
      transferOut: vi.fn().mockImplementation(async (_endpoint: number, bytes: Uint8Array) => ({ status: "ok", bytesWritten: bytes.length })),
      releaseInterface: vi.fn().mockResolvedValue(undefined), close: vi.fn().mockResolvedValue(undefined),
    };
    return { device, nav: { usb: { requestDevice: vi.fn().mockResolvedValue(device) } } };
  }
  it("uses the discovered interface/alternate/endpoint rather than hard-coded numbers", async () => {
    vi.useFakeTimers();
    const { device, nav } = usbFixture();
    const result = sendUsb(nav, new Uint8Array(130));
    await vi.runAllTimersAsync();
    await expect(result).resolves.toBe("USB receipt");
    expect(device.claimInterface).toHaveBeenCalledWith(2);
    expect(device.selectAlternateInterface).toHaveBeenCalledWith(2, 1);
    expect(device.transferOut.mock.calls.map(([endpoint, data]) => [endpoint, data.length])).toEqual([[3, 64], [3, 64], [3, 2]]);
    expect(device.releaseInterface).toHaveBeenCalledWith(2);
    expect(device.close).toHaveBeenCalledOnce();
  });
  it("reports short writes and releases the device without resending", async () => {
    const { device, nav } = usbFixture();
    device.transferOut.mockResolvedValue({ status: "ok", bytesWritten: 1 });
    await expect(sendUsb(nav, new Uint8Array(70))).rejects.toThrow("complete receipt");
    expect(device.transferOut).toHaveBeenCalledOnce();
    expect(device.releaseInterface).toHaveBeenCalledWith(2);
    expect(device.close).toHaveBeenCalledOnce();
  });
  it("closes an opened device if the operating system blocks its interface", async () => {
    const { device, nav } = usbFixture();
    device.claimInterface.mockRejectedValue(new Error("Driver owns interface"));
    await expect(sendUsb(nav, new Uint8Array(3))).rejects.toThrow("Driver owns interface");
    expect(device.releaseInterface).not.toHaveBeenCalled();
    expect(device.close).toHaveBeenCalledOnce();
  });
});

describe("serial transport", () => {
  it("writes all bytes at the configured baud rate and releases the port", async () => {
    vi.useFakeTimers();
    const write = vi.fn();
    const port = {
      open: vi.fn().mockResolvedValue(undefined),
      writable: new WritableStream<Uint8Array>({ write }),
      close: vi.fn().mockResolvedValue(undefined),
    };
    const result = sendSerial({ serial: { requestPort: vi.fn().mockResolvedValue(port) } }, new Uint8Array(300), 19200);
    await vi.runAllTimersAsync();
    await expect(result).resolves.toBe("Serial printer");
    expect(port.open).toHaveBeenCalledWith({ baudRate: 19200, flowControl: "none" });
    expect(write.mock.calls.map(([data]) => data.length)).toEqual([256, 44]);
    expect(port.writable.locked).toBe(false);
    expect(port.close).toHaveBeenCalledOnce();
  });
  it("releases the stream lock and closes the port on transmission failure", async () => {
    const port = {
      open: vi.fn().mockResolvedValue(undefined),
      writable: new WritableStream<Uint8Array>({ write() { throw new Error("Cable removed"); } }),
      close: vi.fn().mockResolvedValue(undefined),
    };
    await expect(sendSerial({ serial: { requestPort: vi.fn().mockResolvedValue(port) } }, new Uint8Array(3))).rejects.toThrow("Cable removed");
    expect(port.writable.locked).toBe(false);
    expect(port.close).toHaveBeenCalledOnce();
  });
});
