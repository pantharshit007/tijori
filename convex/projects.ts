import { v } from "convex/values";
import { MAX_LENGTHS } from "../src/lib/constants";
import { mutation, query } from "./_generated/server";
import {
  checkAndClearPlanEnforcementFlag,
  getProjectOwnerLimits,
  getTierLimits,
} from "./lib/roleLimits";
import { throwError, validateLength } from "./lib/errors";
import type { QueryCtx } from "./_generated/server";
import type { Tier } from "./lib/roleLimits";

/**
 * Helper to get the current user ID or throw.
 */
async function getUserId(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throwError("Unauthenticated", "UNAUTHENTICATED", 401);
  const user = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q: any) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();
  if (!user) throwError("User not found in database", "NOT_FOUND", 404);
  if (user.isDeactivated) {
    throwError("User account is deactivated", "USER_DEACTIVATED", 403, { user_id: user._id });
  }
  return user._id;
}

/**
 * Create a new project.
 * This also creates a default "Development" environment.
 * Requires user to have master key set (checked on frontend).
 * Enforces role-based project limits.
 */
export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    passcodeHint: v.optional(v.string()),
    passcodeHash: v.string(),
    encryptedPasscode: v.string(),
    passcodeSalt: v.string(),
    iv: v.string(),
    authTag: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throwError("Unauthenticated", "UNAUTHENTICATED", 401);
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q: any) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user) {
      throwError("User not found", "NOT_FOUND", 404);
    }

    if (user.isDeactivated) {
      throwError("User account is deactivated", "USER_DEACTIVATED", 403, { user_id: user._id });
    }

    if (!user.masterKeyHash) {
      throwError("Master key not configured. Please set it in Settings.", "BAD_REQUEST", 400, {
        user_id: user._id,
      });
    }

    // Check tier-based project limit
    const limits = getTierLimits(user.tier as Tier | undefined);
    const existingProjects = await ctx.db
      .query("projects")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
      .collect();

    if (existingProjects.length >= limits.maxProjects) {
      throwError(
        `Project limit reached (${limits.maxProjects}). Upgrade to Pro for more projects.`,
        "LIMIT_REACHED",
        403,
        { user_id: user._id }
      );
    }

    validateLength(args.name, MAX_LENGTHS.PROJECT_NAME, "Project name");
    validateLength(args.description, MAX_LENGTHS.PROJECT_DESCRIPTION, "Description");
    validateLength(args.passcodeHint, MAX_LENGTHS.PASSCODE_HINT, "Passcode hint");

    const now = Date.now();

    const projectId = await ctx.db.insert("projects", {
      name: args.name,
      description: args.description,
      passcodeHint: args.passcodeHint,
      passcodeHash: args.passcodeHash,
      encryptedPasscode: args.encryptedPasscode,
      passcodeSalt: args.passcodeSalt,
      iv: args.iv,
      authTag: args.authTag,
      ownerId: user._id,
      updatedAt: now,
    });

    await ctx.db.insert("projectMembers", {
      projectId,
      userId: user._id,
      role: "owner",
    });

    // Create default "Development" environment
    await ctx.db.insert("environments", {
      projectId,
      name: "Development",
      description: "Default environment for development",
      updatedAt: now,
      updatedBy: user._id,
    });

    // Create quota documents for atomic limit enforcement
    const quotaTypes = [
      { type: "environments" as const, used: 1, limit: limits.maxEnvironmentsPerProject },
      { type: "members" as const, used: 1, limit: limits.maxMembersPerProject },
      { type: "sharedSecrets" as const, used: 0, limit: limits.maxSharedSecretsPerProject },
    ];

    for (const { type, used, limit } of quotaTypes) {
      await ctx.db.insert("quotas", {
        projectId,
        resourceType: type,
        used,
        limit: limit === Infinity ? 999999 : limit,
      });
    }

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
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();
    if (!user) return [];

    const memberships = await ctx.db
      .query("projectMembers")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    const projects = [];
    for (const membership of memberships) {
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
      .withIndex("by_project_user", (q) => q.eq("projectId", args.projectId).eq("userId", userId))
      .unique();

    if (!membership) {
      throwError("Access denied: Not a member of this project", "FORBIDDEN", 403, {
        user_id: userId,
        project_id: args.projectId,
      });
    }

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throwError("Project not found", "NOT_FOUND", 404, {
        user_id: userId,
        project_id: args.projectId,
      });
    }

    // Fetch owner's tier for frontend limit display
    const owner = await ctx.db.get(project.ownerId);

    return {
      ...project,
      role: membership.role,
      ownerTier: owner?.tier ?? "free",
    };
  },
});

