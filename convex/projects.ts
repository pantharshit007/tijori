import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Helper to get the current user ID or throw.
 */
async function getUserId(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthenticated");
  }
  const user = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q: any) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique();
  if (!user) {
    throw new Error("User not found in database");
  }
  return user._id;
}

/**
 * Create a new project.
 * This also creates a default "Development" environment.
 */
export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    encryptedPasscode: v.string(),
    masterKeyHash: v.string(),
    passcodeSalt: v.string(),
    iv: v.string(),
    authTag: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    const projectId = await ctx.db.insert("projects", {
      name: args.name,
      description: args.description,
      encryptedPasscode: args.encryptedPasscode,
      masterKeyHash: args.masterKeyHash,
      passcodeSalt: args.passcodeSalt,
      iv: args.iv,
      authTag: args.authTag,
      ownerId: userId,
    });

    // Add the creator as the owner in projectMembers
    await ctx.db.insert("projectMembers", {
      projectId,
      userId,
      role: "owner",
    });

    // Create default "Development" environment
    await ctx.db.insert("environments", {
      projectId,
      name: "Development",
      description: "Default environment for development",
    });

    return projectId;
  },
});

/**
 * List all projects the current user is a member of.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q: any) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!user) return [];

    const memberships = await ctx.db
      .query("projectMembers")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    const projects = [];
    for (const membership of memberships) {
      // ? TODO: do convex not allow us to get data from a specific table instead of quering the entire tables in db with an ID?
      const project = await ctx.db.get(membership.projectId);
      if (project) {
        projects.push({
          ...project,
          role: membership.role,
        });
      }
    }

    return projects;
  },
});

/**
 * Get project details by ID with access check.
 */
export const get = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    const membership = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) =>
        q.eq("projectId", args.projectId).eq("userId", userId),
      )
      .unique();

    if (!membership) {
      throw new Error("Access denied: Not a member of this project");
    }

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    return {
      ...project,
      role: membership.role,
    };
  },
});
