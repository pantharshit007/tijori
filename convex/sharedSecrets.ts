import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { MAX_LENGTHS, SHARE_MAX_VIEWS_LIMIT } from "../src/lib/constants";
import { mutation, query } from "./_generated/server";
import { checkAndClearPlanEnforcementFlag, getProjectOwnerLimits } from "./lib/roleLimits";
import { throwError, validateLength } from "./lib/errors";
import type { QueryCtx } from "./_generated/server";
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
    maxViews: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!args.isIndefinite && !args.expiresAt) {
      throwError("expiresAt is required for non-indefinite shares", "BAD_REQUEST", 400);
    }
    const normalizedExpiresAt = args.isIndefinite ? undefined : args.expiresAt;

    validateLength(args.name, MAX_LENGTHS.SECRET_NAME, "Secret name");

    if (args.maxViews !== undefined) {
      if (!Number.isInteger(args.maxViews) || args.maxViews < 1) {
        throwError("maxViews must be a positive integer", "BAD_REQUEST", 400);
      }
      if (args.maxViews > SHARE_MAX_VIEWS_LIMIT) {
        throwError(`maxViews cannot exceed ${SHARE_MAX_VIEWS_LIMIT}`, "BAD_REQUEST", 400);
      }
    }

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throwError("Not authenticated", "UNAUTHENTICATED", 401);
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) {
      throwError("User not found", "NOT_FOUND", 404);
    }

    if (user.isDeactivated) {
      throwError("User account is deactivated", "USER_DEACTIVATED", 403, { user_id: user._id });
    }

    // Verify user has access to the project
    const membership = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) => q.eq("projectId", args.projectId).eq("userId", user._id))
      .unique();

    if (!membership) {
      throwError("Access denied", "FORBIDDEN", 403, {
        user_id: user._id,
        project_id: args.projectId,
      });
    }

    if (membership.role !== "owner" && membership.role !== "admin") {
      throwError("Access denied - only owners and admins can share variables", "FORBIDDEN", 403, {
        user_id: user._id,
        project_id: args.projectId,
      });
    }

    // Verify environment belongs to the project
    const environment = await ctx.db.get(args.environmentId);
    if (!environment || environment.projectId !== args.projectId) {
      throwError("Invalid environment for this project", "BAD_REQUEST", 400, {
        user_id: user._id,
        project_id: args.projectId,
        environment_id: args.environmentId,
      });
    }

    // Check shared secrets limit based on PROJECT OWNER's role
    const limits = await getProjectOwnerLimits(ctx, args.projectId);

    // Check shared secrets limit using atomic quota pattern
    const quota = await ctx.db
      .query("quotas")
      .withIndex("by_project_resource", (q) =>
        q.eq("projectId", args.projectId).eq("resourceType", "sharedSecrets")
      )
      .unique();

    if (quota) {
      if (quota.used >= quota.limit) {
        throwError(
          `Shared secrets limit reached (${quota.limit}). Project owner needs to upgrade for more.`,
          "LIMIT_REACHED",
          403,
          { user_id: user._id, project_id: args.projectId }
        );
      }
    } else {
      // Fallback to count-based check if quota doc doesn't exist (pre-migration)
      const existingShares = await ctx.db
        .query("sharedSecrets")
        .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
        .collect();

      if (existingShares.length >= limits.maxSharedSecretsPerProject) {
        throwError(
          `Shared secrets limit reached (${limits.maxSharedSecretsPerProject}). Project owner needs to upgrade for more.`,
          "LIMIT_REACHED",
          403,
          { user_id: user._id, project_id: args.projectId }
        );
      }
    }

    if (args.isIndefinite && !limits.canCreateIndefiniteShares) {
      throwError(
        "Indefinite shares are only available on Pro plans. Project owner needs to upgrade.",
        "LIMIT_REACHED",
        403,
        { user_id: user._id, project_id: args.projectId }
      );
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
      maxViews: args.maxViews,
    });

    // Increment quota if using atomic quota pattern
    if (quota) {
      await ctx.db.patch(quota._id, { used: quota.used + 1 });
    }

    return sharedSecretId;
  },
});

/**
 * Access check helper for managing a shared secret.
 * Returns the shared secret if access is granted.
 */
