import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getProjectOwnerLimits } from "./lib/roleLimits";
import { throwError, validateLength } from "./lib/errors";
import type { QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/**
 * Access check helper.
 */
async function checkEnvironmentAccess(ctx: QueryCtx, environmentId: Id<"environments">) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throwError("Unauthenticated", "UNAUTHENTICATED", 401);

  const user = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q: any) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();

  if (!user) throwError("User not found", "NOT_FOUND", 404);
  if (user.isDeactivated) {
    throwError("User account is deactivated", "USER_DEACTIVATED", 403, {
      user_id: user._id,
      environment_id: environmentId,
    });
  }

  const environment = await ctx.db.get(environmentId);
  if (!environment)
    throwError("Environment not found", "NOT_FOUND", 404, {
      user_id: user._id,
      environment_id: environmentId,
    });

  const membership = await ctx.db
    .query("projectMembers")
    .withIndex("by_project_user", (q: any) =>
      q.eq("projectId", environment.projectId).eq("userId", user._id)
    )
    .unique();

  if (!membership)
    throwError("Access denied", "FORBIDDEN", 403, {
      user_id: user._id,
      project_id: environment.projectId,
      environment_id: environmentId,
    });

  return { userId: user._id, membership };
}

/**
 * List all variables for a specific environment.
 * Includes creator info for avatar display.
 */
export const list = query({
  args: { environmentId: v.id("environments") },
  handler: async (ctx, args) => {
    await checkEnvironmentAccess(ctx, args.environmentId);

    const variables = await ctx.db
      .query("variables")
      .withIndex("by_environmentId", (q) => q.eq("environmentId", args.environmentId))
      .collect();

    // Join user data for each variable
    const variablesWithCreator = await Promise.all(
      variables.map(async (variable) => {
        const creator = await ctx.db.get(variable.createdBy);
        return {
          ...variable,
          creatorName: creator?.name,
          creatorImage: creator?.image,
        };
      })
    );

    return variablesWithCreator;
  },
});

/**
 * Create or update a variable.
 * Uses ID for optimized updates.
 * Uses index-based name check for inserts.
 * Bypasses quota check on updates to fix rename-at-limit issue.
 */
export const save = mutation({
  args: {
    environmentId: v.id("environments"),
    name: v.string(),
    encryptedValue: v.string(),
    iv: v.string(),
    authTag: v.string(),
    variableId: v.optional(v.id("variables")),
  },
  handler: async (ctx, args) => {
    const { userId, membership } = await checkEnvironmentAccess(ctx, args.environmentId);

    if (membership.role !== "owner" && membership.role !== "admin") {
      throwError("Forbidden: Only owners and admins can modify variables", "FORBIDDEN", 403, {
        user_id: userId,
        environment_id: args.environmentId,
      });
    }

    validateLength(args.name, 50, "Variable name");

    const now = Date.now();

    // If variableId is provided, we are UPDATING an existing variable.
    if (args.variableId) {
      const existing = await ctx.db.get(args.variableId);
      if (!existing) {
        throwError("Variable not found", "NOT_FOUND", 404, {
          user_id: userId,
          environment_id: args.environmentId,
        });
      }
      if (existing.environmentId !== args.environmentId) {
        throwError("Variable does not belong to this environment", "BAD_REQUEST", 400, {
          user_id: userId,
          environment_id: args.environmentId,
        });
      }

      // Check for name collisions if name is changing (case-insensitive)
      if (existing.name.toUpperCase() !== args.name.toUpperCase()) {
        const allVars = await ctx.db
          .query("variables")
          .withIndex("by_environmentId", (q) => q.eq("environmentId", args.environmentId))
          .collect();
        const collision = allVars.find(
          (variable) =>
            variable._id !== args.variableId &&
            variable.name.toUpperCase() === args.name.toUpperCase()
        );
        if (collision) {
          throwError(
            `A variable named "${args.name}" already exists (names are case-insensitive)`,
            "CONFLICT",
            409,
            { user_id: userId, environment_id: args.environmentId }
          );
        }
      }

      await ctx.db.patch(args.variableId, {
        name: args.name,
        encryptedValue: args.encryptedValue,
        iv: args.iv,
        authTag: args.authTag,
        updatedAt: now,
      });

      await ctx.db.patch(args.environmentId, {
        updatedAt: now,
        updatedBy: userId,
      });

      return args.variableId;
    }

    // Otherwise, we are INSERTING a new variable.
    // 1. Check for name uniqueness - case-insensitive
    const allVars = await ctx.db
      .query("variables")
      .withIndex("by_environmentId", (q) => q.eq("environmentId", args.environmentId))
      .collect();

    const existingByName = allVars.find(
      (variable) => variable.name.toUpperCase() === args.name.toUpperCase()
    );

    if (existingByName) {
      throwError(
        `A variable named "${args.name}" already exists (names are case-insensitive)`,
        "CONFLICT",
        409,
        { user_id: userId, environment_id: args.environmentId }
      );
    }

    // 2. Check variable limit based on PROJECT OWNER's role
    const env = await ctx.db.get(args.environmentId);
    if (!env)
      throwError("Environment not found", "NOT_FOUND", 404, {
        user_id: userId,
        environment_id: args.environmentId,
      });

    const limits = await getProjectOwnerLimits(ctx, env.projectId);

    if (allVars.length >= limits.maxVariablesPerEnvironment) {
      throwError(
        `Variable limit reached (${limits.maxVariablesPerEnvironment}). Project owner needs to upgrade for more.`,
        "LIMIT_REACHED",
        403,
        { user_id: userId, project_id: env.projectId, environment_id: args.environmentId }
      );
    }

    const newVarId = await ctx.db.insert("variables", {
      environmentId: args.environmentId,
      name: args.name,
      encryptedValue: args.encryptedValue,
      iv: args.iv,
      authTag: args.authTag,
      createdBy: userId,
      updatedAt: now,
    });

    await ctx.db.patch(args.environmentId, {
      updatedAt: now,
      updatedBy: userId,
    });

    return newVarId;
  },
});

/**
 * Delete a variable.
 */
export const remove = mutation({
  args: { id: v.id("variables") },
  handler: async (ctx, args) => {
    const variable = await ctx.db.get(args.id);
    if (!variable) throwError("Variable not found", "NOT_FOUND", 404);

    const { userId, membership } = await checkEnvironmentAccess(ctx, variable.environmentId);

    // Enforce role-based access: only owner and admin can delete variables
    if (membership.role !== "owner" && membership.role !== "admin") {
      throwError("Forbidden: Only owners and admins can delete variables", "FORBIDDEN", 403, {
        user_id: membership.userId,
        project_id: membership.projectId,
        environment_id: variable.environmentId,
      });
    }

    await ctx.db.delete(args.id);

    const now = Date.now();
    await ctx.db.patch(variable.environmentId, {
      updatedAt: now,
      updatedBy: userId,
    });
  },
});