/**
 * Get all projects owned by the current user.
 * Used for Master Key rotation to fetch projects that need passcode re-encryption.
 */
export const listOwned = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q: any) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();
    if (!user) return [];

    // Get only projects where user is the owner
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
      .collect();

    return projects;
  },
});

/**
 * Batch update project passcodes AND master key during Master Key rotation.
 * All encryption is done client-side; this just stores the new encrypted values.
 *
 * This mutation is ATOMIC: both the project passcodes and the master key hash/salt
 * are updated in a single transaction. If any part fails, everything rolls back.
 *
 * IMPORTANT: When passcodeSalt changes, passcodeHash must also be re-computed
 * because the hash uses the salt for verification.
 */
export const batchUpdatePasscodes = mutation({
  args: {
    updates: v.array(
      v.object({
        projectId: v.id("projects"),
        passcodeHash: v.string(),
        encryptedPasscode: v.string(),
        passcodeSalt: v.string(),
        iv: v.string(),
        authTag: v.string(),
      })
    ),
    newMasterKeyHash: v.string(),
    newMasterKeySalt: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throwError("Unauthenticated", "UNAUTHENTICATED", 401);
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q: any) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user) {
      throwError("User not found", "NOT_FOUND", 404);
    }

    if (user.isDeactivated) {
      throwError("User account is deactivated", "USER_DEACTIVATED", 403, { user_id: user._id });
    }

    const now = Date.now();
    let updatedCount = 0;

    // Phase 1: Validate ownership for ALL projects first
    for (const update of args.updates) {
      const project = await ctx.db.get(update.projectId);
      if (!project || project.ownerId !== user._id) {
        throwError(
          `Access denied: Not the owner of project ${update.projectId}`,
          "FORBIDDEN",
          403,
          { user_id: user._id, project_id: update.projectId }
        );
      }
    }

    // Phase 2: Perform project updates once all ownerships are confirmed
    for (const update of args.updates) {
      await ctx.db.patch(update.projectId, {
        passcodeHash: update.passcodeHash,
        encryptedPasscode: update.encryptedPasscode,
        passcodeSalt: update.passcodeSalt,
        iv: update.iv,
        authTag: update.authTag,
        updatedAt: now,
      });

      updatedCount++;
    }

    // Phase 3: Update the master key hash/salt
    await ctx.db.patch(user._id, {
      masterKeyHash: args.newMasterKeyHash,
      masterKeySalt: args.newMasterKeySalt,
    });

    return { success: true, updatedCount };
  },
});

/**
 * List all members of a project.
 * Only project members can view the member list.
 */
export const listMembers = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Check if user is a member of this project
    const membership = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) => q.eq("projectId", args.projectId).eq("userId", userId))
      .unique();

    if (!membership) {
      throwError("Access denied: Not a member of this project", "FORBIDDEN", 403, {
        user_id: userId,
        project_id: args.projectId,
      });
    }

    // Get all members
    const members = await ctx.db
      .query("projectMembers")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .collect();

    // Get user details for each member
    const membersWithDetails = (
      await Promise.all(
        members.map(async (member) => {
          const user = await ctx.db.get(member.userId);
          if (!user) return null;

          return {
            _id: member._id,
            userId: member.userId,
            role: member.role,
            name: user.name,
            email: user.email,
            image: user.image,
            isDeactivated: user.isDeactivated,
          };
        })
      )
    ).filter((m) => m !== null);

    return membersWithDetails;
  },
});

/**
 * Add a member to a project by email.
 * Only owners and admins can add members.
 * Enforces role-based member limits.
 */
