/**
 * Platform Role Limits
 *
 * Defines the feature limits for each user role tier.
 * - user: Free tier (default)
 * - pro: Paid tier
 * - pro_plus: Premium paid tier
 * - super_admin: Unlimited access
 */

export type PlatformRole = "user" | "pro" | "pro_plus" | "super_admin";

export interface RoleLimits {
  maxProjects: number;
  maxEnvironmentsPerProject: number;
  maxMembersPerProject: number;
  maxSharedSecretsPerProject: number;
  maxVariablesPerEnvironment: number;
  canCreateIndefiniteShares: boolean;
}

export const ROLE_LIMITS: Record<PlatformRole, RoleLimits> = {
  user: {
    maxProjects: 3,
    maxEnvironmentsPerProject: 2,
    maxMembersPerProject: 2,
    maxSharedSecretsPerProject: 5,
    maxVariablesPerEnvironment: 20,
    canCreateIndefiniteShares: false,
  },
  pro: {
    maxProjects: 10,
    maxEnvironmentsPerProject: 5,
    maxMembersPerProject: 5,
    maxSharedSecretsPerProject: 25,
    maxVariablesPerEnvironment: 100,
    canCreateIndefiniteShares: true,
  },
  pro_plus: {
    maxProjects: 50,
    maxEnvironmentsPerProject: 10,
    maxMembersPerProject: 20,
    maxSharedSecretsPerProject: 100,
    maxVariablesPerEnvironment: 500,
    canCreateIndefiniteShares: true,
  },
  super_admin: {
    maxProjects: Infinity,
    maxEnvironmentsPerProject: Infinity,
    maxMembersPerProject: Infinity,
    maxSharedSecretsPerProject: Infinity,
    maxVariablesPerEnvironment: Infinity,
    canCreateIndefiniteShares: true,
  },
};

/**
 * Get the limits for a given role.
 * Defaults to 'user' if role is undefined.
 */
export function getRoleLimits(role?: PlatformRole): RoleLimits {
  return ROLE_LIMITS[role ?? "user"];
}

/**
 * Check if a user can perform an action based on their current count.
 */
export function canPerformAction(
  role: PlatformRole | undefined,
  limitKey: keyof RoleLimits,
  currentCount: number
): boolean {
  const limits = getRoleLimits(role);
  const limit = limits[limitKey];

  // Boolean limits (like canCreateIndefiniteShares) should be checked directly
  if (typeof limit === "boolean") {
    return limit;
  }

  return currentCount < limit;
}