async function checkSecretManagementAccess(ctx: QueryCtx, secretId: Id<"sharedSecrets">) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throwError("Not authenticated", "UNAUTHENTICATED", 401);

  const user = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q: any) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();

  if (!user) throwError("User not found", "NOT_FOUND", 404);
  if (user.isDeactivated) {
    throwError("User account is deactivated", "USER_DEACTIVATED", 403, { user_id: user._id });
  }

  const sharedSecret = await ctx.db.get(secretId);
  if (!sharedSecret) throwError("Shared secret not found", "NOT_FOUND", 404);

  const membership = await ctx.db
    .query("projectMembers")
    .withIndex("by_project_user", (q: any) =>
      q.eq("projectId", sharedSecret.projectId).eq("userId", user._id)
    )
    .unique();

  if (!membership) {
    throwError("Access denied - not a project member", "FORBIDDEN", 403, {
      user_id: user._id,
      project_id: sharedSecret.projectId,
    });
  }

  const isOwner = membership.role === "owner";
  const isCreatorWithAdminAccess =
    sharedSecret.createdBy === user._id &&
    (membership.role === "owner" || membership.role === "admin");

  if (!isOwner && !isCreatorWithAdminAccess) {
    throwError(
      "Access denied - only project owner or the creator (with admin rights) can modify/delete",
      "FORBIDDEN",
      403,
      { user_id: user._id, project_id: sharedSecret.projectId }
    );
  }

  return { user, sharedSecret, membership };
}

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

    if (sharedSecret.maxViews !== undefined && sharedSecret.views >= sharedSecret.maxViews) {
      return {
        exhausted: true,
        maxViews: sharedSecret.maxViews,
        expiresAt: sharedSecret.expiresAt,
      };
    }

    // Return only metadata (payload is fetched via mutation to atomically consume a view)
    return {
      isIndefinite: sharedSecret.isIndefinite,
      expiresAt: sharedSecret.expiresAt,
      maxViews: sharedSecret.maxViews,
      views: sharedSecret.views,
    };
  },
});

/**
 * Access a shared secret and atomically record a view.
 * Public mutation that checks limits before returning encrypted payload.
 */
export const accessSecret = mutation({
  args: {
    id: v.id("sharedSecrets"),
  },
  handler: async (ctx, args) => {
    const sharedSecret = await ctx.db.get(args.id);

    if (!sharedSecret) {
      throwError("Shared secret not found", "NOT_FOUND", 404);
    }

    if (sharedSecret.isDisabled) {
      return { disabled: true };
    }

    if (sharedSecret.expiresAt && Date.now() > sharedSecret.expiresAt) {
      return { expired: true };
    }

    if (sharedSecret.maxViews !== undefined && sharedSecret.views >= sharedSecret.maxViews) {
      return { exhausted: true, expiresAt: sharedSecret.expiresAt };
    }

    await ctx.db.patch(args.id, {
      views: sharedSecret.views + 1,
    });

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
      maxViews: sharedSecret.maxViews,
    };
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

    if (user.isDeactivated) {
      throwError("User account is deactivated", "USER_DEACTIVATED", 403, { user_id: user._id });
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
    const projectMap = Object.fromEntries(projects.filter(Boolean).map((p) => [p!._id, p!.name]));
    const envMap = Object.fromEntries(environments.filter(Boolean).map((e) => [e!._id, e!.name]));
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
        maxViews: s.maxViews,
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

    if (user.isDeactivated) {
      throwError("User account is deactivated", "USER_DEACTIVATED", 403, { user_id: user._id });
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
      maxViews: s.maxViews,
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
    const { sharedSecret } = await checkSecretManagementAccess(ctx, args.id);

    await ctx.db.patch(args.id, {
      isDisabled: !sharedSecret.isDisabled,
    });
  },
});

/**
 * Bulk toggle disabled state.
 */
export const bulkToggleDisabled = mutation({
  args: {
    ids: v.array(v.id("sharedSecrets")),
    isDisabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    for (const id of args.ids) {
      // Re-checks permissions for each item
      await checkSecretManagementAccess(ctx, id);
      await ctx.db.patch(id, { isDisabled: args.isDisabled });
    }
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
      throwError("expiresAt is required for non-indefinite shares", "BAD_REQUEST", 400);
    }
    const normalizedExpiresAt = args.isIndefinite ? undefined : args.expiresAt;

    const { sharedSecret, user } = await checkSecretManagementAccess(ctx, args.id);

    // Check shared secrets limit based on PROJECT OWNER's role
    const limits = await getProjectOwnerLimits(ctx, sharedSecret.projectId);
    if (args.isIndefinite && !limits.canCreateIndefiniteShares) {
      throwError(
        "Indefinite shares are only available on Pro plans. Project owner needs to upgrade.",
        "LIMIT_REACHED",
        403,
        { user_id: user._id, project_id: sharedSecret.projectId }
      );
    }

    await ctx.db.patch(args.id, {
      expiresAt: normalizedExpiresAt,
      isIndefinite: args.isIndefinite,
    });
  },
});

/**
 * Update view limit for a shared secret.
 * Pass maxViews = -1 to remove limit.
 */
