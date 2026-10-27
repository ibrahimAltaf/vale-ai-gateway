import { errorResponse, requestIdFrom } from "@/server/api/http";
import { assertDemoConsole } from "@/server/api/guard";
import { getContext } from "@/server/container";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const context = getContext();
    await assertDemoConsole(context, requestId, request);
    const summary = await context.savings.summarise();
    return Response.json({ ok: true, currency: "GBP", ...summary });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
