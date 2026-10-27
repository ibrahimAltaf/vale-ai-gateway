export interface StructuredLog {
  requestId: string;
  tenantId?: string;
  event: string;
  provider?: string;
  model?: string;
  latencyMs?: number;
  cacheStatus?: string;
  piiEntityCount?: number;
  code?: string;
  level: "info" | "warn" | "error";
}

export interface Logger {
  write(event: StructuredLog): void;
  readAll(): StructuredLog[];
}

export class MemoryLogger implements Logger {
  private readonly events: StructuredLog[] = [];

  write(event: StructuredLog): void {
    this.events.push(event);
    const line = JSON.stringify(event);
    if (event.level === "error") {
      console.error(line);
    } else {
      console.info(line);
    }
  }

  readAll(): StructuredLog[] {
    return [...this.events];
  }
}
