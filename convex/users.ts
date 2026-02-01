import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { TIER_LIMITS } from "./lib/roleLimits";
import { throwError } from "./lib/errors";
import type { Tier } from "./lib/roleLimits";

/**
 * Sync or create a user profile from Clerk.
 * This is called after a user logs in on the frontend.
 */
export const store = mutation({
  args: {
    name: v.optional(v.string()),
    email: v.string(),
    image: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throwError("Called storeUser without authentication identity", "UNAUTHENTICATED", 401);
    }

    // Check if the user already exists
    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    const name = (args.name || args.email.split("@")[0] || "Unknown User").trim();

    if (user !== null) {
      // If we've seen this user before but their name or picture has changed, update them.
      if (
        user.name !== name ||
        user.email !== args.email.toLowerCase() ||
        user.image !== args.image
      ) {
        await ctx.db.patch(user._id, {
          name,
          email: args.email.toLowerCase(),
          image: args.image,
        });
      }
      if (user.isDeactivated) {
        throwError("User account is deactivated", "USER_DEACTIVATED", 403, { user_id: user._id });
      }
      return user._id;
    }

    // If it's a new identity, create a new User with default 'user' role.
    return await ctx.db.insert("users", {
      tokenIdentifier: identity.tokenIdentifier,
      name,
      email: args.email.toLowerCase(),
      image: args.image,
      tier: "free",
    });
  },
});

/**
 * Get the current authenticated user's profile.
 */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    return await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
  },
});

/**
 * Set or update the user's master key.
 * The master key hash and salt are stored - never the plaintext.
 */
export const setMasterKey = mutation({
  args: {
    masterKeyHash: v.string(),
    masterKeySalt: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throwError("Unauthenticated", "UNAUTHENTICATED", 401);
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) {
      throwError("User not found", "NOT_FOUND", 404);
    }

    if (user.isDeactivated) {
      throwError("User account is deactivated", "USER_DEACTIVATED", 403, { user_id: user._id });
    }

    await ctx.db.patch(user._id, {
      masterKeyHash: args.masterKeyHash,
      masterKeySalt: args.masterKeySalt,
    });

    return { success: true };
  },
});

/**
 * Get usage stats for the current user to show in the UI against limits, returns project counts and role.
 */
export const getUsageStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) return null;

    if (user.isDeactivated) {
      throwError("User account is deactivated", "USER_DEACTIVATED", 403, { user_id: user._id });
    }

    // Count owned projects
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
      .collect();

    return {
      projectsCount: projects.length,
      tier: user.tier,
    };
  },
});

/**
 * Get plan enforcement status for the current user.
 * Calculates violation details on-demand using quotas table.
 * Convex caches this and auto-invalidates when data changes.
 */
export const getPlanEnforcementStatus = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) return null;

    // Deactivated users should not see plan enforcement UI
    if (user.isDeactivated) return null;

    // If flag not set, return early
    if (!user.exceedsPlanLimits) {
      return { exceedsPlanLimits: false };
    }

    const tier = (user.tier || "free") as Tier;
    const limits = TIER_LIMITS[tier];

    // Count owned projects
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
      .collect();

    // Use quotas table for efficient counting
    let projectsExceedingEnvLimits = 0;
    let projectsExceedingMemberLimits = 0;
    let projectsExceedingSecretLimits = 0;

    for (const project of projects) {
      const quotas = await ctx.db
        .query("quotas")
        .withIndex("by_projectId", (q) => q.eq("projectId", project._id))
        .collect();

      for (const quota of quotas) {
        if (quota.resourceType === "environments" && quota.used > limits.maxEnvironmentsPerProject) {
          projectsExceedingEnvLimits++;
        }
        if (quota.resourceType === "members" && quota.used > limits.maxMembersPerProject) {
          projectsExceedingMemberLimits++;
        }
        if (quota.resourceType === "sharedSecrets" && quota.used > limits.maxSharedSecretsPerProject) {
          projectsExceedingSecretLimits++;
        }
      }
    }

    // Check if still exceeding any limit
    const stillExceeds =
      projects.length > limits.maxProjects ||
      projectsExceedingEnvLimits > 0 ||
      projectsExceedingMemberLimits > 0 ||
      projectsExceedingSecretLimits > 0;

    // If no longer exceeding, the flag should have been cleared by the mutation
    // This handles edge cases where the flag wasn't cleared properly
    if (!stillExceeds) {
      return { exceedsPlanLimits: false };
    }

    return {
      exceedsPlanLimits: true,
      planEnforcementDeadline: user.planEnforcementDeadline,
      daysRemaining: user.planEnforcementDeadline
        ? Math.max(0, Math.ceil((user.planEnforcementDeadline - Date.now()) / (24 * 60 * 60 * 1000)))
        : 0,
      currentUsage: {
        projects: projects.length,
        projectsExceedingEnvLimits,
        projectsExceedingMemberLimits,
        projectsExceedingSecretLimits,
      },
      limits: {
        maxProjects: limits.maxProjects,
        maxEnvironmentsPerProject: limits.maxEnvironmentsPerProject,
        maxMembersPerProject: limits.maxMembersPerProject,
        maxSharedSecretsPerProject: limits.maxSharedSecretsPerProject,
      },
      tierName: tier === "free" ? "Free" : tier === "pro" ? "Pro" : tier === "pro_plus" ? "Pro+" : "Admin",
    };
  },
});

/**
 * Check if user still exceeds plan limits, and clear the flag if they don't.
 * Uses quotas table for efficient counting.
 */
export const checkAndClearExceedsPlanLimits = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throwError("Unauthenticated", "UNAUTHENTICATED", 401);

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) throwError("User not found", "NOT_FOUND", 404);

    // Deactivated users cannot perform this action
    if (user.isDeactivated) {
      throwError("Account is deactivated", "USER_DEACTIVATED", 403, { user_id: user._id });
    }

    // If not exceeding limits, nothing to do
    if (!user.exceedsPlanLimits) {
      return { cleared: false, wasAlreadyClear: true };
    }

    const tier = (user.tier || "free") as Tier;
    const limits = TIER_LIMITS[tier];

    // Count owned projects (only need IDs)
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
      .collect();

    // Check if still exceeding project count limit
    let stillExceeds = projects.length > limits.maxProjects;

    // Use quotas table for efficient checking
    if (!stillExceeds) {
      for (const project of projects) {
        const quotas = await ctx.db
          .query("quotas")
          .withIndex("by_projectId", (q) => q.eq("projectId", project._id))
          .collect();

        for (const quota of quotas) {
          if (quota.resourceType === "environments" && quota.used > limits.maxEnvironmentsPerProject) {
            stillExceeds = true;
            break;
          }
          if (quota.resourceType === "members" && quota.used > limits.maxMembersPerProject) {
            stillExceeds = true;
            break;
          }
          if (quota.resourceType === "sharedSecrets" && quota.used > limits.maxSharedSecretsPerProject) {
            stillExceeds = true;
            break;
          }
        }
        if (stillExceeds) break;
      }
    }

    if (!stillExceeds) {
      // Clear the enforcement flag
      await ctx.db.patch(user._id, {
        exceedsPlanLimits: undefined,
        planEnforcementDeadline: undefined,
      });
      return { cleared: true, wasAlreadyClear: false };
    }

    return { cleared: false, wasAlreadyClear: false, stillExceeds: true };
  },
});
