import { errorResponse, requestIdFrom } from "@/server/api/http";
import { assertDemoConsole } from "@/server/api/guard";
import { getContext } from "@/server/container";
import { runCacheLab } from "@/server/services/cache-lab";

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const context = getContext();
    await assertDemoConsole(context, requestId, request);
    return Response.json(runCacheLab(context.privacy, context.cache));
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
