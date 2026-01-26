import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/**
 * Create a shared secret link.
 * Called after client-side encryption of variables.
 */
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    environmentId: v.id("environments"),
    name: v.optional(v.string()), // Optional label for the share
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
    if (!args.isIndefinite && !args.expiresAt) {
      throw new ConvexError("expiresAt is required for non-indefinite shares");
    }
    const normalizedExpiresAt = args.isIndefinite ? undefined : args.expiresAt;

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) {
      throw new ConvexError("User not found");
    }

    // Verify user has access to the project
    const membership = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) => q.eq("projectId", args.projectId).eq("userId", user._id))
      .unique();

    if (!membership) {
      throw new ConvexError("Access denied");
    }

    if (membership.role !== "owner" && membership.role !== "admin") {
      throw new ConvexError("Access denied - only owners and admins can share variables");
    }

    // Verify environment belongs to the project
    const environment = await ctx.db.get(args.environmentId);
    if (!environment || environment.projectId !== args.projectId) {
      throw new ConvexError("Invalid environment for this project");
    }

    // Create the shared secret
    const sharedSecretId = await ctx.db.insert("sharedSecrets", {
      projectId: args.projectId,
      environmentId: args.environmentId,
      createdBy: user._id,
      name: args.name,
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
      expiresAt: normalizedExpiresAt,
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
      throw new ConvexError("Shared secret not found");
    }

    await ctx.db.patch(args.id, {
      views: sharedSecret.views + 1,
    });
  },
});

/**
 * List shared secrets visible to the current user.
 * Shows shares created by user OR from projects where user is owner.
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
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) {
      return [];
    }

    // Get ALL memberships for the user (to check roles)
    const allMemberships = await ctx.db
      .query("projectMembers")
      .filter((q) => q.eq(q.field("userId"), user._id))
      .collect();

    // Build role map and identify owner projects
    const roleMap = new Map<string, string>();
    const ownerProjectIds: Id<"projects">[] = [];
    for (const m of allMemberships) {
      roleMap.set(m.projectId, m.role);
      if (m.role === "owner") {
        ownerProjectIds.push(m.projectId);
      }
    }

    // **OPTIMIZATION: Parallel queries for user secrets + all owner project secrets**
    const [userSharedSecrets, ...ownerProjectSecrets] = await Promise.all([
      ctx.db
        .query("sharedSecrets")
        .withIndex("by_createdBy", (q) => q.eq("createdBy", user._id))
        .collect(),
      ...ownerProjectIds.map((projectId) =>
        ctx.db
          .query("sharedSecrets")
          .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
          .collect()
      ),
    ]);

    // Deduplicate and combine
    const userSecretIds = new Set(userSharedSecrets.map((s) => s._id));
    const ownerSharedSecrets = ownerProjectSecrets
      .flat()
      .filter((secret) => !userSecretIds.has(secret._id));

    const allSharedSecrets = [...userSharedSecrets, ...ownerSharedSecrets];

    // **OPTIMIZATION: Parallel queries for all related data**
    const projectIds = [...new Set(allSharedSecrets.map((s) => s.projectId))];
    const environmentIds = [...new Set(allSharedSecrets.map((s) => s.environmentId))];
    const creatorIds = [...new Set(allSharedSecrets.map((s) => s.createdBy))];

    const [projects, environments, creators] = await Promise.all([
      Promise.all(projectIds.map((id) => ctx.db.get(id))),
      Promise.all(environmentIds.map((id) => ctx.db.get(id))),
      Promise.all(creatorIds.map((id) => ctx.db.get(id))),
    ]);

    // Build lookup maps
    const projectMap = Object.fromEntries(
      projects.filter(Boolean).map((p) => [p!._id, p!.name])
    );
    const envMap = Object.fromEntries(
      environments.filter(Boolean).map((e) => [e!._id, e!.name])
    );
    const creatorMap = Object.fromEntries(
      creators.filter(Boolean).map((c) => [c!._id, { name: c!.name, image: c!.image }])
    );

    // Map to final response shape
    return allSharedSecrets.map((s) => {
      const userRole = roleMap.get(s.projectId) || null;
      const isOwner = userRole === "owner";
      const isCreator = s.createdBy === user._id;
      const canManage = isOwner || (isCreator && (userRole === "owner" || userRole === "admin"));

      return {
        _id: s._id,
        _creationTime: s._creationTime,
        projectId: s.projectId,
        projectName: projectMap[s.projectId] || "Unknown",
        environmentName: envMap[s.environmentId] || "Unknown",
        name: s.name,
        encryptedPasscode: s.encryptedPasscode,
        passcodeIv: s.passcodeIv,
        passcodeAuthTag: s.passcodeAuthTag,
        isIndefinite: s.isIndefinite,
        isDisabled: s.isDisabled,
        expiresAt: s.expiresAt,
        views: s.views,
        isExpired: s.expiresAt ? Date.now() > s.expiresAt : false,
        creatorName: creatorMap[s.createdBy]?.name,
        creatorImage: creatorMap[s.createdBy]?.image,
        isOwner,
        isCreator,
        canManage,
      };
    });
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
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) {
      return [];
    }

    const membership = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) => q.eq("projectId", args.projectId).eq("userId", user._id))
      .unique();

    if (!membership) {
      return [];
    }

    const sharedSecrets = await ctx.db
      .query("sharedSecrets")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .collect();

    const environmentIds = [...new Set(sharedSecrets.map((s) => s.environmentId))];
    const environments = await Promise.all(environmentIds.map((id) => ctx.db.get(id)));
    const envMap = Object.fromEntries(environments.filter(Boolean).map((e) => [e!._id, e!.name]));

    // Get creator info for each shared secret
    const creatorIds = [...new Set(sharedSecrets.map((s) => s.createdBy))];
    const creators = await Promise.all(creatorIds.map((id) => ctx.db.get(id)));
    const creatorMap = Object.fromEntries(
      creators.filter(Boolean).map((c) => [c!._id, { name: c!.name, image: c!.image }])
    );

    return sharedSecrets.map((s) => ({
      _id: s._id,
      _creationTime: s._creationTime,
      environmentName: envMap[s.environmentId] || "Unknown",
      name: s.name,
      isIndefinite: s.isIndefinite,
      isDisabled: s.isDisabled,
      expiresAt: s.expiresAt,
      views: s.views,
      isExpired: s.expiresAt ? Date.now() > s.expiresAt : false,
      creatorName: creatorMap[s.createdBy]?.name,
      creatorImage: creatorMap[s.createdBy]?.image,
    }));
  },
});

/**
 * Toggle disabled state of a shared secret.
 * Allowed for: project owner, OR creator who is still admin/owner.
 */
