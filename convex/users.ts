import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Sync or create a user profile from Clerk.
 * This is called after a user logs in on the frontend.
 */
export const store = mutation({
  args: {
    name: v.optional(v.string()),
    email: v.string(),
    image: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Called storeUser without authentication identity");
    }

    // Check if the user already exists
    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    const name = (args.name || args.email.split("@")[0] || "Unknown User").trim();

    if (user !== null) {
      // If we've seen this user before but their name or picture has changed, update them.
      // Also ensure platformRole is set if missing (backtracking).
      if (
        user.name !== name ||
        user.email !== args.email.toLowerCase() ||
        user.image !== args.image ||
        !user.platformRole
      ) {
        await ctx.db.patch(user._id, {
          name,
          email: args.email.toLowerCase(),
          image: args.image,
          platformRole: user.platformRole || "user",
        });
      }
      return user._id;
    }

    // If it's a new identity, create a new User with default 'user' role.
    return await ctx.db.insert("users", {
      tokenIdentifier: identity.tokenIdentifier,
      name,
      email: args.email.toLowerCase(),
      image: args.image,
      platformRole: "user",
    });
  },
});

/**
 * Get the current authenticated user's profile.
 */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    return await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
  },
});

/**
 * Set or update the user's master key.
 * The master key hash and salt are stored - never the plaintext.
 */
export const setMasterKey = mutation({
  args: {
    masterKeyHash: v.string(),
    masterKeySalt: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) {
      throw new ConvexError("User not found");
    }

    await ctx.db.patch(user._id, {
      masterKeyHash: args.masterKeyHash,
      masterKeySalt: args.masterKeySalt,
    });

    return { success: true };
  },
});
/**
 * Get usage stats for the current user to show in the UI against limits.
 */
export const getUsageStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) return null;

    // Count owned projects
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
      .collect();

    // Sum environments and members across owned projects
    let totalEnvironments = 0;
    let totalMembers = 0;

    // For better efficiency we can query environments by projectId in a loop or use a join-like approach
    // Since users have few projects, a loop is fine for now on Convex.
    for (const project of projects) {
      const environments = await ctx.db
        .query("environments")
        .withIndex("by_projectId", (q) => q.eq("projectId", project._id))
        .collect();
      totalEnvironments += environments.length;

      const members = await ctx.db
        .query("projectMembers")
        .withIndex("by_projectId", (q) => q.eq("projectId", project._id))
        .collect();
      totalMembers += members.length;
    }

    return {
      projectsCount: projects.length,
      totalEnvironments,
      totalMembers,
      role: user.platformRole,
    };
  },
});
