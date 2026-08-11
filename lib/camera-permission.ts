export type CameraIssueKind =
  | "denied"
  | "insecure"
  | "missing"
  | "busy"
  | "constraints"
  | "unsupported"
  | "unknown";

export type CameraIssue = {
  kind: CameraIssueKind;
  title: string;
  message: string;
  settingsHint?: string;
};

type CameraIssueContext = {
  isAppleMobile: boolean;
  isSecureContext: boolean;
};

function errorDetails(error: unknown) {
  if (error instanceof Error || error instanceof DOMException) {
    return {
      name: error.name,
      text: `${error.name} ${error.message}`.toLowerCase(),
    };
  }
  const text = String(error ?? "").toLowerCase();
  return { name: "", text };
}

export function isAppleMobileDevice(
  userAgent: string,
  platform = "",
  maxTouchPoints = 0,
) {
  return (
    /iPhone|iPad|iPod/i.test(userAgent) ||
    (platform === "MacIntel" && maxTouchPoints > 1)
  );
}

export function describeCameraIssue(
  error: unknown,
  { isAppleMobile, isSecureContext }: CameraIssueContext,
): CameraIssue {
  const { name, text } = errorDetails(error);

  if (!isSecureContext || name === "SecurityError") {
    return {
      kind: "insecure",
      title: "Camera needs a secure connection",
      message:
        "Open NileStock using its HTTPS preview or production address, then try the camera again.",
    };
  }

  if (
    name === "NotAllowedError" ||
    name === "PermissionDeniedError" ||
    text.includes("notallowed") ||
    text.includes("permission denied") ||
    text.includes("permission dismissed")
  ) {
    return {
      kind: "denied",
      title: "Camera permission is blocked",
      message: "Tap Allow camera to request access again.",
      settingsHint: isAppleMobile
        ? "If Safari does not ask again: tap the Page Menu, tap More, then set Camera to Allow. You can also use Settings → Apps → Safari → Camera and choose Ask or Allow. Return here and tap Allow camera again."
        : "If the browser does not ask again, open this site's permissions, set Camera to Allow, then return and tap Allow camera again.",
    };
  }

  if (
    name === "NotFoundError" ||
    name === "DevicesNotFoundError" ||
    text.includes("no camera") ||
    text.includes("not found")
  ) {
    return {
      kind: "missing",
      title: "No camera found",
      message:
        "NileStock could not find a usable camera. You can still enter the barcode, QR code or SKU manually.",
    };
  }

  if (
    name === "NotReadableError" ||
    name === "TrackStartError" ||
    text.includes("could not start video source") ||
    text.includes("camera is in use")
  ) {
    return {
      kind: "busy",
      title: "Camera is busy",
      message:
        "Close the Camera app, WhatsApp, or another browser tab using the camera, then try again.",
    };
  }

  if (name === "OverconstrainedError" || text.includes("overconstrained")) {
    return {
      kind: "constraints",
      title: "Rear camera unavailable",
      message:
        "Tap Try camera again and NileStock will forget the old camera choice and select another available camera.",
    };
  }

  if (name === "NotSupportedError" || text.includes("not supported")) {
    return {
      kind: "unsupported",
      title: "Camera is not supported here",
      message:
        "Open NileStock in a current Safari, Chrome, Edge, or Firefox browser, or enter the code manually.",
    };
  }

  return {
    kind: "unknown",
    title: "Camera could not start",
    message:
      "Check camera permission and make sure another app is not using the camera, then try again.",
  };
}

export async function requestCameraAccess(
  mediaDevices: Pick<MediaDevices, "getUserMedia"> | undefined,
) {
  if (!mediaDevices?.getUserMedia) {
    const error = new Error("Camera access is not supported by this browser.");
    error.name = "NotSupportedError";
    throw error;
  }

  const stream = await mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: "environment" } },
  });
  stream.getTracks().forEach((track) => track.stop());
}
