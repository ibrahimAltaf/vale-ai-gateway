export interface NhsValidation {
  valid: boolean;
  reason: "valid" | "malformed" | "checksum_invalid";
  normalised: string | null;
}

export function digitsOnly(value: string): string {
  return value.replace(/[\s-]/g, "");
}

/**
 * NHS numbers use modulus 11 over the first nine digits, weighted 10 down to 2.
 * A check result of 11 becomes 0. A check result of 10 is not a valid NHS number.
 */
export function validateNhsModulus11(input: string): NhsValidation {
  const digits = digitsOnly(input);
  if (!/^\d{10}$/.test(digits)) {
    return { valid: false, reason: "malformed", normalised: null };
  }

  let sum = 0;
  for (let index = 0; index < 9; index += 1) {
    sum += Number(digits[index]) * (10 - index);
  }

  const remainder = sum % 11;
  const check = 11 - remainder;
  if (check === 10) {
    return { valid: false, reason: "checksum_invalid", normalised: digits };
  }

  const expected = check === 11 ? 0 : check;
  const actual = Number(digits[9]);
  return {
    valid: actual === expected,
    reason: actual === expected ? "valid" : "checksum_invalid",
    normalised: digits,
  };
}

export function formatNhs(digits: string): string {
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}
