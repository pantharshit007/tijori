/**
 * User Tier Limits
 *
 * Defines the feature limits for each user tier.
 * - free: Free tier (default)
 * - pro: Paid tier
 * - pro_plus: Premium paid tier
 * - super_admin: Unlimited access
 */

import type { Id } from "../_generated/dataModel";
import { 
  Tier, 
  TierLimits, 
  TIER_LIMITS, 
  getTierLimits as getTierLimitsShared,
  canPerformAction as canPerformActionShared
} from "../../src/lib/role-limits";

export type { Tier, TierLimits };
export { TIER_LIMITS };

/**
 * Get the limits for a given tier.
 * Defaults to 'free' if tier is undefined.
 */
export function getTierLimits(tier?: Tier): TierLimits {
  return getTierLimitsShared(tier);
}

/**
 * Check if a user can perform an action based on their current count.
 */
export function canPerformAction(
  tier: Tier | undefined,
  limitKey: keyof TierLimits,
  currentCount: number
): boolean {
  return canPerformActionShared(tier, limitKey, currentCount);
}

/**
 * Get the limits for a project based on the owner's tier.
 * This ensures all collaborators operate under the owner's tier limits.
 */
export async function getProjectOwnerLimits(
  ctx: { db: any },
  projectId: Id<"projects">
): Promise<TierLimits> {
  const project = await ctx.db.get(projectId);
  if (!project) {
    return getTierLimits("free"); // Fallback to free tier
  }

  const owner = await ctx.db.get(project.ownerId);
  if (!owner) {
    return getTierLimits("free"); // Fallback to free tier
  }

  return getTierLimits(owner.tier as Tier | undefined);
}

/**
 * Check if a user still exceeds plan limits after a resource deletion.
 * If no longer exceeding, clears the exceedsPlanLimits flag.
 * Should be called after deleting environments, members, shared secrets, or projects.
 */
export async function checkAndClearPlanEnforcementFlag(
  ctx: { db: any },
  userId: Id<"users">
): Promise<boolean> {
  const user = await ctx.db.get(userId);
  if (!user || !user.exceedsPlanLimits) {
    return false;
  }

  const tier = (user.tier || "free") as Tier;
  const limits = TIER_LIMITS[tier];

  const projects = await ctx.db
    .query("projects")
    .withIndex("by_ownerId", (q: any) => q.eq("ownerId", userId))
    .collect();

  // Check if still exceeding project limit
  if (projects.length > limits.maxProjects) {
    return false; // Still exceeding
  }

  // Check quotas for each project
  for (const project of projects) {
    const quotas = await ctx.db
      .query("quotas")
      .withIndex("by_projectId", (q: any) => q.eq("projectId", project._id))
      .collect();

    for (const quota of quotas) {
      if (quota.resourceType === "environments" && quota.used > limits.maxEnvironmentsPerProject) {
        return false; // Still exceeding
      }
      if (quota.resourceType === "members" && quota.used > limits.maxMembersPerProject) {
        return false; // Still exceeding
      }
      if (
        quota.resourceType === "sharedSecrets" &&
        quota.used > limits.maxSharedSecretsPerProject
      ) {
        return false; // Still exceeding
      }
    }
  }

  // No longer exceeding - clear the flag
  await ctx.db.patch(userId, {
    exceedsPlanLimits: undefined,
    planEnforcementDeadline: undefined,
  });

  return true; // Flag was cleared
}