export const addMember = mutation({
  args: {
    projectId: v.id("projects"),
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("member")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throwError("Unauthenticated", "UNAUTHENTICATED", 401);

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q: any) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!currentUser) throwError("User not found", "NOT_FOUND", 404);
    if (currentUser.isDeactivated) {
      throwError("User account is deactivated", "USER_DEACTIVATED", 403, {
        user_id: currentUser._id,
      });
    }

    // Check if user has permission (owner or admin)
    const membership = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) =>
        q.eq("projectId", args.projectId).eq("userId", currentUser._id)
      )
      .unique();

    if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
      throwError("Access denied: Only owners and admins can add members", "FORBIDDEN", 403, {
        user_id: currentUser._id,
        project_id: args.projectId,
      });
    }

    // Check member limit using atomic quota pattern
    const quota = await ctx.db
      .query("quotas")
      .withIndex("by_project_resource", (q) =>
        q.eq("projectId", args.projectId).eq("resourceType", "members")
      )
      .unique();

    if (quota) {
      if (quota.used >= quota.limit) {
        throwError(
          `Member limit reached (${quota.limit}). Project owner needs to upgrade for more.`,
          "LIMIT_REACHED",
          403,
          { user_id: currentUser._id, project_id: args.projectId }
        );
      }
    } else {
      // Fallback to count-based check if quota doc doesn't exist (pre-migration)
      const limits = await getProjectOwnerLimits(ctx, args.projectId);
      const existingMembers = await ctx.db
        .query("projectMembers")
        .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
        .collect();

      if (existingMembers.length >= limits.maxMembersPerProject) {
        throwError(
          `Member limit reached (${limits.maxMembersPerProject}). Project owner needs to upgrade for more.`,
          "LIMIT_REACHED",
          403,
          { user_id: currentUser._id, project_id: args.projectId }
        );
      }
    }

    const normalizedEmail = args.email.toLowerCase();
    const targetUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .unique();

    if (!targetUser) {
      throwError("User not found with that email address", "NOT_FOUND", 404, {
        user_id: currentUser._id,
        project_id: args.projectId,
      });
    }

    // Check if user is already a member
    const existingMembership = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) =>
        q.eq("projectId", args.projectId).eq("userId", targetUser._id)
      )
      .unique();

    if (existingMembership) {
      throwError("User is already a member of this project", "CONFLICT", 409, {
        user_id: currentUser._id,
        project_id: args.projectId,
      });
    }

    // Add the member
    await ctx.db.insert("projectMembers", {
      projectId: args.projectId,
      userId: targetUser._id,
      role: args.role,
    });

    // Increment quota if using atomic quota pattern
    if (quota) {
      await ctx.db.patch(quota._id, { used: quota.used + 1 });
    }

    return { success: true };
  },
});

/**
 * Remove a member from a project.
 * Owners can remove anyone. Admins can remove members.
 * No one can remove the owner.
 */
export const removeMember = mutation({
  args: {
    projectId: v.id("projects"),
    memberId: v.id("projectMembers"),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Get the current user's membership
    const myMembership = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) => q.eq("projectId", args.projectId).eq("userId", userId))
      .unique();

    if (!myMembership || (myMembership.role !== "owner" && myMembership.role !== "admin")) {
      throwError("Access denied: Only owners and admins can remove members", "FORBIDDEN", 403, {
        user_id: userId,
        project_id: args.projectId,
      });
    }

    // Get the target membership
    const targetMembership = await ctx.db.get(args.memberId);

    if (!targetMembership || targetMembership.projectId !== args.projectId) {
      throwError("Membership not found", "NOT_FOUND", 404, {
        user_id: userId,
        project_id: args.projectId,
      });
    }

    // Cannot remove the owner
    if (targetMembership.role === "owner") {
      throwError("Cannot remove the project owner", "FORBIDDEN", 403, {
        user_id: userId,
        project_id: args.projectId,
      });
    }

    // Admins can only remove members, not other admins
    if (myMembership.role === "admin" && targetMembership.role === "admin") {
      throwError("Admins cannot remove other admins", "FORBIDDEN", 403, {
        user_id: userId,
        project_id: args.projectId,
      });
    }

    // Remove the membership
    await ctx.db.delete(args.memberId);

    // Decrement quota if using atomic quota pattern
    const quota = await ctx.db
      .query("quotas")
      .withIndex("by_project_resource", (q) =>
        q.eq("projectId", args.projectId).eq("resourceType", "members")
      )
      .unique();

    if (quota && quota.used > 0) {
      await ctx.db.patch(quota._id, { used: quota.used - 1 });
    }

    // Check if project owner still exceeds plan limits after this removal
    const project = await ctx.db.get(args.projectId);
    if (project) {
      await checkAndClearPlanEnforcementFlag(ctx, project.ownerId);
    }

    return { success: true };
  },
});

/**
 * Update a member's role.
 * Only owners can update roles.
 */
