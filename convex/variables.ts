import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getProjectOwnerLimits } from "./lib/roleLimits";
import type { QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/**
 * Access check helper.
 */
async function checkEnvironmentAccess(ctx: QueryCtx, environmentId: Id<"environments">) {
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

  const environment = await ctx.db.get(environmentId);
  if (!environment) throw new ConvexError("Environment not found");

  const membership = await ctx.db
    .query("projectMembers")
    .withIndex("by_project_user", (q: any) =>
      q.eq("projectId", environment.projectId).eq("userId", user._id)
    )
    .unique();

  if (!membership) throw new ConvexError("Access denied");

  return { userId: user._id, membership };
}

/**
 * List all variables for a specific environment.
 * Includes creator info for avatar display.
 */
export const list = query({
  args: { environmentId: v.id("environments") },
  handler: async (ctx, args) => {
    await checkEnvironmentAccess(ctx, args.environmentId);

    const variables = await ctx.db
      .query("variables")
      .withIndex("by_environmentId", (q) => q.eq("environmentId", args.environmentId))
      .collect();

    // Join user data for each variable
    const variablesWithCreator = await Promise.all(
      variables.map(async (variable) => {
        const creator = await ctx.db.get(variable.createdBy);
        return {
          ...variable,
          creatorName: creator?.name,
          creatorImage: creator?.image,
        };
      })
    );

    return variablesWithCreator;
  },
});

/**
 * Create or update a variable.
 * Uses ID for optimized updates.
 * Uses index-based name check for inserts.
 * Bypasses quota check on updates to fix rename-at-limit issue.
 */
export const save = mutation({
  args: {
    environmentId: v.id("environments"),
    name: v.string(),
    encryptedValue: v.string(),
    iv: v.string(),
    authTag: v.string(),
    variableId: v.optional(v.id("variables")),
  },
  handler: async (ctx, args) => {
    const { userId, membership } = await checkEnvironmentAccess(ctx, args.environmentId);

    if (membership.role !== "owner" && membership.role !== "admin") {
      throw new ConvexError("Forbidden: Only owners and admins can modify variables");
    }

    const now = Date.now();

    // If variableId is provided, we are UPDATING an existing variable.
    if (args.variableId) {
      const existing = await ctx.db.get(args.variableId);
      if (!existing) {
        throw new ConvexError("Variable not found");
      }
      if (existing.environmentId !== args.environmentId) {
        throw new ConvexError("Variable does not belong to this environment");
      }

      // Check for name collisions if name is changing
      if (existing.name !== args.name) {
        const collision = await ctx.db
          .query("variables")
          .withIndex("by_environmentId", (q) => q.eq("environmentId", args.environmentId))
          .filter((q) => q.eq(q.field("name"), args.name))
          .unique();
        if (collision) {
          throw new ConvexError(`A variable named "${args.name}" already exists`);
        }
      }

      await ctx.db.patch(args.variableId, {
        name: args.name,
        encryptedValue: args.encryptedValue,
        iv: args.iv,
        authTag: args.authTag,
        updatedAt: now,
      });
      return args.variableId;
    }

    // Otherwise, we are INSERTING a new variable.
    // 1. Check for name uniqueness using environmentId index + filter
    const existingByName = await ctx.db
      .query("variables")
      .withIndex("by_environmentId", (q) => q.eq("environmentId", args.environmentId))
      .filter((q) => q.eq(q.field("name"), args.name))
      .unique();

    if (existingByName) {
      // Upsert behavior: update if name matches (legacy support/UX)
      await ctx.db.patch(existingByName._id, {
        encryptedValue: args.encryptedValue,
        iv: args.iv,
        authTag: args.authTag,
        updatedAt: now,
      });
      return existingByName._id;
    }

    // 2. Check variable limit based on PROJECT OWNER's role
    const env = await ctx.db.get(args.environmentId);
    if (!env) throw new ConvexError("Environment not found");

    const limits = await getProjectOwnerLimits(ctx, env.projectId);

    const existingVars = await ctx.db
      .query("variables")
      .withIndex("by_environmentId", (q) => q.eq("environmentId", args.environmentId))
      .collect();

    if (existingVars.length >= limits.maxVariablesPerEnvironment) {
      throw new ConvexError(
        `Variable limit reached (${limits.maxVariablesPerEnvironment}). Project owner needs to upgrade for more.`
      );
    }

    return await ctx.db.insert("variables", {
      environmentId: args.environmentId,
      name: args.name,
      encryptedValue: args.encryptedValue,
      iv: args.iv,
      authTag: args.authTag,
      createdBy: userId,
      updatedAt: now,
    });
  },
});

/**
 * Delete a variable.
 */
export const remove = mutation({
  args: { id: v.id("variables") },
  handler: async (ctx, args) => {
    const variable = await ctx.db.get(args.id);
    if (!variable) throw new ConvexError("Variable not found");

    const { membership } = await checkEnvironmentAccess(ctx, variable.environmentId);

    // Enforce role-based access: only owner and admin can delete variables
    if (membership.role !== "owner" && membership.role !== "admin") {
      throw new ConvexError("Forbidden: Only owners and admins can delete variables");
    }

    await ctx.db.delete(args.id);
  },
});
