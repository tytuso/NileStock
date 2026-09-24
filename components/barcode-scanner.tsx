"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Camera,
  CameraOff,
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
  RotateCcw,
} from "lucide-react";
import {
  describeCameraIssue,
  isAppleMobileDevice,
  requestCameraAccess,
} from "@/lib/camera-permission";
import type { CameraIssue } from "@/lib/camera-permission";
import { Button, Input, Modal } from "./ui";

const CAMERA_KEY = "nilestock.preferred-camera";

export function BarcodeScanner({
  open,
  close,
  onCode,
}: {
  open: boolean;
  close: () => void;
  onCode: (c: string) => boolean;
}) {
  const [id] = useState(() => `scanner-${Math.random().toString(36).slice(2)}`),
    [manual, setManual] = useState(""),
    [error, setError] = useState(""),
    [cameraState, setCameraState] = useState<
      "starting" | "active" | "blocked" | "unavailable"
    >("starting"),
    [cameraIssue, setCameraIssue] = useState<CameraIssue | null>(null),
    [requestingCamera, setRequestingCamera] = useState(false),
    [retryVersion, setRetryVersion] = useState(0);
  const showCameraIssue = useCallback((cause: unknown) => {
    const issue = describeCameraIssue(cause, {
      isAppleMobile: isAppleMobileDevice(
        navigator.userAgent,
        navigator.platform,
        navigator.maxTouchPoints,
      ),
      isSecureContext: window.isSecureContext,
    });
    setCameraIssue(issue);
    setCameraState(issue.kind === "denied" ? "blocked" : "unavailable");
  }, []);
  const retryCamera = useCallback(async () => {
    setRequestingCamera(true);
    setCameraState("starting");
    setCameraIssue(null);
    setError("");
    try {
      await requestCameraAccess(navigator.mediaDevices);
      localStorage.removeItem(CAMERA_KEY);
      setRetryVersion((version) => version + 1);
    } catch (cause) {
      showCameraIssue(cause);
    } finally {
      setRequestingCamera(false);
    }
  }, [showCameraIssue]);
  const submit = (raw: string) => {
    const code = raw.trim();
    if (!code) {
      setError("Enter the barcode, QR code or SKU, then try again.");
      return false;
    }
    if (onCode(code)) {
      setError("");
      setManual("");
      return true;
    }
    setError(
      `No product matches “${code}”. Check the digits and re-enter the code.`,
    );
    return false;
  };
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    setManual("");
    setError("");
    setCameraState("starting");
    setCameraIssue(null);
    let scanner: import("html5-qrcode").Html5Qrcode | undefined;
    let stopped = false;
    let accepted = false;
    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        const remembered = localStorage.getItem(CAMERA_KEY);
        const cameras = remembered ? [] : await Html5Qrcode.getCameras();
        const selected = cameras.length
          ? cameras.find((camera) =>
              /back|rear|environment/i.test(camera.label),
            ) || cameras.at(-1)
          : undefined;
        if (selected) localStorage.setItem(CAMERA_KEY, selected.id);
        scanner = new Html5Qrcode(id);
        await scanner.start(
          remembered || selected?.id || { facingMode: "environment" },
          { fps: 15, qrbox: { width: 250, height: 160 } },
          (code: string) => {
            if (accepted || stopped) return;
            if (onCode(code)) {
              accepted = true;
            } else {
              setError(
                `No product matches “${code}”. Check the barcode and scan again.`,
              );
            }
          },
          () => {},
        );
        if (stopped) await scanner.stop().catch(() => {});
        else setCameraState("active");
      } catch (cause) {
        if (stopped) return;
        showCameraIssue(cause);
      }
    })();
    return () => {
      stopped = true;
      scanner?.stop().catch(() => {});
    };
  }, [open, id, onCode, retryVersion, showCameraIssue]);
  return (
    <Modal open={open} onClose={close} title="Scan product">
      <div className="scanner-lock relative overflow-hidden rounded-xl bg-black">
        <div id={id} className="min-h-64" />
        {cameraState !== "active" && (
          <div
            className="pointer-events-none absolute inset-0 grid min-h-64 place-items-center bg-gradient-to-b from-black/70 to-black/90 p-6 text-center text-white"
            aria-live="polite"
          >
            <div>
              {cameraState === "starting" ? (
                <LoaderCircle className="mx-auto mb-3 animate-spin" size={28} />
              ) : (
                <CameraOff className="mx-auto mb-3" size={28} />
              )}
              <p className="text-sm font-semibold">
                {cameraState === "starting"
                  ? requestingCamera
                    ? "Requesting camera permission…"
                    : "Starting rear camera…"
                  : "Camera needs attention"}
              </p>
            </div>
          </div>
        )}
        {cameraState === "active" && (
          <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-600/90 px-2.5 py-1 text-xs font-semibold text-white shadow-lg backdrop-blur">
            <CheckCircle2 size={14} /> Camera ready
          </span>
        )}
      </div>
      {cameraIssue && (
        <div
          role="alert"
          className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100"
        >
          <div className="flex items-start gap-2.5">
            <CircleAlert className="mt-0.5 shrink-0" size={18} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{cameraIssue.title}</p>
              <p className="mt-1 text-xs leading-5 opacity-85">
                {cameraIssue.message}
              </p>
              {cameraIssue.settingsHint && (
                <p className="mt-1.5 text-xs leading-5 opacity-85">
                  {cameraIssue.settingsHint}
                </p>
              )}
              <Button
                type="button"
                variant="secondary"
                className="mt-3 min-h-9 bg-surface px-3 text-xs text-ink"
                disabled={requestingCamera}
                onClick={retryCamera}
              >
                {requestingCamera ? (
                  <LoaderCircle className="animate-spin" size={15} />
                ) : cameraIssue.kind === "denied" ? (
                  <Camera size={15} />
                ) : (
                  <RotateCcw size={15} />
                )}
                {requestingCamera
                  ? "Requesting…"
                  : cameraIssue.kind === "denied"
                    ? "Allow camera"
                    : "Try camera again"}
              </Button>
            </div>
          </div>
        </div>
      )}
      {error && (
        <p
          id="scanner-code-error"
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200"
        >
          <CircleAlert className="mt-0.5 shrink-0" size={17} />
          <span>{error}</span>
        </p>
      )}
      <p className="mt-3 text-sm text-muted">
        Camera scanning is active. Tap the field only when you want to enter a
        code manually.
      </p>
      <div className="mt-3 flex gap-2">
        <Input
          aria-invalid={!!error}
          aria-describedby={error ? "scanner-code-error" : "scanner-manual-help"}
          autoComplete="off"
          enterKeyHint="done"
          placeholder="Tap to enter barcode, QR or SKU"
          value={manual}
          onChange={(e) => {
            setManual(e.target.value);
            if (error) setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit(manual);
            }
          }}
        />
        <Button onClick={() => submit(manual)}>Add</Button>
      </div>
      <p id="scanner-manual-help" className="mt-2 text-xs text-muted">
        Camera video stays on this device and is used only to read product
        codes. NileStock remembers the camera you approved on this phone. If
        the code is not recognised, add it to the product first.
      </p>
    </Modal>
  );
}
