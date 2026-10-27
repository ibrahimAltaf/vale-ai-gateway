import { describe, expect, it } from "vitest";

import { detectPii } from "@/server/privacy/detector";
import { restorePlaceholders, tokenise } from "@/server/privacy/tokeniser";

const SAMPLE =
  "Please summarise the medical record for patient John Smith, NHS number 943 476 5919. His email is john.smith@example.com and postcode is SW1A 1AA.";

describe("UK PII detection", () => {
  it("masks the gateway sample and restores it exactly", () => {
    const detected = detectPii(SAMPLE);
    const masked = tokenise(SAMPLE, detected);
    expect(masked.masked).toBe(
      "Please summarise the medical record for patient <PERSON_1>, NHS number <NHS_1>. His email is <EMAIL_1> and postcode is <UK_POSTCODE_1>.",
    );
    expect(restorePlaceholders(masked.masked, masked.placeholders)).toBe(SAMPLE);
  });

  it("recognises NI numbers, phones and dates of birth", () => {
    const text = "NI AB 12 34 56 C, phone 07700 900123, born 14/03/1982.";
    const types = detectPii(text).map((entity) => entity.type);
    expect(types).toEqual(expect.arrayContaining(["NI_NUMBER", "PHONE", "DATE_OF_BIRTH"]));
  });

  it("does not treat a forbidden NI prefix as an NI number", () => {
    const types = detectPii("Reference QQ 12 34 56 C").map((entity) => entity.type);
    expect(types).not.toContain("NI_NUMBER");
  });

  it("reuses one placeholder for duplicate values", () => {
    const text = "Email john.smith@example.com and again john.smith@example.com.";
    const masked = tokenise(text, detectPii(text));
    expect(masked.masked.match(/<EMAIL_1>/g)).toHaveLength(2);
    expect(masked.placeholders).toHaveLength(1);
  });

  it("numbers distinct entities of the same type", () => {
    const text = "Emails ada@example.com and bea@example.com.";
    const masked = tokenise(text, detectPii(text));
    expect(masked.masked).toContain("<EMAIL_1>");
    expect(masked.masked).toContain("<EMAIL_2>");
  });

  it("keeps an invalid NHS checksum marked and still tokenised", () => {
    const text = "NHS 943 476 5918";
    const detected = detectPii(text);
    expect(detected[0]?.validation?.valid).toBe(false);
    expect(tokenise(text, detected).masked).toContain("<NHS_1>");
  });
});
