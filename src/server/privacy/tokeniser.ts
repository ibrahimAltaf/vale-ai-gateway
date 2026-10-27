import type { MaskedPrompt, PiiEntity, PiiType, Placeholder } from "@/types/domain";

const TOKEN_PREFIX: Record<PiiType, string> = {
  NHS_NUMBER: "NHS",
  NI_NUMBER: "NI",
  UK_POSTCODE: "UK_POSTCODE",
  EMAIL: "EMAIL",
  PHONE: "PHONE",
  PERSON: "PERSON",
  DATE_OF_BIRTH: "DOB",
};

export function tokenise(text: string, entities: PiiEntity[]): MaskedPrompt {
  const counters = new Map<PiiType, number>();
  const valueToToken = new Map<string, string>();
  const placeholders: Placeholder[] = [];
  const tagged: MaskedPrompt["entities"] = [];

  const ordered = [...entities].sort((left, right) => left.start - right.start);
  let cursor = 0;
  let masked = "";

  for (const entity of ordered) {
    const identity = `${entity.type}:${normaliseValue(entity.type, entity.value)}`;
    let token = valueToToken.get(identity);
    if (!token) {
      const next = (counters.get(entity.type) ?? 0) + 1;
      counters.set(entity.type, next);
      token = `<${TOKEN_PREFIX[entity.type]}_${next}>`;
      valueToToken.set(identity, token);
      placeholders.push({ token, type: entity.type, value: entity.value });
    }
    masked += text.slice(cursor, entity.start);
    masked += token;
    cursor = entity.end;
    tagged.push({ ...entity, token });
  }

  masked += text.slice(cursor);

  return {
    original: text,
    masked,
    entities: tagged,
    placeholders,
  };
}

export function restorePlaceholders(text: string, placeholders: Placeholder[]): string {
  const ordered = [...placeholders].sort((left, right) => right.token.length - left.token.length);
  let restored = text;
  for (const placeholder of ordered) {
    restored = restored.replaceAll(placeholder.token, placeholder.value);
  }
  return restored;
}

function normaliseValue(type: PiiType, value: string): string {
  if (type === "EMAIL") return value.toLowerCase();
  if (type === "NHS_NUMBER" || type === "PHONE") return value.replace(/[\s-]/g, "");
  if (type === "UK_POSTCODE" || type === "NI_NUMBER") return value.toUpperCase().replace(/\s+/g, "");
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}
