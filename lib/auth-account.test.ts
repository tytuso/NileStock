import { describe, expect, it } from "vitest";
import { isRepeatedSignup } from "./auth-account";

describe("isRepeatedSignup", () => {
  it("recognizes Supabase's protected response for an existing account", () => {
    expect(
      isRepeatedSignup({
        session: null,
        user: { identities: [] },
      }),
    ).toBe(true);
  });

  it("does not mistake a new email signup for an existing account", () => {
    expect(
      isRepeatedSignup({
        session: null,
        user: { identities: [{ provider: "email" }] },
      }),
    ).toBe(false);
  });

  it("does not flag a completed signup session", () => {
    expect(
      isRepeatedSignup({
        session: { access_token: "token" },
        user: { identities: [] },
      }),
    ).toBe(false);
  });
});