export const toggleDisabled = mutation({
  args: {
    id: v.id("sharedSecrets"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) {
      throw new ConvexError("User not found");
    }

    const sharedSecret = await ctx.db.get(args.id);
    if (!sharedSecret) {
      throw new ConvexError("Shared secret not found");
    }

    // Check user's current role in the project
    const membership = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) =>
        q.eq("projectId", sharedSecret.projectId).eq("userId", user._id)
      )
      .unique();

    if (!membership) {
      throw new ConvexError("Access denied - not a project member");
    }

    // Allow if: owner of project, OR creator who is still admin/owner
    const isOwner = membership.role === "owner";
    const isCreatorWithAdminAccess =
      sharedSecret.createdBy === user._id &&
      (membership.role === "owner" || membership.role === "admin");

    if (!isOwner && !isCreatorWithAdminAccess) {
      throw new ConvexError(
        "Access denied - only project owner or the creator (with admin rights) can modify"
      );
    }

    await ctx.db.patch(args.id, {
      isDisabled: !sharedSecret.isDisabled,
    });
  },
});

/**
 * Update expiry of a shared secret.
 * Allowed for: project owner, OR creator who is still admin/owner.
 */
export const updateExpiry = mutation({
  args: {
    id: v.id("sharedSecrets"),
    expiresAt: v.optional(v.number()),
    isIndefinite: v.boolean(),
  },
  handler: async (ctx, args) => {
    if (!args.isIndefinite && !args.expiresAt) {
      throw new ConvexError("expiresAt is required for non-indefinite shares");
    }
    const normalizedExpiresAt = args.isIndefinite ? undefined : args.expiresAt;

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) {
      throw new ConvexError("User not found");
    }

    const sharedSecret = await ctx.db.get(args.id);
    if (!sharedSecret) {
      throw new ConvexError("Shared secret not found");
    }

    // Check user's current role in the project
    const membership = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) =>
        q.eq("projectId", sharedSecret.projectId).eq("userId", user._id)
      )
      .unique();

    if (!membership) {
      throw new ConvexError("Access denied - not a project member");
    }

    // Allow if: owner of project, OR creator who is still admin/owner
    const isOwner = membership.role === "owner";
    const isCreatorWithAdminAccess =
      sharedSecret.createdBy === user._id &&
      (membership.role === "owner" || membership.role === "admin");

    if (!isOwner && !isCreatorWithAdminAccess) {
      throw new ConvexError(
        "Access denied - only project owner or the creator (with admin rights) can modify"
      );
    }

    await ctx.db.patch(args.id, {
      expiresAt: normalizedExpiresAt,
      isIndefinite: args.isIndefinite,
    });
  },
});

/**
 * Delete a shared secret.
 * Allowed for: project owner, OR creator who is still admin/owner.
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
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    const sharedSecret = await ctx.db.get(args.id);
    if (!sharedSecret) {
      throw new Error("Shared secret not found");
    }

    // Check user's current role in the project
    const membership = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) =>
        q.eq("projectId", sharedSecret.projectId).eq("userId", user._id)
      )
      .unique();

    if (!membership) {
      throw new Error("Access denied - not a project member");
    }

    // Allow if: owner of project, OR creator who is still admin/owner
    const isOwner = membership.role === "owner";
    const isCreatorWithAdminAccess =
      sharedSecret.createdBy === user._id &&
      (membership.role === "owner" || membership.role === "admin");

    if (!isOwner && !isCreatorWithAdminAccess) {
      throw new Error(
        "Access denied - only project owner or the creator (with admin rights) can delete"
      );
    }

    await ctx.db.delete(args.id);
  },
});
