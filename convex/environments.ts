import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getProjectOwnerLimits } from "./lib/roleLimits";
import type { QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/**
 * Access check helper - returns user id and role.
 */
async function checkProjectAccess(ctx: QueryCtx, projectId: Id<"projects">) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError("Unauthenticated");

  const user = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q: any) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();

  if (!user) throw new ConvexError("User not found");
  if (user.isDeactivated) {
    throw new ConvexError("User account is deactivated");
  }

  const membership = await ctx.db
    .query("projectMembers")
    .withIndex("by_project_user", (q: any) => q.eq("projectId", projectId).eq("userId", user._id))
    .unique();

  if (!membership) throw new ConvexError("Access denied");

  return { userId: user._id, role: membership.role, user };
}

/**
 * List all environments for a specific project.
 */
export const list = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    await checkProjectAccess(ctx, args.projectId);

    return await ctx.db
      .query("environments")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

/**
 * Create a new environment in a project.
 * Only owners and admins can create environments.
 * Uses atomic quota document pattern for concurrent-safe limit enforcement.
 */
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { role } = await checkProjectAccess(ctx, args.projectId);

    if (role !== "owner" && role !== "admin") {
      throw new ConvexError("Access denied: Only owners and admins can create environments");
    }

    // Fetch quota document for environments
    const quota = await ctx.db
      .query("quotas")
      .withIndex("by_project_resource", (q) =>
        q.eq("projectId", args.projectId).eq("resourceType", "environments")
      )
      .unique();

    if (quota) {
      // Use atomic quota pattern
      if (quota.used >= quota.limit) {
        throw new ConvexError(
          `Environment limit reached (${quota.limit}). Project owner needs to upgrade for more.`
        );
      }

      // Create the environment
      const envId = await ctx.db.insert("environments", {
        projectId: args.projectId,
        name: args.name,
        description: args.description,
        updatedAt: Date.now(),
      });

      // Atomically increment used count (concurrent inserts will conflict and serialize)
      await ctx.db.patch(quota._id, { used: quota.used + 1 });

      return envId;
    } else {
      // Fallback to count-based check if quota doc doesn't exist (pre-migration)
      const limits = await getProjectOwnerLimits(ctx, args.projectId);
      const existingEnvs = await ctx.db
        .query("environments")
        .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
        .collect();

      if (existingEnvs.length >= limits.maxEnvironmentsPerProject) {
        throw new ConvexError(
          `Environment limit reached (${limits.maxEnvironmentsPerProject}). Project owner needs to upgrade for more.`
        );
      }

      return await ctx.db.insert("environments", {
        projectId: args.projectId,
        name: args.name,
        description: args.description,
        updatedAt: Date.now(),
      });
    }
  },
});

/**
 * Update an environment.
 * Only owners and admins can update environments.
 */
export const updateEnvironment = mutation({
  args: {
    environmentId: v.id("environments"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const environment = await ctx.db.get(args.environmentId);
    if (!environment) throw new ConvexError("Environment not found");

    const { role } = await checkProjectAccess(ctx, environment.projectId);

    if (role !== "owner" && role !== "admin") {
      throw new ConvexError("Access denied: Only owners and admins can update environments");
    }

    // Build update object
    const updates: Record<string, any> = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;

    await ctx.db.patch(args.environmentId, updates);

    return { success: true };
  },
});

/**
 * Delete an environment and all its variables.
 * Only owners and admins can delete environments.
 * Decrements the quota if using atomic quota pattern.
 */
export const deleteEnvironment = mutation({
  args: {
    environmentId: v.id("environments"),
  },
  handler: async (ctx, args) => {
    const environment = await ctx.db.get(args.environmentId);
    if (!environment) throw new ConvexError("Environment not found");

    const { role } = await checkProjectAccess(ctx, environment.projectId);

    if (role !== "owner" && role !== "admin") {
      throw new ConvexError("Access denied: Only owners and admins can delete environments");
    }

    // Delete all variables in this environment
    const variables = await ctx.db
      .query("variables")
      .withIndex("by_environmentId", (q) => q.eq("environmentId", args.environmentId))
      .collect();
    for (const variable of variables) {
      await ctx.db.delete(variable._id);
    }

    // Delete all shared secrets for this environment
    const sharedSecrets = await ctx.db
      .query("sharedSecrets")
      .filter((q) => q.eq(q.field("environmentId"), args.environmentId))
      .collect();
    const deletedSecretsCount = sharedSecrets.length;
    for (const secret of sharedSecrets) {
      await ctx.db.delete(secret._id);
    }

    // Delete the environment
    await ctx.db.delete(args.environmentId);

    // Decrement quota if using atomic quota pattern
    const quota = await ctx.db
      .query("quotas")
      .withIndex("by_project_resource", (q) =>
        q.eq("projectId", environment.projectId).eq("resourceType", "environments")
      )
      .unique();

    if (quota && quota.used > 0) {
      await ctx.db.patch(quota._id, { used: Math.max(0, quota.used - 1) });
    }

    // Also decrement sharedSecrets quota by the number of secrets deleted
    if (deletedSecretsCount > 0) {
      const secretsQuota = await ctx.db
        .query("quotas")
        .withIndex("by_project_resource", (q) =>
          q.eq("projectId", environment.projectId).eq("resourceType", "sharedSecrets")
        )
        .unique();
      if (secretsQuota) {
        await ctx.db.patch(secretsQuota._id, {
          used: Math.max(0, secretsQuota.used - deletedSecretsCount),
        });
      }
    }

    return { success: true };
  },
});
