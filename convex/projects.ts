import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getProjectOwnerLimits, getRoleLimits } from "./lib/roleLimits";
import type { QueryCtx } from "./_generated/server";
import type { PlatformRole } from "./lib/roleLimits";

/**
 * Helper to get the current user ID or throw.
 */
async function getUserId(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("Unauthenticated");
  }
  const user = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q: any) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();
  if (!user) {
    throw new ConvexError("User not found in database");
  }
  if (user.isDeactivated) {
    throw new ConvexError("User account is deactivated");
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
      throw new ConvexError("Unauthenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q: any) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user) {
      throw new ConvexError("User not found");
    }

    if (!user.masterKeyHash) {
      throw new ConvexError("Master key not configured. Please set it in Settings.");
    }

    // Check role-based project limit
    const limits = getRoleLimits(user.platformRole as PlatformRole | undefined);
    const existingProjects = await ctx.db
      .query("projects")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
      .collect();

    if (existingProjects.length >= limits.maxProjects) {
      throw new ConvexError(
        `Project limit reached (${limits.maxProjects}). Upgrade to Pro for more projects.`
      );
    }

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
      .withIndex("by_project_user", (q) => q.eq("projectId", args.projectId).eq("userId", userId))
      .unique();

    if (!membership) {
      throw new ConvexError("Access denied: Not a member of this project");
    }

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new ConvexError("Project not found");
    }

    // Fetch owner's platformRole for frontend limit display
    const owner = await ctx.db.get(project.ownerId);

    return {
      ...project,
      role: membership.role,
      ownerPlatformRole: owner?.platformRole ?? "user",
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
      throw new ConvexError("Unauthenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q: any) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user) {
      throw new ConvexError("User not found");
    }

    if (user.isDeactivated) {
      throw new ConvexError("User account is deactivated");
    }

    const now = Date.now();
    let updatedCount = 0;

    // Phase 1: Validate ownership for ALL projects first
    for (const update of args.updates) {
      const project = await ctx.db.get(update.projectId);
      if (!project || project.ownerId !== user._id) {
        throw new ConvexError(`Access denied: Not the owner of project ${update.projectId}`);
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
      throw new ConvexError("Access denied: Not a member of this project");
    }

    // Get all members
    const members = await ctx.db
      .query("projectMembers")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .collect();

    // Get user details for each member
    const membersWithDetails = await Promise.all(
      members.map(async (member) => {
        const user = await ctx.db.get(member.userId);
        return {
          _id: member._id,
          userId: member.userId,
          role: member.role,
          name: user?.name || "Unknown",
          email: user?.email || "",
          image: user?.image,
        };
      })
    );

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
    if (!identity) throw new ConvexError("Unauthenticated");

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q: any) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!currentUser) throw new ConvexError("User not found");
    if (currentUser.isDeactivated) {
      throw new ConvexError("User account is deactivated");
    }

    // Check if user has permission (owner or admin)
    const membership = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) =>
        q.eq("projectId", args.projectId).eq("userId", currentUser._id)
      )
      .unique();

    if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
      throw new ConvexError("Access denied: Only owners and admins can add members");
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
        throw new ConvexError(
          `Member limit reached (${quota.limit}). Project owner needs to upgrade for more.`
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
        throw new ConvexError(
          `Member limit reached (${limits.maxMembersPerProject}). Project owner needs to upgrade for more.`
        );
      }
    }

    const normalizedEmail = args.email.toLowerCase();
    const targetUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .unique();

    if (!targetUser) {
      throw new ConvexError("User not found with that email address");
    }

    // Check if user is already a member
    const existingMembership = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) =>
        q.eq("projectId", args.projectId).eq("userId", targetUser._id)
      )
      .unique();

    if (existingMembership) {
      throw new ConvexError("User is already a member of this project");
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
      throw new ConvexError("Access denied: Only owners and admins can remove members");
    }

    // Get the target membership
    const targetMembership = await ctx.db.get(args.memberId);

    if (!targetMembership || targetMembership.projectId !== args.projectId) {
      throw new ConvexError("Membership not found");
    }

    // Cannot remove the owner
    if (targetMembership.role === "owner") {
      throw new ConvexError("Cannot remove the project owner");
    }

    // Admins can only remove members, not other admins
    if (myMembership.role === "admin" && targetMembership.role === "admin") {
      throw new ConvexError("Admins cannot remove other admins");
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
      throw new ConvexError("Access denied: Only owners can update member roles");
    }

    // Get the target membership
    const targetMembership = await ctx.db.get(args.memberId);

    if (!targetMembership || targetMembership.projectId !== args.projectId) {
      throw new ConvexError("Membership not found");
    }

    // Cannot change owner's role
    if (targetMembership.role === "owner") {
      throw new ConvexError("Cannot change the owner's role");
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
      throw new ConvexError("You are not a member of this project");
    }

    // Owners cannot leave
    if (membership.role === "owner") {
      throw new ConvexError(
        "Owners cannot leave their own project. Transfer ownership or delete the project instead."
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
      throw new ConvexError("Access denied: Only owners can update project details");
    }

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
      throw new ConvexError("Access denied: Only owners can delete projects");
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

    return { success: true };
  },
});
