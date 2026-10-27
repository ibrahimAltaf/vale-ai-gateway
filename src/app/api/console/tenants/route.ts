import { errorResponse, requestIdFrom } from "@/server/api/http";
import { assertDemoConsole } from "@/server/api/guard";
import { getContext } from "@/server/container";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const context = getContext();
    await assertDemoConsole(context, requestId, request);
    return Response.json({ ok: true, tenants: await context.savings.tenantSummaries() });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