export const updateMaxViews = mutation({
  args: {
    id: v.id("sharedSecrets"),
    maxViews: v.number(),
  },
  handler: async (ctx, args) => {
    const { sharedSecret } = await checkSecretManagementAccess(ctx, args.id);

    if (args.maxViews === -1) {
      await ctx.db.patch(args.id, {
        maxViews: undefined,
      });
      return { success: true };
    }

    if (!Number.isInteger(args.maxViews) || args.maxViews < 1) {
      throwError("maxViews must be a positive integer", "BAD_REQUEST", 400);
    }
    if (args.maxViews > SHARE_MAX_VIEWS_LIMIT) {
      throwError(`maxViews cannot exceed ${SHARE_MAX_VIEWS_LIMIT}`, "BAD_REQUEST", 400);
    }
    if (args.maxViews < sharedSecret.views) {
      throwError("maxViews cannot be lower than current views", "BAD_REQUEST", 400);
    }

    await ctx.db.patch(args.id, {
      maxViews: args.maxViews,
    });

    return { success: true };
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
    const { sharedSecret } = await checkSecretManagementAccess(ctx, args.id);

    await ctx.db.delete(args.id);

    // Decrement quota if using atomic quota pattern
    const quota = await ctx.db
      .query("quotas")
      .withIndex("by_project_resource", (q) =>
        q.eq("projectId", sharedSecret.projectId).eq("resourceType", "sharedSecrets")
      )
      .unique();

    if (quota && quota.used > 0) {
      await ctx.db.patch(quota._id, { used: quota.used - 1 });
    }

    // Check if project owner still exceeds plan limits after this deletion
    const project = await ctx.db.get(sharedSecret.projectId);
    if (project && "ownerId" in project) {
      await checkAndClearPlanEnforcementFlag(ctx, project.ownerId);
    }
  },
});

/**
 * Bulk remove shared secrets.
 */
export const bulkRemove = mutation({
  args: {
    ids: v.array(v.id("sharedSecrets")),
  },
  handler: async (ctx, args) => {
    for (const id of args.ids) {
      const { sharedSecret } = await checkSecretManagementAccess(ctx, id);

      await ctx.db.delete(id);

      // Decrement quota
      const quota = await ctx.db
        .query("quotas")
        .withIndex("by_project_resource", (q) =>
          q.eq("projectId", sharedSecret.projectId).eq("resourceType", "sharedSecrets")
        )
        .unique();

      if (quota && quota.used > 0) {
        await ctx.db.patch(quota._id, { used: quota.used - 1 });
      }

      // Re-evaluate limits for project owner
      const project = await ctx.db.get(sharedSecret.projectId);
      if (project && "ownerId" in project) {
        await checkAndClearPlanEnforcementFlag(ctx, project.ownerId);
      }
    }
  },
});

/**
 * Paginated version of listByUser.
 * Since this combines results from multiple queries (owned projects + created secrets),
 * we fetch everything and slice it manually to provide a paginated interface.
 */
export const paginatedListByUser = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { page: [], isDone: true, continueCursor: "" };
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user || user.isDeactivated) {
      return { page: [], isDone: true, continueCursor: "" };
    }

    // Get ALL memberships to identify projects the user has access to
    const allMemberships = await ctx.db
      .query("projectMembers")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    const roleMap = new Map<string, string>();
    const ownerProjectIds: Id<"projects">[] = [];
    for (const m of allMemberships) {
      roleMap.set(m.projectId, m.role);
      if (m.role === "owner") {
        ownerProjectIds.push(m.projectId);
      }
    }

    // Fetch secrets: created by user OR in owned projects
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

    const allSharedSecrets = [...userSharedSecrets, ...ownerSharedSecrets].sort(
      (a, b) => b._creationTime - a._creationTime
    );

    // Manual pagination using array slicing since we combined multiple queries
    const { numItems, cursor } = args.paginationOpts;
    const parsed = cursor ? parseInt(cursor, 10) : 0;
    const startIndex =
      Number.isFinite(parsed) && Number.isInteger(parsed) ? Math.max(0, parsed) : 0;
    const endIndex = startIndex + numItems;
    const pageItems = allSharedSecrets.slice(startIndex, endIndex);
    const isDone = endIndex >= allSharedSecrets.length;
    const continueCursor = isDone ? "" : endIndex.toString();

    // Fetch related data for the current page only (optimization)
    const projectIds = [...new Set(pageItems.map((s) => s.projectId))];
    const environmentIds = [...new Set(pageItems.map((s) => s.environmentId))];
    const creatorIds = [...new Set(pageItems.map((s) => s.createdBy))];

    const [projects, environments, creators] = await Promise.all([
      Promise.all(projectIds.map((id) => ctx.db.get(id))),
      Promise.all(environmentIds.map((id) => ctx.db.get(id))),
      Promise.all(creatorIds.map((id) => ctx.db.get(id))),
    ]);

    const projectMap = Object.fromEntries(projects.filter(Boolean).map((p) => [p!._id, p!.name]));
    const envMap = Object.fromEntries(environments.filter(Boolean).map((e) => [e!._id, e!.name]));
    const creatorMap = Object.fromEntries(
      creators.filter(Boolean).map((c) => [c!._id, { name: c!.name, image: c!.image }])
    );

    const page = pageItems.map((s) => {
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
        maxViews: s.maxViews,
        isExpired: s.expiresAt ? Date.now() > s.expiresAt : false,
        creatorName: creatorMap[s.createdBy]?.name,
        creatorImage: creatorMap[s.createdBy]?.image,
        isOwner,
        isCreator,
        canManage,
      };
    });

    return {
      page,
      isDone,
      continueCursor,
    };
  },
});
