import { detectPii } from "@/server/privacy/detector";
import { restorePlaceholders, tokenise } from "@/server/privacy/tokeniser";
import type { MaskedPrompt, Placeholder } from "@/types/domain";

export interface PiiDetector {
  detect(text: string): ReturnType<typeof detectPii>;
}

export class RegexPiiDetector implements PiiDetector {
  detect(text: string) {
    return detectPii(text);
  }
}

export interface PrivacyPipeline {
  protect(text: string): MaskedPrompt;
  restore(text: string, placeholders: Placeholder[]): string;
}

/**
 * Detection, validation and tokenisation stay in front of every provider call.
 * The placeholder map is returned to the caller for the life of one request and is not logged.
 */
export class PrivacyService implements PrivacyPipeline {
  constructor(private readonly detector: PiiDetector) {}

  protect(text: string): MaskedPrompt {
    return tokenise(text, this.detector.detect(text));
  }

  restore(text: string, placeholders: Placeholder[]): string {
    return restorePlaceholders(text, placeholders);
  }
}
