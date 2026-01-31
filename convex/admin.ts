import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { ROLE_LIMITS } from "./lib/roleLimits";

/**
 * Helper to verify that the current user is a super_admin.
 */
async function checkSuperAdmin(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError("Unauthenticated");

  const user = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q: any) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();

  if (!user || user.platformRole !== "super_admin") {
    throw new ConvexError("Access denied: Admin privileges required");
  }

  if (user.isDeactivated) {
    throw new ConvexError("User account is deactivated");
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

    // Calculate role distribution from already-fetched users
    const roleDistribution = users.reduce((acc: Record<string, number>, user) => {
      const role = user.platformRole || "user";
      acc[role] = (acc[role] || 0) + 1;
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
      roleDistribution,
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
    role: v.union(
      v.literal("user"),
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
      throw new ConvexError("User not found");
    }

    // Prevent demotion of any super_admin
    if (targetUser.platformRole === "super_admin" && args.role !== "super_admin") {
      throw new ConvexError("Super-admins cannot be demoted. This is a protected role.");
    }

    const currentRole = targetUser.platformRole;
    const newRole = args.role;

    // Check if this is a downgrade
    const roleHierarchy: Record<string, number> = {
      user: 0,
      pro: 1,
      pro_plus: 2,
      super_admin: 3,
    };

    const isDowngrade = roleHierarchy[newRole] < roleHierarchy[currentRole];

    let exceedsPlanLimits = false;
    let planEnforcementDeadline: number | undefined = undefined;

    if (isDowngrade) {
      // Check if user's current usage exceeds the new tier's limits
      const newLimits = ROLE_LIMITS[newRole];

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
          if (quota.resourceType === "environments" && quota.used > newLimits.maxEnvironmentsPerProject) {
            hasEnvViolation = true;
          }
          if (quota.resourceType === "members" && quota.used > newLimits.maxMembersPerProject) {
            hasMemberViolation = true;
          }
          if (quota.resourceType === "sharedSecrets" && quota.used > newLimits.maxSharedSecretsPerProject) {
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

    // Update user with new role and enforcement flags
    await ctx.db.patch(args.userId, {
      platformRole: args.role,
      exceedsPlanLimits: exceedsPlanLimits || undefined,
      planEnforcementDeadline: planEnforcementDeadline,
    });

    // Update quota limits for all owned projects to reflect the new tier's limits
    const newLimits = ROLE_LIMITS[args.role];
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
      throw new ConvexError("User not found");
    }

    // Prevent deactivation of any super_admin
    if (targetUser.platformRole === "super_admin" && args.isDeactivated) {
      throw new ConvexError("Super-admins cannot be deactivated. This is a protected role.");
    }

    await ctx.db.patch(args.userId, { isDeactivated: args.isDeactivated });
  },
});
