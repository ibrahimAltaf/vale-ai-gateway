import type { ConsoleRole } from "@/types/domain";

export const ACTIVE_CONSOLE_ROLE: ConsoleRole = "admin";

export function canManageOrganisations(role: ConsoleRole): boolean {
  return role === "admin" || role === "org_admin";
}

export function canViewConsole(role: ConsoleRole): boolean {
  return role === "admin" || role === "org_admin" || role === "viewer";
}
