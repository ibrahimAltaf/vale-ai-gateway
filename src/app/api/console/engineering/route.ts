import { readFile } from "node:fs/promises";
import path from "node:path";

import { errorResponse, requestIdFrom } from "@/server/api/http";
import { assertDemoConsole } from "@/server/api/guard";
import { getContext } from "@/server/container";
import type { QualityReport } from "@/types/api";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const context = getContext();
    await assertDemoConsole(context, requestId, request);
    const report = await readQualityReport();
    return Response.json({ ok: true, report });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

async function readQualityReport(): Promise<QualityReport> {
  try {
    const file = await readFile(path.join(process.cwd(), "quality", "last-run.json"), "utf8");
    return JSON.parse(file) as QualityReport;
  } catch {
    return {
      recordedAt: "",
      source: "local-verification",
      label: "Not yet recorded. Run npm run verify and refresh this page.",
      commands: [
        { name: "Lint", status: "not-recorded", detail: "npm run lint" },
        { name: "TypeScript", status: "not-recorded", detail: "npm run typecheck" },
        { name: "Unit tests", status: "not-recorded", detail: "npm run test" },
        { name: "Build", status: "not-recorded", detail: "npm run build" },
      ],
    };
  }
}
