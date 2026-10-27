import { describe, expect, it } from "vitest";

import { validateNhsModulus11 } from "@/server/privacy/nhs";

describe("NHS modulus 11", () => {
  it("accepts a valid checksum", () => {
    expect(validateNhsModulus11("9434765919")).toMatchObject({ valid: true, reason: "valid" });
  });

  it("accepts whitespace formatting", () => {
    expect(validateNhsModulus11("943 476 5919").valid).toBe(true);
  });

  it("rejects an invalid checksum", () => {
    expect(validateNhsModulus11("9434765918")).toMatchObject({ valid: false, reason: "checksum_invalid" });
  });

  it("rejects a check digit that would be 10", () => {
    expect(validateNhsModulus11("1234567890").valid).toBe(false);
  });

  it("rejects malformed numbers", () => {
    expect(validateNhsModulus11("12345")).toMatchObject({ valid: false, reason: "malformed", normalised: null });
  });

  it("accepts a second synthetic number used in the cache lab", () => {
    expect(validateNhsModulus11("401 023 2137").valid).toBe(true);
  });
});
