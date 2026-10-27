import { ZodError } from "zod";

import { DomainError } from "@/server/domain/errors";
import { createId } from "@/server/domain/ids";
import type { ApiErrorBody } from "@/types/api";

export function requestIdFrom(request: Request): string {
  return request.headers.get("x-request-id") ?? createId("req");
}

export function errorResponse(error: unknown, requestId: string): Response {
  if (error instanceof ZodError) {
    return jsonError(
      {
        ok: false,
        code: "INVALID_REQUEST",
        message: "The request body is not valid.",
        requestId,
        providerContacted: false,
        sensitiveDataTransmitted: false,
      },
      400,
    );
  }
  if (error instanceof DomainError) {
    return jsonError(
      {
        ok: false,
        code: error.code,
        message: error.message,
        requestId: error.requestId,
        providerContacted: false,
        sensitiveDataTransmitted: false,
      },
      error.status,
    );
  }
  return jsonError(
    {
      ok: false,
      code: "INTERNAL",
      message: "The gateway could not complete the request.",
      requestId,
      providerContacted: false,
      sensitiveDataTransmitted: false,
    },
    500,
  );
}

export function jsonError(body: ApiErrorBody, status: number): Response {
  return Response.json(body, { status });
}
