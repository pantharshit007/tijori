/**
 * User Tier Limits
 *
 * Defines the feature limits for each user tier.
 * This file is shared between Convex backend and Vite frontend.
 */

export type Tier = "free" | "pro" | "pro_plus" | "super_admin";

export interface TierLimits {
  maxProjects: number;
  maxEnvironmentsPerProject: number;
  maxMembersPerProject: number;
  maxSharedSecretsPerProject: number;
  maxVariablesPerEnvironment: number;
  canCreateIndefiniteShares: boolean;
}

export const TIER_LIMITS: Record<Tier, TierLimits> = {
  free: {
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
 * Get the limits for a given tier.
 * Defaults to 'free' if tier is undefined.
 */
export function getTierLimits(tier?: Tier): TierLimits {
  return TIER_LIMITS[tier ?? "free"];
}

/**
 * Check if a user can perform an action based on their current count.
 */
export function canPerformAction(
  tier: Tier | undefined,
  limitKey: keyof TierLimits,
  currentCount: number
): boolean {
  const limits = getTierLimits(tier);
  const limit = limits[limitKey];

  // Boolean limits (like canCreateIndefiniteShares) should be checked directly
  if (typeof limit === "boolean") {
    return limit;
  }

  return currentCount < limit;
}
