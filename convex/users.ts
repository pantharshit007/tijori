import { v } from "convex/values";
import { MAX_LENGTHS } from "../src/lib/constants";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import { TIER_LIMITS } from "./lib/roleLimits";
import { isUserBlocked } from "./lib/accountStatus";
import { throwError, validateLength } from "./lib/errors";
import type { GenericMutationCtx } from "convex/server";
import type { Tier } from "./lib/roleLimits";
import type { DataModel, Doc, Id, TableNames } from "./_generated/dataModel";

const ACCOUNT_STATUS = {
  ACTIVE: "ACTIVE",
  DEACTIVATED: "DEACTIVATED",
  DELETION_QUEUED: "DELETION_QUEUED",
} as const;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

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
      throwError("Called storeUser without authentication identity", "UNAUTHENTICATED", 401);
    }

    validateLength(args.name, MAX_LENGTHS.USER_NAME, "Name");
    validateLength(args.email, MAX_LENGTHS.USER_EMAIL, "Email");
    const normalizedEmail = normalizeEmail(args.email);

    // Check if the user already exists
    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    const name = (args.name || args.email.split("@")[0] || "Unknown User").trim();

    if (user !== null) {
      // If we've seen this user before but their name or picture has changed, update them.
      const inferredStatus =
        user.accountStatus ?? (user.isDeactivated ? ACCOUNT_STATUS.DEACTIVATED : ACCOUNT_STATUS.ACTIVE);
      const needsMetadataPatch =
        user.emailLookupKey !== normalizedEmail || user.accountStatus !== inferredStatus;

      if (
        user.name !== name ||
        user.email !== normalizedEmail ||
        user.image !== args.image ||
        needsMetadataPatch
      ) {
        await ctx.db.patch(user._id, {
          name,
          email: normalizedEmail,
          emailLookupKey: normalizedEmail,
          accountStatus: inferredStatus,
          isDeactivated: inferredStatus === ACCOUNT_STATUS.ACTIVE ? undefined : true,
          image: args.image,
        });
      }
      if (isUserBlocked(user)) {
        throwError("User account is deactivated", "USER_DEACTIVATED", 403, { user_id: user._id });
      }
      return user._id;
    }

    const existingByEmail = await ctx.db
      .query("users")
      .withIndex("by_emailLookupKey", (q) => q.eq("emailLookupKey", normalizedEmail))
      .unique();
    const legacyExistingByEmail = existingByEmail
      ? null
      : await ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", normalizedEmail)).unique();
    const existingUserWithEmail = existingByEmail ?? legacyExistingByEmail;

    if (existingUserWithEmail) {
      if (
        existingUserWithEmail.accountStatus === ACCOUNT_STATUS.DEACTIVATED ||
        existingUserWithEmail.isDeactivated
      ) {
        throwError("User account is deactivated", "USER_DEACTIVATED", 403, {
          user_id: existingUserWithEmail._id,
        });
      }
      throwError("Email is already in use", "CONFLICT", 409, { user_id: existingUserWithEmail._id });
    }

    // If it's a new identity, create a new User with default 'user' role.
    return await ctx.db.insert("users", {
      tokenIdentifier: identity.tokenIdentifier,
      name,
      email: normalizedEmail,
      emailLookupKey: normalizedEmail,
      accountStatus: ACCOUNT_STATUS.ACTIVE,
      image: args.image,
      tier: "free",
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
      throwError("Unauthenticated", "UNAUTHENTICATED", 401);
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) {
      throwError("User not found", "NOT_FOUND", 404);
    }

    if (isUserBlocked(user)) {
      throwError("User account is deactivated", "USER_DEACTIVATED", 403, { user_id: user._id });
    }

    await ctx.db.patch(user._id, {
      masterKeyHash: args.masterKeyHash,
      masterKeySalt: args.masterKeySalt,
    });

    return { success: true };
  },
});

/**
 * Get usage stats for the current user to show in the UI against limits, returns project counts and role.
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

    if (isUserBlocked(user)) return null;

    // Count owned projects
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
      .collect();

    return {
      projectsCount: projects.length,
      tier: user.tier,
    };
  },
});

/**
 * Get plan enforcement status for the current user.
 * Calculates violation details on-demand using quotas table.
 * Convex caches this and auto-invalidates when data changes.
 */
