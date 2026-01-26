import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getRoleLimits } from "./lib/roleLimits";
import type { PlatformRole } from "./lib/roleLimits";
import type { Id } from "./_generated/dataModel";

/**
 * Access check helper - returns user id and role.
 */
async function checkProjectAccess(ctx: any, projectId: Id<"projects">) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError("Unauthenticated");

  const user = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q: any) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();

  if (!user) throw new ConvexError("User not found");

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
 * Enforces role-based environment limits.
 */
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { role, user } = await checkProjectAccess(ctx, args.projectId);

    if (role !== "owner" && role !== "admin") {
      throw new ConvexError("Access denied: Only owners and admins can create environments");
    }

    // Check role-based environment limit
    const limits = getRoleLimits(user.platformRole as PlatformRole | undefined);
    const existingEnvs = await ctx.db
      .query("environments")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .collect();

    if (existingEnvs.length >= limits.maxEnvironmentsPerProject) {
      throw new ConvexError(
        `Environment limit reached (${limits.maxEnvironmentsPerProject}). Upgrade to Pro for more.`
      );
    }

    return await ctx.db.insert("environments", {
      projectId: args.projectId,
      name: args.name,
      description: args.description,
      updatedAt: Date.now(),
    });
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
    for (const secret of sharedSecrets) {
      await ctx.db.delete(secret._id);
    }

    // Delete the environment
    await ctx.db.delete(args.environmentId);

    return { success: true };
  },
});
