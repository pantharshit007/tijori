import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { TIER_LIMITS } from "./lib/roleLimits";
import { throwError } from "./lib/errors";
import type { QueryCtx } from "./_generated/server";

/**
 * Helper to verify that the current user is a super_admin.
 */
async function checkSuperAdmin(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throwError("Unauthenticated", "UNAUTHENTICATED", 401);

  const user = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q: any) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();

  if (!user || user.tier !== "super_admin") {
    throwError("Access denied: Admin privileges required", "FORBIDDEN", 403, {
      user_id: user?._id,
    });
  }

  if (user.isDeactivated) {
    throwError("User account is deactivated", "USER_DEACTIVATED", 403, { user_id: user._id });
  }

  return user;
}

/**
 * Get high-level platform metrics for the admin dashboard.
 *
 * TODO (Performance): For large-scale platforms, consider using denormalized
 * counters (e.g., a `platformMetrics` table with auto-incrementing counts)
 * instead of .collect() which loads entire tables into memory.
 */
export const getPlatformMetrics = query({
  args: { includeExtra: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await checkSuperAdmin(ctx);

    // Fetch users once and reuse for count + role distribution
    const users = await ctx.db.query("users").collect();
    const projects = await ctx.db.query("projects").collect();

    let environmentsCount = 0;
    let variablesCount = 0;
    let sharedSecretsCount = 0;

    if (args.includeExtra) {
      environmentsCount = (await ctx.db.query("environments").collect()).length;
      variablesCount = (await ctx.db.query("variables").collect()).length;
      sharedSecretsCount = (await ctx.db.query("sharedSecrets").collect()).length;
    }

    // Calculate tier distribution from already-fetched users
    const tierDistribution = users.reduce((acc: Record<string, number>, user) => {
      const tier = user.tier || "free";
      acc[tier] = (acc[tier] || 0) + 1;
      return acc;
    }, {});

    return {
      counts: {
        users: users.length,
        projects: projects.length,
        environments: environmentsCount,
        variables: variablesCount,
        sharedSecrets: sharedSecretsCount,
      },
      tierDistribution,
    };
  },
});

/**
 * List all users with pagination.
 */
export const listUsers = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await checkSuperAdmin(ctx);

    return await ctx.db.query("users").order("desc").paginate(args.paginationOpts);
  },
});

/**
 * Update a user's platform role.
 * NOTE: Super-admins cannot be demoted by anyone - this is a hard rule.
 * When downgrading, checks if user exceeds new tier limits and sets enforcement flag.
 */
export const updateUserRole = mutation({
  args: {
    userId: v.id("users"),
    tier: v.union(
      v.literal("free"),
      v.literal("pro"),
      v.literal("pro_plus"),
      v.literal("super_admin")
    ),
  },
  handler: async (ctx, args) => {
    await checkSuperAdmin(ctx);

    // Check if target user is a super_admin
    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) {
      throwError("User not found", "NOT_FOUND", 404);
    }

    // Prevent demotion of any super_admin
    if (targetUser.tier === "super_admin" && args.tier !== "super_admin") {
      throwError("Super-admins cannot be demoted. This is a protected role.", "FORBIDDEN", 403, {
        user_id: targetUser._id,
      });
    }

    const currentTier = targetUser.tier;
    const newTier = args.tier;

    // Check if this is a downgrade
    const tierHierarchy: Record<string, number> = {
      free: 0,
      pro: 1,
      pro_plus: 2,
      super_admin: 3,
    };

    const isDowngrade = tierHierarchy[newTier] < tierHierarchy[currentTier];

    let exceedsPlanLimits = false;
    let planEnforcementDeadline: number | undefined = undefined;

    if (isDowngrade) {
      // Check if user's current usage exceeds the new tier's limits
      const newLimits = TIER_LIMITS[newTier];

      // Count user's owned projects
      const ownedProjects = await ctx.db
        .query("projects")
        .withIndex("by_ownerId", (q: any) => q.eq("ownerId", args.userId))
        .collect();
      const projectCount = ownedProjects.length;

      // Use quotas table for efficient counting
      let hasEnvViolation = false;
      let hasMemberViolation = false;
      let hasSecretViolation = false;

      for (const project of ownedProjects) {
        const quotas = await ctx.db
          .query("quotas")
          .withIndex("by_projectId", (q: any) => q.eq("projectId", project._id))
          .collect();

        for (const quota of quotas) {
          if (
            quota.resourceType === "environments" &&
            quota.used > newLimits.maxEnvironmentsPerProject
          ) {
            hasEnvViolation = true;
          }
          if (quota.resourceType === "members" && quota.used > newLimits.maxMembersPerProject) {
            hasMemberViolation = true;
          }
          if (
            quota.resourceType === "sharedSecrets" &&
            quota.used > newLimits.maxSharedSecretsPerProject
          ) {
            hasSecretViolation = true;
          }
        }
      }

      // Determine if any limit is exceeded
      exceedsPlanLimits =
        projectCount > newLimits.maxProjects ||
        hasEnvViolation ||
        hasMemberViolation ||
        hasSecretViolation;

      if (exceedsPlanLimits) {
        // Set 7-day grace period
        planEnforcementDeadline = Date.now() + 7 * 24 * 60 * 60 * 1000;
      }
    }

    // Update user with new tier and enforcement flags
    await ctx.db.patch(args.userId, {
      tier: args.tier,
      exceedsPlanLimits: exceedsPlanLimits || undefined,
      planEnforcementDeadline: planEnforcementDeadline,
    });

    // Update quota limits for all owned projects to reflect the new tier's limits
    const newLimits = TIER_LIMITS[args.tier];
    const ownedProjects = await ctx.db
      .query("projects")
      .withIndex("by_ownerId", (q: any) => q.eq("ownerId", args.userId))
      .collect();

    for (const project of ownedProjects) {
      // Get all quotas for this project
      const quotas = await ctx.db
        .query("quotas")
        .withIndex("by_projectId", (q: any) => q.eq("projectId", project._id))
        .collect();

      // Update each quota's limit based on new role
      for (const quota of quotas) {
        let newLimit: number;
        switch (quota.resourceType) {
          case "environments":
            newLimit = newLimits.maxEnvironmentsPerProject;
            break;
          case "members":
            newLimit = newLimits.maxMembersPerProject;
            break;
          case "sharedSecrets":
            newLimit = newLimits.maxSharedSecretsPerProject;
            break;
          default:
            continue;
        }
        await ctx.db.patch(quota._id, {
          limit: newLimit === Infinity ? 999999 : newLimit,
        });
      }
    }

    return { exceedsPlanLimits, planEnforcementDeadline };
  },
});

/**
 * Deactivate or reactivate a user.
 * NOTE: Super-admins cannot be deactivated by anyone - this is a hard rule.
 */
export const toggleUserStatus = mutation({
  args: { userId: v.id("users"), isDeactivated: v.boolean() },
  handler: async (ctx, args) => {
    await checkSuperAdmin(ctx);

    // Check if target user is a super_admin
    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) {
      throwError("User not found", "NOT_FOUND", 404);
    }

    // Prevent deactivation of any super_admin
    if (targetUser.tier === "super_admin" && args.isDeactivated) {
      throwError(
        "Super-admins cannot be deactivated. This is a protected role.",
        "FORBIDDEN",
        403,
        { user_id: targetUser._id }
      );
    }

    await ctx.db.patch(args.userId, { isDeactivated: args.isDeactivated });
  },
});