export const getPlanEnforcementStatus = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) return null;

    // Deactivated users should not see plan enforcement UI
    if (isUserBlocked(user)) return null;

    // If flag not set, return early
    if (!user.exceedsPlanLimits) {
      return { exceedsPlanLimits: false };
    }

    const tier = (user.tier || "free") as Tier;
    const limits = TIER_LIMITS[tier];

    // Count owned projects
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
      .collect();

    // Use quotas table for efficient counting
    let projectsExceedingEnvLimits = 0;
    let projectsExceedingMemberLimits = 0;
    let projectsExceedingSecretLimits = 0;

    for (const project of projects) {
      const quotas = await ctx.db
        .query("quotas")
        .withIndex("by_projectId", (q) => q.eq("projectId", project._id))
        .collect();

      for (const quota of quotas) {
        if (
          quota.resourceType === "environments" &&
          quota.used > limits.maxEnvironmentsPerProject
        ) {
          projectsExceedingEnvLimits++;
        }
        if (quota.resourceType === "members" && quota.used > limits.maxMembersPerProject) {
          projectsExceedingMemberLimits++;
        }
        if (
          quota.resourceType === "sharedSecrets" &&
          quota.used > limits.maxSharedSecretsPerProject
        ) {
          projectsExceedingSecretLimits++;
        }
      }
    }

    // Check if still exceeding any limit
    const stillExceeds =
      projects.length > limits.maxProjects ||
      projectsExceedingEnvLimits > 0 ||
      projectsExceedingMemberLimits > 0 ||
      projectsExceedingSecretLimits > 0;

    // If no longer exceeding, the flag should have been cleared by the mutation
    // This handles edge cases where the flag wasn't cleared properly
    if (!stillExceeds) {
      return { exceedsPlanLimits: false };
    }

    return {
      exceedsPlanLimits: true,
      planEnforcementDeadline: user.planEnforcementDeadline,
      daysRemaining: user.planEnforcementDeadline
        ? Math.max(
            0,
            Math.ceil((user.planEnforcementDeadline - Date.now()) / (24 * 60 * 60 * 1000))
          )
        : 0,
      currentUsage: {
        projects: projects.length,
        projectsExceedingEnvLimits,
        projectsExceedingMemberLimits,
        projectsExceedingSecretLimits,
      },
      limits: {
        maxProjects: limits.maxProjects,
        maxEnvironmentsPerProject: limits.maxEnvironmentsPerProject,
        maxMembersPerProject: limits.maxMembersPerProject,
        maxSharedSecretsPerProject: limits.maxSharedSecretsPerProject,
      },
      tierName:
        tier === "free" ? "Free" : tier === "pro" ? "Pro" : tier === "pro_plus" ? "Pro+" : "Admin",
    };
  },
});

/**
 * Check if user still exceeds plan limits, and clear the flag if they don't.
 * Uses quotas table for efficient counting.
 */
export const checkAndClearExceedsPlanLimits = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throwError("Unauthenticated", "UNAUTHENTICATED", 401);

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) throwError("User not found", "NOT_FOUND", 404);

    // Deactivated users cannot perform this action
    if (isUserBlocked(user)) {
      throwError("Account is deactivated", "USER_DEACTIVATED", 403, { user_id: user._id });
    }

    // If not exceeding limits, nothing to do
    if (!user.exceedsPlanLimits) {
      return { cleared: false, wasAlreadyClear: true };
    }

    const tier = (user.tier || "free") as Tier;
    const limits = TIER_LIMITS[tier];

    // Count owned projects (only need IDs)
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
      .collect();

    // Check if still exceeding project count limit
    let stillExceeds = projects.length > limits.maxProjects;

    // Use quotas table for efficient checking
    if (!stillExceeds) {
      for (const project of projects) {
        const quotas = await ctx.db
          .query("quotas")
          .withIndex("by_projectId", (q) => q.eq("projectId", project._id))
          .collect();

        for (const quota of quotas) {
          if (
            quota.resourceType === "environments" &&
            quota.used > limits.maxEnvironmentsPerProject
          ) {
            stillExceeds = true;
            break;
          }
          if (quota.resourceType === "members" && quota.used > limits.maxMembersPerProject) {
            stillExceeds = true;
            break;
          }
          if (
            quota.resourceType === "sharedSecrets" &&
            quota.used > limits.maxSharedSecretsPerProject
          ) {
            stillExceeds = true;
            break;
          }
        }
        if (stillExceeds) break;
      }
    }

    if (!stillExceeds) {
      // Clear the enforcement flag
      await ctx.db.patch(user._id, {
        exceedsPlanLimits: undefined,
        planEnforcementDeadline: undefined,
      });
      return { cleared: true, wasAlreadyClear: false };
    }

    return { cleared: false, wasAlreadyClear: false, stillExceeds: true };
  },
});

const USER_DELETE_BATCH_SIZE = 25;
const USER_DELETE_PROJECT_BATCH_SIZE = 5;
const USER_DELETE_MAX_DELETES_PER_RUN = 120;
const USER_DELETE_JOBS_PER_CRON_RUN = 20;

