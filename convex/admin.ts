import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";

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
 */
export const getPlatformMetrics = query({
  args: { includeExtra: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await checkSuperAdmin(ctx);

    const usersCount = (await ctx.db.query("users").collect()).length;
    const projectsCount = (await ctx.db.query("projects").collect()).length;

    let environmentsCount = 0;
    let variablesCount = 0;
    let sharedSecretsCount = 0;

    if (args.includeExtra) {
      environmentsCount = (await ctx.db.query("environments").collect()).length;
      variablesCount = (await ctx.db.query("variables").collect()).length;
      sharedSecretsCount = (await ctx.db.query("sharedSecrets").collect()).length;
    }

    // Get role distribution
    const users = await ctx.db.query("users").collect();
    const roleDistribution = users.reduce((acc: Record<string, number>, user) => {
      const role = user.platformRole || "user";
      acc[role] = (acc[role] || 0) + 1;
      return acc;
    }, {});

    return {
      counts: {
        users: usersCount,
        projects: projectsCount,
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
    await ctx.db.patch(args.userId, { platformRole: args.role });
  },
});

/**
 * Deactivate or reactivate a user.
 */
export const toggleUserStatus = mutation({
  args: { userId: v.id("users"), isDeactivated: v.boolean() },
  handler: async (ctx, args) => {
    await checkSuperAdmin(ctx);
    await ctx.db.patch(args.userId, { isDeactivated: args.isDeactivated });
  },
});
