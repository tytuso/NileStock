import { describe, expect, it } from "vitest";
import { cleanAdviserText } from "./ai-format";

describe("cleanAdviserText", () => {
  it("removes markdown headings and emphasis markers", () => {
    expect(
      cleanAdviserText(
        "## Business review\n\n### What looks positive\n- **Revenue:** UGX 35,000\n***",
      ),
    ).toBe(
      "Business review\n\nWhat looks positive\n• Revenue: UGX 35,000",
    );
  });

  it("removes inline code markers without changing the words", () => {
    expect(cleanAdviserText("Check `OPIO TITUS` and __stock__."))
      .toBe("Check OPIO TITUS and stock.");
  });
});