export const updateMemberRole = mutation({
  args: {
    projectId: v.id("projects"),
    memberId: v.id("projectMembers"),
    role: v.union(v.literal("admin"), v.literal("member")),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Check if user is the owner
    const myMembership = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) => q.eq("projectId", args.projectId).eq("userId", userId))
      .unique();

    if (!myMembership || myMembership.role !== "owner") {
      throwError("Access denied: Only owners can update member roles", "FORBIDDEN", 403, {
        user_id: userId,
        project_id: args.projectId,
      });
    }

    // Get the target membership
    const targetMembership = await ctx.db.get(args.memberId);

    if (!targetMembership || targetMembership.projectId !== args.projectId) {
      throwError("Membership not found", "NOT_FOUND", 404, {
        user_id: userId,
        project_id: args.projectId,
      });
    }

    // Cannot change owner's role
    if (targetMembership.role === "owner") {
      throwError("Cannot change the owner's role", "FORBIDDEN", 403, {
        user_id: userId,
        project_id: args.projectId,
      });
    }

    // Update the role
    await ctx.db.patch(args.memberId, { role: args.role });

    return { success: true };
  },
});

/**
 * Leave a project.
 * Members and admins can leave. Owners cannot leave their own project.
 */
export const leaveProject = mutation({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Get the user's membership
    const membership = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) => q.eq("projectId", args.projectId).eq("userId", userId))
      .unique();

    if (!membership) {
      throwError("You are not a member of this project", "FORBIDDEN", 403, {
        user_id: userId,
        project_id: args.projectId,
      });
    }

    // Owners cannot leave
    if (membership.role === "owner") {
      throwError(
        "Owners cannot leave their own project. Transfer ownership or delete the project instead.",
        "FORBIDDEN",
        403,
        { user_id: userId, project_id: args.projectId }
      );
    }

    // Remove the membership
    await ctx.db.delete(membership._id);

    // Decrement quota if using atomic quota pattern
    const quota = await ctx.db
      .query("quotas")
      .withIndex("by_project_resource", (q) =>
        q.eq("projectId", args.projectId).eq("resourceType", "members")
      )
      .unique();

    if (quota && quota.used > 0) {
      await ctx.db.patch(quota._id, { used: quota.used - 1 });
    }

    // Check if project owner still exceeds plan limits after this member left
    const project = await ctx.db.get(args.projectId);
    if (project) {
      await checkAndClearPlanEnforcementFlag(ctx, project.ownerId);
    }

    return { success: true };
  },
});

/**
 * Update project details.
 * Only owners can update project details.
 */
export const updateProject = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    passcodeHint: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Check if user is the owner
    const membership = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) => q.eq("projectId", args.projectId).eq("userId", userId))
      .unique();

    if (!membership || membership.role !== "owner") {
      throwError("Access denied: Only owners can update project details", "FORBIDDEN", 403, {
        user_id: userId,
        project_id: args.projectId,
      });
    }

    validateLength(args.name, MAX_LENGTHS.PROJECT_NAME, "Project name");
    validateLength(args.description, MAX_LENGTHS.PROJECT_DESCRIPTION, "Description");
    validateLength(args.passcodeHint, MAX_LENGTHS.PASSCODE_HINT, "Passcode hint");

    // Build update object
    const updates: Record<string, any> = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.passcodeHint !== undefined) updates.passcodeHint = args.passcodeHint;

    await ctx.db.patch(args.projectId, updates);

    return { success: true };
  },
});

/**
 * Delete a project and all its data.
 * Only owners can delete. Requires backend verification (future: verify master key hash).
 */
export const deleteProject = mutation({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Check if user is the owner
    const membership = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) => q.eq("projectId", args.projectId).eq("userId", userId))
      .unique();

    if (!membership || membership.role !== "owner") {
      throwError("Access denied: Only owners can delete projects", "FORBIDDEN", 403, {
        user_id: userId,
        project_id: args.projectId,
      });
    }

    // Delete all shared secrets
    const sharedSecrets = await ctx.db
      .query("sharedSecrets")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .collect();
    for (const secret of sharedSecrets) {
      await ctx.db.delete(secret._id);
    }

    // Delete all environments and their variables
    const environments = await ctx.db
      .query("environments")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .collect();
    for (const env of environments) {
      const variables = await ctx.db
        .query("variables")
        .withIndex("by_environmentId", (q) => q.eq("environmentId", env._id))
        .collect();
      for (const variable of variables) {
        await ctx.db.delete(variable._id);
      }
      await ctx.db.delete(env._id);
    }

    // Delete all project members
    const members = await ctx.db
      .query("projectMembers")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .collect();
    for (const member of members) {
      await ctx.db.delete(member._id);
    }

    // Delete all quota documents
    const quotas = await ctx.db
      .query("quotas")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .collect();
    for (const quota of quotas) {
      await ctx.db.delete(quota._id);
    }

    // Delete the project
    await ctx.db.delete(args.projectId);

    // Check if user still exceeds plan limits after this deletion
    await checkAndClearPlanEnforcementFlag(ctx, userId);

    return { success: true };
  },
});
