import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/**
 * Access check helper.
 */
async function checkEnvironmentAccess(ctx: any, environmentId: Id<"environments">) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError("Unauthenticated");

  const user = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q: any) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();

  if (!user) throw new ConvexError("User not found");

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
 * Since variable names are unique per environment in Tijori.
 */
export const save = mutation({
  args: {
    environmentId: v.id("environments"),
    name: v.string(),
    encryptedValue: v.string(),
    iv: v.string(),
    authTag: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, membership } = await checkEnvironmentAccess(ctx, args.environmentId);

    if (membership.role !== "owner" && membership.role !== "admin") {
      throw new ConvexError("Forbidden: Only owners and admins can modify variables");
    }

    const now = Date.now();

    const existing = await ctx.db
      .query("variables")
      .withIndex("by_environmentId", (q) => q.eq("environmentId", args.environmentId))
      .filter((q) => q.eq(q.field("name"), args.name))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        encryptedValue: args.encryptedValue,
        iv: args.iv,
        authTag: args.authTag,
        updatedAt: now,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("variables", {
        environmentId: args.environmentId,
        name: args.name,
        encryptedValue: args.encryptedValue,
        iv: args.iv,
        authTag: args.authTag,
        createdBy: userId,
        updatedAt: now,
      });
    }
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
