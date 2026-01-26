/**
 * Platform Role Limits
 *
 * Defines the feature limits for each user role tier.
 * - user: Free tier (default)
 * - pro: Paid tier
 * - pro_plus: Premium paid tier
 * - super_admin: Unlimited access
 */

import type { Id } from "../_generated/dataModel";

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
    maxMembersPerProject: 3,
    maxSharedSecretsPerProject: 5,
    maxVariablesPerEnvironment: 30,
    canCreateIndefiniteShares: false,
  },
  pro: {
    maxProjects: 20,
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

/**
 * Get the limits for a project based on the owner's platform role.
 * This ensures all collaborators operate under the owner's tier limits.
 */
export async function getProjectOwnerLimits(
  ctx: { db: any },
  projectId: Id<"projects">
): Promise<RoleLimits> {
  const project = await ctx.db.get(projectId);
  if (!project) {
    return getRoleLimits("user"); // Fallback to free tier
  }

  const owner = await ctx.db.get(project.ownerId);
  if (!owner) {
    return getRoleLimits("user"); // Fallback to free tier
  }

  return getRoleLimits(owner.platformRole as PlatformRole | undefined);
}
