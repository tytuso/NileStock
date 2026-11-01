// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { Modal } from "@/components/ui";

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = null;
  host?.remove();
  host = null;
  document.querySelectorAll("[data-app-modal]").forEach((node) => node.remove());
  document.body.style.overflow = "";
});

describe("mobile customer modal", () => {
  it("renders outside transformed parents and keeps scrolling separate from Save", async () => {
    host = document.createElement("div");
    host.style.transform = "translateY(5px)";
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root?.render(
        <Modal open onClose={() => undefined} title="Add customer" fullScreenMobile
          footer={<button type="submit" form="test-customer-form">Create customer</button>}>
          <form id="test-customer-form">
            <input aria-label="Customer name" />
            <div style={{ height: 1500 }}>Long customer form</div>
          </form>
        </Modal>,
      );
    });
    const dialog = document.querySelector("[data-app-modal]");
    expect(dialog).not.toBeNull();
    expect(host.contains(dialog)).toBe(false);
    expect(dialog?.parentElement).toBe(document.body.querySelector("[data-app-modal]")?.parentElement);
    expect(dialog?.closest("[role=dialog]")).toBe(dialog);
    expect(dialog?.querySelector("[touch-pan-y]")).toBeNull();
    const scroller = dialog?.querySelector(".overflow-y-auto");
    expect(scroller?.contains(dialog?.querySelector("form") || null)).toBe(true);
    expect(scroller?.contains(dialog?.querySelector("button[form]") || null)).toBe(false);
    expect(dialog?.querySelector("button[form]")?.getAttribute("form"))
      .toBe("test-customer-form");
  });
});
