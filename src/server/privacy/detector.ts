import { FIRST_NAMES, LAST_NAMES } from "@/server/privacy/names";
import { validateNhsModulus11 } from "@/server/privacy/nhs";
import type { PiiEntity, PiiType } from "@/types/domain";

const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const NHS = /\b\d{3}[\s-]?\d{3}[\s-]?\d{4}\b/g;
const NI = /\b([A-CEGHJ-PR-TW-Z][A-CEGHJ-NPR-TW-Z])\s?(\d{2})\s?(\d{2})\s?(\d{2})\s?([A-D])\b/gi;
const POSTCODE = /\b(GIR\s?0AA|[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})\b/gi;
const PHONE = /\b(?:\+44\s?(?:\(0\)\s?)?|0)(?:\d[\s()-]?){9,10}\b/g;
const DOB_NUMERIC = /\b(?:0?[1-9]|[12]\d|3[01])[\/.-](?:0?[1-9]|1[0-2])[\/.-](?:19|20)\d{2}\b/g;
const DOB_LONG =
  /\b(?:0?[1-9]|[12]\d|3[01])\s(?:January|February|March|April|May|June|July|August|September|October|November|December)\s(?:19|20)\d{2}\b/gi;
const TITLED_NAME = /\b(?:patient|mr|mrs|ms|miss|dr|prof)\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b/g;
const PAIR_NAME = /\b([A-Z][a-z]+)\s+([A-Z][a-z]+)\b/g;

const BLOCKED_NI_PREFIXES = new Set(["BG", "GB", "KN", "NK", "NT", "TN", "ZZ"]);

interface RawMatch {
  type: PiiType;
  value: string;
  start: number;
  end: number;
  priority: number;
  validation?: PiiEntity["validation"];
}

export function detectPii(text: string): PiiEntity[] {
  const matches: RawMatch[] = [];
  collect(text, EMAIL, "EMAIL", 1, matches);
  collectNhs(text, matches);
  collectNi(text, matches);
  collect(text, POSTCODE, "UK_POSTCODE", 4, matches, (value) => value.toUpperCase().replace(/\s+/, " "));
  collect(text, PHONE, "PHONE", 5, matches);
  collect(text, DOB_NUMERIC, "DATE_OF_BIRTH", 6, matches);
  collect(text, DOB_LONG, "DATE_OF_BIRTH", 6, matches);
  collectNames(text, matches);

  matches.sort((left, right) => left.priority - right.priority || left.start - right.start || right.end - left.end);

  const accepted: PiiEntity[] = [];
  const occupied: Array<{ start: number; end: number }> = [];

  for (const match of matches) {
    const overlaps = occupied.some((span) => match.start < span.end && match.end > span.start);
    if (overlaps) continue;
    occupied.push({ start: match.start, end: match.end });
    accepted.push({
      type: match.type,
      value: match.value,
      start: match.start,
      end: match.end,
      validation: match.validation,
    });
  }

  accepted.sort((left, right) => left.start - right.start);
  return accepted;
}

function collect(
  text: string,
  pattern: RegExp,
  type: PiiType,
  priority: number,
  matches: RawMatch[],
  normalise?: (value: string) => string,
): void {
  pattern.lastIndex = 0;
  for (const match of text.matchAll(pattern)) {
    const raw = match[0];
    const start = match.index ?? 0;
    matches.push({
      type,
      value: normalise ? normalise(raw) : raw,
      start,
      end: start + raw.length,
      priority,
    });
  }
}

function collectNhs(text: string, matches: RawMatch[]): void {
  NHS.lastIndex = 0;
  for (const match of text.matchAll(NHS)) {
    const raw = match[0];
    const start = match.index ?? 0;
    const validation = validateNhsModulus11(raw);
    matches.push({
      type: "NHS_NUMBER",
      value: raw,
      start,
      end: start + raw.length,
      priority: 2,
      validation: {
        method: "Modulus 11",
        valid: validation.valid,
        detail: validation.valid ? "Checksum valid" : validation.reason === "malformed" ? "Malformed" : "Checksum invalid",
      },
    });
  }
}

function collectNi(text: string, matches: RawMatch[]): void {
  NI.lastIndex = 0;
  for (const match of text.matchAll(NI)) {
    const raw = match[0];
    const prefix = `${match[1] ?? ""}`.toUpperCase();
    if (BLOCKED_NI_PREFIXES.has(prefix)) continue;
    const start = match.index ?? 0;
    matches.push({
      type: "NI_NUMBER",
      value: raw.toUpperCase(),
      start,
      end: start + raw.length,
      priority: 3,
      validation: { method: "Format", valid: true, detail: "Recognised UK National Insurance format" },
    });
  }
}

function collectNames(text: string, matches: RawMatch[]): void {
  TITLED_NAME.lastIndex = 0;
  for (const match of text.matchAll(TITLED_NAME)) {
    const name = match[1];
    if (!name) continue;
    const start = (match.index ?? 0) + match[0].lastIndexOf(name);
    pushName(matches, name, start);
  }

  PAIR_NAME.lastIndex = 0;
  for (const match of text.matchAll(PAIR_NAME)) {
    const first = match[1];
    const last = match[2];
    if (!first || !last) continue;
    if (!FIRST_NAMES.has(first.toLowerCase()) || !LAST_NAMES.has(last.toLowerCase())) continue;
    const raw = `${first} ${last}`;
    const start = match.index ?? 0;
    pushName(matches, raw, start);
  }
}

function pushName(matches: RawMatch[], value: string, start: number): void {
  matches.push({
    type: "PERSON",
    value,
    start,
    end: start + value.length,
    priority: 7,
  });
}
