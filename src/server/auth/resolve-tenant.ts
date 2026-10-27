import { sha256 } from "@/server/cache/key";
import { InvalidRequestError, TenantNotFoundError } from "@/server/domain/errors";
import type { TenantRepository } from "@/server/repositories/contracts";
import type { Tenant } from "@/types/domain";

export function readBearer(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
}

export async function resolveTenant(
  request: Request,
  tenants: TenantRepository,
  requestId: string,
): Promise<Tenant> {
  const token = readBearer(request);
  if (!token || !/^vk_[a-z0-9_]+$/i.test(token)) {
    throw new InvalidRequestError(requestId, "A valid organisation API key is required.");
  }
  const resolved = await tenants.findByKeyHash(sha256(token));
  if (!resolved) throw new TenantNotFoundError(requestId);
  await tenants.touchKey(resolved.apiKeyId);
  return resolved.tenant;
}