async function deleteUserData(ctx: GenericMutationCtx<DataModel>, user: Doc<"users">) {
  const now = Date.now();
  const deletedLookupKey = `deleted:${user._id}`;

  // Soft-delete and free the original email lookup key so a deleted user can re-register.
  await ctx.db.patch(user._id, {
    isDeactivated: true,
    accountStatus: ACCOUNT_STATUS.DELETION_QUEUED,
    deletionRequestedAt: now,
    emailLookupKey: deletedLookupKey,
  });

  const existingJob = await ctx.db
    .query("deletionJobs")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .unique();

  if (existingJob) {
    await ctx.db.patch(existingJob._id, {
      status: "queued",
      attempts: existingJob.attempts,
      lastError: undefined,
      nextRunAt: now,
      completedAt: undefined,
      updatedAt: now,
    });
    return;
  }

  await ctx.db.insert("deletionJobs", {
    userId: user._id,
    status: "queued",
    attempts: 0,
    nextRunAt: now,
    updatedAt: now,
  });
}

async function deleteDocsById(ctx: GenericMutationCtx<DataModel>, ids: Id<TableNames>[]) {
  for (const id of ids) {
    await ctx.db.delete(id);
  }
}

export const processUserDeletionSweep = internalMutation({
  args: {
    jobId: v.id("deletionJobs"),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      return { done: true, reason: "job_missing" };
    }

    const user = await ctx.db.get(job.userId);
    if (!user) {
      await ctx.db.patch(job._id, {
        status: "done",
        completedAt: Date.now(),
        updatedAt: Date.now(),
      });
      return { done: true, reason: "user_missing" };
    }

    await ctx.db.patch(job._id, {
      status: "in_progress",
      updatedAt: Date.now(),
      lastError: undefined,
    });

    let deletedCount = 0;

    const membershipBatch = await ctx.db
      .query("projectMembers")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .take(USER_DELETE_BATCH_SIZE);
    await deleteDocsById(
      ctx,
      membershipBatch.map((membership) => membership._id)
    );
    deletedCount += membershipBatch.length;

    if (deletedCount < USER_DELETE_MAX_DELETES_PER_RUN) {
      const sharedByUserBatch = await ctx.db
        .query("sharedSecrets")
        .withIndex("by_createdBy", (q) => q.eq("createdBy", user._id))
        .take(Math.min(USER_DELETE_BATCH_SIZE, USER_DELETE_MAX_DELETES_PER_RUN - deletedCount));
      await deleteDocsById(
        ctx,
        sharedByUserBatch.map((shared) => shared._id)
      );
      deletedCount += sharedByUserBatch.length;
    }

    const ownedProjects =
      deletedCount < USER_DELETE_MAX_DELETES_PER_RUN
        ? await ctx.db
            .query("projects")
            .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
            .take(USER_DELETE_PROJECT_BATCH_SIZE)
        : [];

    for (const project of ownedProjects) {
      if (deletedCount >= USER_DELETE_MAX_DELETES_PER_RUN) break;

      const environments = await ctx.db
        .query("environments")
        .withIndex("by_projectId", (q) => q.eq("projectId", project._id))
        .take(USER_DELETE_BATCH_SIZE);

      for (const environment of environments) {
        if (deletedCount >= USER_DELETE_MAX_DELETES_PER_RUN) break;

        const variableBatch = await ctx.db
          .query("variables")
          .withIndex("by_environmentId", (q) => q.eq("environmentId", environment._id))
          .take(Math.min(USER_DELETE_BATCH_SIZE, USER_DELETE_MAX_DELETES_PER_RUN - deletedCount));
        await deleteDocsById(
          ctx,
          variableBatch.map((variable) => variable._id)
        );
        deletedCount += variableBatch.length;

        if (deletedCount >= USER_DELETE_MAX_DELETES_PER_RUN) break;

        const remainingVariables = await ctx.db
          .query("variables")
          .withIndex("by_environmentId", (q) => q.eq("environmentId", environment._id))
          .take(1);
        if (remainingVariables.length === 0) {
          await ctx.db.delete(environment._id);
          deletedCount += 1;
        }
      }

      if (deletedCount >= USER_DELETE_MAX_DELETES_PER_RUN) break;

      const shares = await ctx.db
        .query("sharedSecrets")
        .withIndex("by_projectId", (q) => q.eq("projectId", project._id))
        .take(Math.min(USER_DELETE_BATCH_SIZE, USER_DELETE_MAX_DELETES_PER_RUN - deletedCount));
      await deleteDocsById(
        ctx,
        shares.map((share) => share._id)
      );
      deletedCount += shares.length;

      if (deletedCount >= USER_DELETE_MAX_DELETES_PER_RUN) break;

      const quotas = await ctx.db
        .query("quotas")
        .withIndex("by_projectId", (q) => q.eq("projectId", project._id))
        .take(Math.min(USER_DELETE_BATCH_SIZE, USER_DELETE_MAX_DELETES_PER_RUN - deletedCount));
      await deleteDocsById(
        ctx,
        quotas.map((quota) => quota._id)
      );
      deletedCount += quotas.length;

      if (deletedCount >= USER_DELETE_MAX_DELETES_PER_RUN) break;

      const projectMembers = await ctx.db
        .query("projectMembers")
        .withIndex("by_projectId", (q) => q.eq("projectId", project._id))
        .take(Math.min(USER_DELETE_BATCH_SIZE, USER_DELETE_MAX_DELETES_PER_RUN - deletedCount));
      await deleteDocsById(
        ctx,
        projectMembers.map((member) => member._id)
      );
      deletedCount += projectMembers.length;

      if (deletedCount >= USER_DELETE_MAX_DELETES_PER_RUN) break;

      const [remainingEnvironments, remainingShares, remainingQuotas, remainingMembers] =
        await Promise.all([
          ctx.db
            .query("environments")
            .withIndex("by_projectId", (q) => q.eq("projectId", project._id))
            .take(1),
          ctx.db
            .query("sharedSecrets")
            .withIndex("by_projectId", (q) => q.eq("projectId", project._id))
            .take(1),
          ctx.db
            .query("quotas")
            .withIndex("by_projectId", (q) => q.eq("projectId", project._id))
            .take(1),
          ctx.db
            .query("projectMembers")
            .withIndex("by_projectId", (q) => q.eq("projectId", project._id))
            .take(1),
        ]);

      if (
        remainingEnvironments.length === 0 &&
        remainingShares.length === 0 &&
        remainingQuotas.length === 0 &&
        remainingMembers.length === 0
      ) {
        await ctx.db.delete(project._id);
        deletedCount += 1;
      }
    }

    const [hasOwnedProjects, hasMemberships, hasCreatedSharedSecrets] = await Promise.all([
      ctx.db
        .query("projects")
        .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
        .take(1),
      ctx.db
        .query("projectMembers")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .take(1),
      ctx.db
        .query("sharedSecrets")
        .withIndex("by_createdBy", (q) => q.eq("createdBy", user._id))
        .take(1),
    ]);

    if (
      hasOwnedProjects.length === 0 &&
      hasMemberships.length === 0 &&
      hasCreatedSharedSecrets.length === 0
    ) {
      await ctx.db.delete(user._id);
      await ctx.db.patch(job._id, {
        status: "done",
        completedAt: Date.now(),
        updatedAt: Date.now(),
      });
      return { done: true, deletedCount: deletedCount + 1 };
    }

    await ctx.scheduler.runAfter(0, internal.users.processUserDeletionSweep, {
      jobId: job._id,
    });

    await ctx.db.patch(job._id, {
      attempts: job.attempts + 1,
      nextRunAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { done: false, deletedCount };
  },
});

export const processQueuedDeletionJobs = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const queuedJobs = await ctx.db
      .query("deletionJobs")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .take(USER_DELETE_JOBS_PER_CRON_RUN);
    const inProgressJobs = await ctx.db
      .query("deletionJobs")
      .withIndex("by_status", (q) => q.eq("status", "in_progress"))
      .take(USER_DELETE_JOBS_PER_CRON_RUN);
    const jobs = [...queuedJobs, ...inProgressJobs];

    for (const job of jobs) {
      if (job.nextRunAt && job.nextRunAt > now) {
        continue;
      }

      await ctx.db.patch(job._id, {
        status: "in_progress",
        updatedAt: now,
      });

      await ctx.scheduler.runAfter(0, internal.users.processUserDeletionSweep, {
        jobId: job._id,
      });
    }

    return { queued: queuedJobs.length, resumed: inProgressJobs.length };
  },
});

/**
 * Delete the current user's account data from Convex.
 * Called after the Clerk user is deleted; the webhook may also trigger
 * deleteAccountByTokenIdentifier, so this call may race and find the
 * user already removed.
 */
export const deleteAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throwError("Unauthenticated", "UNAUTHENTICATED", 401);
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) {
      throwError("User not found", "NOT_FOUND", 404);
    }

    await deleteUserData(ctx, user);

    return { success: true, cleanupQueued: true };
  },
});

/**
 * Internal deletion path for Clerk webhooks (user.deleted).
 */
export const deleteAccountByTokenIdentifier = internalMutation({
  args: {
    tokenIdentifier: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", args.tokenIdentifier))
      .unique();

    if (!user) {
      return { success: false, reason: "not_found" };
    }

    await deleteUserData(ctx, user);

    return { success: true, cleanupQueued: true };
  },
});
