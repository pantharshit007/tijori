import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Create a shared secret link.
 * Called after client-side encryption of variables.
 */
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    environmentId: v.id("environments"),
    encryptedPasscode: v.string(),
    passcodeIv: v.string(),
    passcodeAuthTag: v.string(),
    encryptedPayload: v.string(),
    encryptedShareKey: v.string(),
    passcodeSalt: v.string(),
    iv: v.string(),
    authTag: v.string(),
    payloadIv: v.string(),
    payloadAuthTag: v.string(),
    expiresAt: v.optional(v.number()),
    isIndefinite: v.boolean(),
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

    // Verify environment belongs to the project
    const environment = await ctx.db.get(args.environmentId);
    if (!environment || environment.projectId !== args.projectId) {
      throw new Error("Invalid environment for this project");
    }

    // Create the shared secret
    const sharedSecretId = await ctx.db.insert("sharedSecrets", {
      projectId: args.projectId,
      environmentId: args.environmentId,
      createdBy: user._id,
      encryptedPasscode: args.encryptedPasscode,
      passcodeIv: args.passcodeIv,
      passcodeAuthTag: args.passcodeAuthTag,
      encryptedPayload: args.encryptedPayload,
      encryptedShareKey: args.encryptedShareKey,
      passcodeSalt: args.passcodeSalt,
      iv: args.iv,
      authTag: args.authTag,
      payloadIv: args.payloadIv,
      payloadAuthTag: args.payloadAuthTag,
      expiresAt: args.expiresAt,
      isIndefinite: args.isIndefinite,
      isDisabled: false,
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

    // Check if disabled
    if (sharedSecret.isDisabled) {
      return { disabled: true };
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

    await ctx.db.patch(args.id, {
      views: sharedSecret.views + 1,
    });
  },
});

/**
 * List shared secrets created by the current user.
 * For the /shared dashboard.
 */
export const listByUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user) {
      return [];
    }

    // Get all shared secrets created by this user
    const sharedSecrets = await ctx.db
      .query("sharedSecrets")
      .withIndex("by_createdBy", (q) => q.eq("createdBy", user._id))
      .collect();

    // Get project and environment names
    const projectIds = [...new Set(sharedSecrets.map((s) => s.projectId))];
    const environmentIds = [...new Set(sharedSecrets.map((s) => s.environmentId))];

    const projects = await Promise.all(projectIds.map((id) => ctx.db.get(id)));
    const environments = await Promise.all(environmentIds.map((id) => ctx.db.get(id)));

    const projectMap = Object.fromEntries(
      projects.filter(Boolean).map((p) => [p!._id, p!.name])
    );
    const envMap = Object.fromEntries(
      environments.filter(Boolean).map((e) => [e!._id, e!.name])
    );

    return sharedSecrets.map((s) => ({
      _id: s._id,
      _creationTime: s._creationTime,
      projectId: s.projectId,
      projectName: projectMap[s.projectId] || "Unknown",
      environmentName: envMap[s.environmentId] || "Unknown",
      encryptedPasscode: s.encryptedPasscode,
      passcodeIv: s.passcodeIv,
      passcodeAuthTag: s.passcodeAuthTag,
      isIndefinite: s.isIndefinite,
      isDisabled: s.isDisabled,
      expiresAt: s.expiresAt,
      views: s.views,
      isExpired: s.expiresAt ? Date.now() > s.expiresAt : false,
    }));
  },
});

/**
 * List shared secrets for a project.
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

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user) {
      return [];
    }

    const membership = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) =>
        q.eq("projectId", args.projectId).eq("userId", user._id)
      )
      .unique();

    if (!membership) {
      return [];
    }

    const sharedSecrets = await ctx.db
      .query("sharedSecrets")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .collect();

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
      isDisabled: s.isDisabled,
      expiresAt: s.expiresAt,
      views: s.views,
      isExpired: s.expiresAt ? Date.now() > s.expiresAt : false,
    }));
  },
});

/**
 * Toggle disabled state of a shared secret.
 */
export const toggleDisabled = mutation({
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

    // Only the creator can toggle
    if (sharedSecret.createdBy !== user._id) {
      throw new Error("Access denied");
    }

    await ctx.db.patch(args.id, {
      isDisabled: !sharedSecret.isDisabled,
    });
  },
});

/**
 * Update expiry of a shared secret.
 */
export const updateExpiry = mutation({
  args: {
    id: v.id("sharedSecrets"),
    expiresAt: v.optional(v.number()),
    isIndefinite: v.boolean(),
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

    if (sharedSecret.createdBy !== user._id) {
      throw new Error("Access denied");
    }

    await ctx.db.patch(args.id, {
      expiresAt: args.expiresAt,
      isIndefinite: args.isIndefinite,
    });
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

    // Only the creator can delete
    if (sharedSecret.createdBy !== user._id) {
      throw new Error("Access denied");
    }

    await ctx.db.delete(args.id);
  },
});
