import type { CacheService } from "@/server/cache/cache-service";
import { PrivacyService } from "@/server/privacy/privacy-service";
import type { CacheLabBody } from "@/types/api";

const PATIENTS = [
  {
    label: "Patient A",
    organisation: "Northstar Health UK",
    tenantId: "ten_northstar",
    nhs: "943 476 5919",
    prompt: "Summarise the record for 943 476 5919",
  },
  {
    label: "Patient B",
    organisation: "Northstar Health UK",
    tenantId: "ten_northstar",
    nhs: "401 023 2137",
    prompt: "Summarise the record for 401 023 2137",
  },
] as const;

export function runCacheLab(privacy: PrivacyService, cache: CacheService): CacheLabBody {
  const patients = PATIENTS.map((patient) => {
    const masked = privacy.protect(patient.prompt);
    const key = cache.buildKey({
      tenantId: patient.tenantId,
      provider: "openai",
      model: "gpt-4o-mini",
      maskedPrompt: masked.masked,
      sensitiveValues: masked.placeholders.map((item) => `${item.type}:${item.value}`),
      temperature: 0.2,
      maxTokens: 400,
      batchEligible: false,
    });
    return {
      label: patient.label,
      organisation: patient.organisation,
      nhs: patient.nhs,
      prompt: patient.prompt,
      masked: masked.masked,
      cacheDisplay: key.display,
      privacyContextLabel: key.privacyContextLabel,
      includes: [
        "tenant namespace",
        "model and provider",
        "normalised masked prompt hash",
        "privacy-context HMAC",
        "request configuration hash",
        "cache schema version",
      ],
    };
  });

  return {
    ok: true,
    maskedTextIdentical: patients[0]?.masked === patients[1]?.masked,
    cacheKeysDifferent: patients[0]?.cacheDisplay !== patients[1]?.cacheDisplay,
    leakage: "blocked",
    patients,
  };
}
