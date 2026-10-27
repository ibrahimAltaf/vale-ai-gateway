import { resolveTenant } from "@/server/auth/resolve-tenant";
import { errorResponse, requestIdFrom } from "@/server/api/http";
import { inspectSchema } from "@/server/api/schemas";
import { getContext } from "@/server/container";
import type { PrivacyInspectBody } from "@/types/api";

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const context = getContext();
    await resolveTenant(request, context.tenants, requestId);
    const body = inspectSchema.parse(await request.json());
    const masked = context.privacy.protect(body.text);
    const response: PrivacyInspectBody = {
      ok: true,
      masked: masked.masked,
      entities: masked.entities,
      nhs: masked.entities
        .filter((entity) => entity.type === "NHS_NUMBER")
        .map((entity) => ({
          value: entity.value,
          checksum: entity.validation?.valid ? "Valid" : "Invalid",
          method: "Modulus 11",
          status: "Protected before provider",
        })),
    };
    return Response.json(response);
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
