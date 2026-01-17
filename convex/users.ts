import { v } from "convex/values";
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
      throw new Error("Called storeUser without authentication identity");
    }

    // Check if the user already exists
    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (user !== null) {
      // If we've seen this user before but their name or picture has changed, update them.
      if (
        user.name !== args.name ||
        user.email !== args.email ||
        user.image !== args.image
      ) {
        await ctx.db.patch(user._id, {
          name: args.name,
          email: args.email,
          image: args.image,
        });
      }
      return user._id;
    }

    // If it's a new identity, create a new User.
    return await ctx.db.insert("users", {
      tokenIdentifier: identity.tokenIdentifier,
      name: args.name,
      email: args.email,
      image: args.image,
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
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
  },
});
