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
    .withIndex("by_tokenIdentifier", (q: any) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();
  if (!user) {
    throw new Error("User not found in database");
  }
  return user._id;
}

/**
 * Create a new project.
 * This also creates a default "Development" environment.
 * Requires user to have master key set (checked on frontend).
 */
export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    passcodeHash: v.string(),
    encryptedPasscode: v.string(),
    passcodeSalt: v.string(),
    iv: v.string(),
    authTag: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q: any) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    if (!user.masterKeyHash) {
      throw new Error("Master key not configured. Please set it in Settings.");
    }

    const now = Date.now();

    const projectId = await ctx.db.insert("projects", {
      name: args.name,
      description: args.description,
      passcodeHash: args.passcodeHash,
      encryptedPasscode: args.encryptedPasscode,
      passcodeSalt: args.passcodeSalt,
      iv: args.iv,
      authTag: args.authTag,
      ownerId: user._id,
      updatedAt: now,
    });

    // Add the creator as the owner in projectMembers
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
 * Batch update project passcodes during Master Key rotation.
 * All encryption is done client-side; this just stores the new encrypted values.
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
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q: any) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    const now = Date.now();
    let updatedCount = 0;

    for (const update of args.updates) {
      // Verify the user owns this project
      const project = await ctx.db.get(update.projectId);
      if (!project || project.ownerId !== user._id) {
        throw new Error(`Access denied: Not the owner of project ${update.projectId}`);
      }

      // Update the project with new encrypted passcode AND new passcodeHash
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

    return { success: true, updatedCount };
  },
});
