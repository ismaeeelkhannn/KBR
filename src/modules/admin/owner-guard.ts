/**
 * Pure policy for assigning the OWNER role.
 *
 * OWNER has every permission. Without this guard, any actor with
 * `users.manage` + `roles.manage` (for example a MANAGER) could create or
 * promote a user to OWNER and take over the system (privilege escalation).
 *
 * Rules:
 * 1. Only an OWNER may create a user with the OWNER role.
 * 2. Only an OWNER may promote a user to the OWNER role.
 * 3. Only an OWNER may modify an account that currently holds the OWNER role
 *    (password, active state, branches, role).
 */
export const OWNER_ROLE_CODE = "OWNER";

export type OwnerGuardDecision =
  | { allowed: true }
  | { allowed: false; reason: string };

export function canAssignRole(
  actorRoleCode: string | null | undefined,
  targetRoleCode: string,
): OwnerGuardDecision {
  if (targetRoleCode === OWNER_ROLE_CODE && actorRoleCode !== OWNER_ROLE_CODE) {
    return { allowed: false, reason: "OWNER role sirf OWNER assign kar sakta hai" };
  }
  return { allowed: true };
}

export function canModifyExistingUser(
  actorRoleCode: string | null | undefined,
  currentRoleCode: string,
): OwnerGuardDecision {
  if (currentRoleCode === OWNER_ROLE_CODE && actorRoleCode !== OWNER_ROLE_CODE) {
    return { allowed: false, reason: "OWNER account sirf OWNER badal sakta hai" };
  }
  return { allowed: true };
}
