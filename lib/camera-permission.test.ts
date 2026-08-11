import { describe, expect, it, vi } from "vitest";
import {
  describeCameraIssue,
  isAppleMobileDevice,
  requestCameraAccess,
} from "./camera-permission";

describe("camera permission recovery", () => {
  it("recognises iPhone and iPadOS devices", () => {
    expect(isAppleMobileDevice("Mozilla/5.0 (iPhone)")).toBe(true);
    expect(isAppleMobileDevice("Mozilla/5.0", "MacIntel", 5)).toBe(true);
    expect(isAppleMobileDevice("Mozilla/5.0", "Win32", 0)).toBe(false);
  });

  it("gives iPhone settings guidance after a denial", () => {
    const error = new Error("Permission denied");
    error.name = "NotAllowedError";

    const issue = describeCameraIssue(error, {
      isAppleMobile: true,
      isSecureContext: true,
    });

    expect(issue.kind).toBe("denied");
    expect(issue.settingsHint).toContain("Settings → Apps → Safari → Camera");
  });

  it("distinguishes a busy camera from denied permission", () => {
    const error = new Error("Could not start video source");
    error.name = "NotReadableError";

    expect(
      describeCameraIssue(error, {
        isAppleMobile: false,
        isSecureContext: true,
      }).kind,
    ).toBe("busy");
  });

  it("stops the temporary permission stream", async () => {
    const stop = vi.fn();
    const getUserMedia = vi.fn().mockResolvedValue({
      getTracks: () => [{ stop }],
    });

    await requestCameraAccess({ getUserMedia } as unknown as MediaDevices);

    expect(getUserMedia).toHaveBeenCalledWith({
      audio: false,
      video: { facingMode: { ideal: "environment" } },
    });
    expect(stop).toHaveBeenCalledOnce();
  });
});
