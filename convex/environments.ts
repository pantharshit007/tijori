import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/**
 * Access check helper.
 */
async function checkProjectAccess(ctx: any, projectId: Id<"projects">) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");

  const user = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q: any) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique();

  if (!user) throw new Error("User not found");

  const membership = await ctx.db
    .query("projectMembers")
    .withIndex("by_project_user", (q: any) =>
      q.eq("projectId", projectId).eq("userId", user._id),
    )
    .unique();

  if (!membership) throw new Error("Access denied");

  return user._id;
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
 */
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await checkProjectAccess(ctx, args.projectId);

    return await ctx.db.insert("environments", {
      projectId: args.projectId,
      name: args.name,
      description: args.description,
      updatedAt: Date.now(),
    });
  },
});

