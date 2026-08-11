import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const posSource = readFileSync(
  new URL("../components/pos.tsx", import.meta.url),
  "utf8",
);
const scannerSource = posSource.slice(posSource.indexOf("function Scanner("));

describe("scanner keyboard priority", () => {
  it("dismisses an existing keyboard before opening the camera", () => {
    expect(posSource).toContain("document.activeElement.blur()");
  });

  it("does not focus the manual field without a user tap", () => {
    expect(scannerSource).not.toContain("autoFocus");
    expect(scannerSource).not.toMatch(/\.focus\(|\.select\(/);
    expect(scannerSource).toContain(
      "Camera scanning is active. Tap the field only when you want to enter a",
    );
  });
});
