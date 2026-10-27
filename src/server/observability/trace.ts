import type { RequestTrace, TraceStage } from "@/types/domain";

export class TraceClock {
  private readonly started = performance.now();
  private readonly stages: TraceStage[] = [];

  mark(id: string, name: string, detail: string): void {
    this.stages.push({
      id,
      name,
      detail,
      offsetMs: Math.round(performance.now() - this.started),
    });
  }

  finish(requestId: string, providerLatencyMs: number): RequestTrace {
    const totalMs = Math.max(this.stages.at(-1)?.offsetMs ?? 0, Math.round(performance.now() - this.started));
    return {
      requestId,
      totalMs,
      providerLatencyMs,
      gatewayOverheadMs: Math.max(0, totalMs - providerLatencyMs),
      stages: this.stages,
    };
  }
}
