import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Create a shared secret link.
 * Called after client-side encryption of variables.
 */
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    environmentId: v.id("environments"),
    encryptedPayload: v.string(), // Variables encrypted with ShareKey
    encryptedShareKey: v.string(), // ShareKey encrypted with Passcode
    passcodeSalt: v.string(), // Salt for passcode-based key derivation
    iv: v.string(), // IV for ShareKey encryption
    authTag: v.string(), // AuthTag for ShareKey encryption
    payloadIv: v.string(), // IV for payload encryption
    payloadAuthTag: v.string(), // AuthTag for payload encryption
    expiresAt: v.optional(v.number()), // Unix timestamp
    isIndefinite: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Find user
    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    // Verify user has access to the project
    const membership = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) =>
        q.eq("projectId", args.projectId).eq("userId", user._id)
      )
      .unique();

    if (!membership) {
      throw new Error("Access denied");
    }

    // Create the shared secret
    const sharedSecretId = await ctx.db.insert("sharedSecrets", {
      projectId: args.projectId,
      environmentId: args.environmentId,
      createdBy: user._id,
      encryptedPayload: args.encryptedPayload,
      encryptedShareKey: args.encryptedShareKey,
      passcodeSalt: args.passcodeSalt,
      iv: args.iv,
      authTag: args.authTag,
      payloadIv: args.payloadIv,
      payloadAuthTag: args.payloadAuthTag,
      expiresAt: args.expiresAt,
      isIndefinite: args.isIndefinite,
      views: 0,
    });

    return sharedSecretId;
  },
});

/**
 * Get a shared secret by ID.
 * This is a PUBLIC query - no authentication required.
 * Returns only the encrypted data, never plaintext.
 */
export const get = query({
  args: {
    id: v.id("sharedSecrets"),
  },
  handler: async (ctx, args) => {
    const sharedSecret = await ctx.db.get(args.id);

    if (!sharedSecret) {
      return null;
    }

    // Check if expired
    if (sharedSecret.expiresAt && Date.now() > sharedSecret.expiresAt) {
      return { expired: true };
    }

    // Return only what's needed for decryption
    return {
      encryptedPayload: sharedSecret.encryptedPayload,
      encryptedShareKey: sharedSecret.encryptedShareKey,
      passcodeSalt: sharedSecret.passcodeSalt,
      iv: sharedSecret.iv,
      authTag: sharedSecret.authTag,
      payloadIv: sharedSecret.payloadIv,
      payloadAuthTag: sharedSecret.payloadAuthTag,
      isIndefinite: sharedSecret.isIndefinite,
      expiresAt: sharedSecret.expiresAt,
      views: sharedSecret.views,
    };
  },
});

/**
 * Record a view of the shared secret.
 * Called after successful decryption.
 */
export const recordView = mutation({
  args: {
    id: v.id("sharedSecrets"),
  },
  handler: async (ctx, args) => {
    const sharedSecret = await ctx.db.get(args.id);

    if (!sharedSecret) {
      throw new Error("Shared secret not found");
    }

    // Increment view count
    await ctx.db.patch(args.id, {
      views: sharedSecret.views + 1,
    });
  },
});

/**
 * List shared secrets for a project.
 * Requires authentication and project access.
 */
export const listByProject = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    // Find user
    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user) {
      return [];
    }

    // Verify access
    const membership = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) =>
        q.eq("projectId", args.projectId).eq("userId", user._id)
      )
      .unique();

    if (!membership) {
      return [];
    }

    // Get all shared secrets for this project
    const sharedSecrets = await ctx.db
      .query("sharedSecrets")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .collect();

    // Get environment names
    const environmentIds = [...new Set(sharedSecrets.map((s) => s.environmentId))];
    const environments = await Promise.all(
      environmentIds.map((id) => ctx.db.get(id))
    );
    const envMap = Object.fromEntries(
      environments.filter(Boolean).map((e) => [e!._id, e!.name])
    );

    return sharedSecrets.map((s) => ({
      _id: s._id,
      _creationTime: s._creationTime,
      environmentName: envMap[s.environmentId] || "Unknown",
      isIndefinite: s.isIndefinite,
      expiresAt: s.expiresAt,
      views: s.views,
      isExpired: s.expiresAt ? Date.now() > s.expiresAt : false,
    }));
  },
});

/**
 * Delete a shared secret.
 */
export const remove = mutation({
  args: {
    id: v.id("sharedSecrets"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    const sharedSecret = await ctx.db.get(args.id);
    if (!sharedSecret) {
      throw new Error("Shared secret not found");
    }

    // Verify user has access to the project
    const membership = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) =>
        q.eq("projectId", sharedSecret.projectId).eq("userId", user._id)
      )
      .unique();

    if (!membership) {
      throw new Error("Access denied");
    }

    await ctx.db.delete(args.id);
  },
});
