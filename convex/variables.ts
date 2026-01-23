import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/**
 * Access check helper.
 */
async function checkEnvironmentAccess(ctx: any, environmentId: Id<"environments">) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");

  const user = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q: any) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();

  if (!user) throw new Error("User not found");

  const environment = await ctx.db.get(environmentId);
  if (!environment) throw new Error("Environment not found");

  const membership = await ctx.db
    .query("projectMembers")
    .withIndex("by_project_user", (q: any) =>
      q.eq("projectId", environment.projectId).eq("userId", user._id)
    )
    .unique();

  if (!membership) throw new Error("Access denied");

  return { userId: user._id, membership };
}

/**
 * List all variables for a specific environment.
 */
export const list = query({
  args: { environmentId: v.id("environments") },
  handler: async (ctx, args) => {
    await checkEnvironmentAccess(ctx, args.environmentId);

    return await ctx.db
      .query("variables")
      .withIndex("by_environmentId", (q) => q.eq("environmentId", args.environmentId))
      .collect();
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
    const { membership } = await checkEnvironmentAccess(ctx, args.environmentId);

    if (membership.role !== "owner" && membership.role !== "admin") {
      throw new Error("Forbidden: Only owners and admins can modify variables");
    }

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
      });
      return existing._id;
    } else {
      return await ctx.db.insert("variables", {
        environmentId: args.environmentId,
        name: args.name,
        encryptedValue: args.encryptedValue,
        iv: args.iv,
        authTag: args.authTag,
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
    if (!variable) throw new Error("Variable not found");

    const { membership } = await checkEnvironmentAccess(ctx, variable.environmentId);

    // Enforce role-based access: only owner and admin can delete variables
    if (membership.role !== "owner" && membership.role !== "admin") {
      throw new Error("Forbidden: Only owners and admins can delete variables");
    }

    await ctx.db.delete(args.id);
  },
});
