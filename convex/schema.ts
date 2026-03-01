import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    name: v.string(),
    email: v.string(),
    emailLookupKey: v.optional(v.string()),
    image: v.optional(v.string()),
    masterKeyHash: v.optional(v.string()),
    masterKeySalt: v.optional(v.string()),
    accountStatus: v.optional(
      v.union(v.literal("ACTIVE"), v.literal("DEACTIVATED"), v.literal("DELETION_QUEUED"))
    ),
    tier: v.union(
      v.literal("free"),
      v.literal("pro"),
      v.literal("pro_plus"),
      v.literal("super_admin")
    ),
    isDeactivated: v.optional(v.boolean()),
    exceedsPlanLimits: v.optional(v.boolean()),
    planEnforcementDeadline: v.optional(v.number()), // Unix timestamp
    deletionRequestedAt: v.optional(v.number()),
  })
    .index("by_tokenIdentifier", ["tokenIdentifier"])
    .index("by_email", ["email"])
    .index("by_emailLookupKey", ["emailLookupKey"]),

  projects: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    passcodeHint: v.optional(v.string()),
    passcodeHash: v.string(),
    encryptedPasscode: v.string(),
    passcodeSalt: v.string(),
    iv: v.string(),
    authTag: v.string(),
    ownerId: v.id("users"),
    updatedAt: v.number(),
  }).index("by_ownerId", ["ownerId"]),

  projectMembers: defineTable({
    projectId: v.id("projects"),
    userId: v.id("users"),
    role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),
  })
    .index("by_projectId", ["projectId"])
    .index("by_userId", ["userId"])
    .index("by_project_user", ["projectId", "userId"]),

  environments: defineTable({
    projectId: v.id("projects"),
    name: v.string(),
    description: v.optional(v.string()),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
  }).index("by_projectId", ["projectId"]),

  variables: defineTable({
    environmentId: v.id("environments"),
    name: v.string(),
    encryptedValue: v.string(),
    iv: v.string(),
    authTag: v.string(),
    createdBy: v.id("users"),
    updatedAt: v.number(),
  }).index("by_environmentId", ["environmentId"]),

  sharedSecrets: defineTable({
    projectId: v.id("projects"),
    environmentId: v.id("environments"),
    createdBy: v.id("users"),
    name: v.optional(v.string()),
    encryptedPasscode: v.string(), // Passcode encrypted with Project Key
    passcodeIv: v.string(),
    passcodeAuthTag: v.string(),
    encryptedPayload: v.string(),
    encryptedShareKey: v.string(), // Share Key encrypted with Passcode
    passcodeSalt: v.string(), // Salt for share passcode derivation
    iv: v.string(),
    authTag: v.string(),
    payloadIv: v.string(),
    payloadAuthTag: v.string(),
    expiresAt: v.optional(v.number()),
    isIndefinite: v.boolean(),
    isDisabled: v.boolean(),
    views: v.number(),
    maxViews: v.optional(v.number()),
    deleted: v.optional(v.boolean()),
  })
    .index("by_projectId", ["projectId"])
    .index("by_createdBy", ["createdBy"])
    .index("by_expiry", ["expiresAt"]),

  /**
   * Quotas table for atomic resource limit tracking.
   * Each project has one quota document per resource type.
   * Used for concurrent-safe limit enforcement.
   */
  quotas: defineTable({
    projectId: v.id("projects"),
    resourceType: v.union(
      v.literal("environments"),
      v.literal("members"),
      v.literal("sharedSecrets")
    ),
    used: v.number(),
    limit: v.number(),
  })
    .index("by_projectId", ["projectId"])
    .index("by_project_resource", ["projectId", "resourceType"]),

  deletionJobs: defineTable({
    userId: v.id("users"),
    email: v.string(),
    status: v.union(
      v.literal("queued"),
      v.literal("in_progress"),
      v.literal("done"),
      v.literal("failed")
    ),
    attempts: v.number(),
    lastError: v.optional(v.string()),
    nextRunAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_status", ["status"])
    .index("by_email", ["email"]),
});
