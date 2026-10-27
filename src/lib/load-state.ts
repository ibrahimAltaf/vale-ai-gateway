export type LoadState<T> = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: T };

export async function readJson<T extends { ok?: boolean; message?: string }>(
  input: RequestInfo,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(input, init);
  const body = (await response.json()) as T;
  if (!response.ok || body.ok === false) {
    throw new Error(body.message ?? "The request could not be completed.");
  }
  return body;
}
