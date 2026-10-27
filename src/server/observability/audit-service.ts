import { createId } from "@/server/domain/ids";
import type { Logger } from "@/server/observability/logger";
import type { AuditRepository } from "@/server/repositories/contracts";
import type { AuditEvent } from "@/types/domain";

type AuditInput = Omit<AuditEvent, "id" | "createdAt">;

export class AuditService {
  constructor(
    private readonly repository: AuditRepository,
    private readonly logger: Logger,
  ) {}

  async record(input: AuditInput): Promise<void> {
    const event: AuditEvent = {
      ...input,
      id: createId("aud"),
      createdAt: new Date().toISOString(),
    };
    await this.repository.insert(event);
    this.logger.write({
      level: input.event.endsWith("blocked") || input.event.endsWith("failed") ? "warn" : "info",
      requestId: input.requestId,
      tenantId: input.tenantId,
      event: input.event,
      provider: input.provider,
      model: input.model,
      latencyMs: input.latencyMs,
      cacheStatus: input.cacheStatus,
      piiEntityCount: input.piiEntityCount,
    });
  }
}
