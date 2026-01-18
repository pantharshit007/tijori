import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(), // Unique ID from Auth Provider (e.g., Clerk)
    name: v.optional(v.string()),
    email: v.string(),
    image: v.optional(v.string()),
    // Master key for all projects (set in Settings)
    masterKeyHash: v.optional(v.string()), // SHA-256 hash of Master Key
    masterKeySalt: v.optional(v.string()), // Salt for hash
  }).index('by_tokenIdentifier', ['tokenIdentifier']),

  projects: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    passcodeHash: v.string(), // SHA-256 hash of passcode (with salt)
    encryptedPasscode: v.string(), // AES-256-GCM encrypted passcode
    passcodeSalt: v.string(), // Salt for both hash and PBKDF2
    iv: v.string(), // IV for encryptedPasscode
    authTag: v.string(), // AuthTag for encryptedPasscode
    ownerId: v.id('users'), // Link to the owner
    updatedAt: v.number(), // Timestamp - set to creation time initially, updated on changes
  }).index('by_ownerId', ['ownerId']),

  projectMembers: defineTable({
    projectId: v.id('projects'),
    userId: v.id('users'),
    role: v.union(v.literal('owner'), v.literal('admin'), v.literal('member')),
  })
    .index('by_projectId', ['projectId'])
    .index('by_userId', ['userId'])
    .index('by_project_user', ['projectId', 'userId']),

  environments: defineTable({
    projectId: v.id('projects'),
    name: v.string(),
    description: v.optional(v.string()),
    updatedAt: v.number(), // Timestamp - set to creation time initially, updated on changes
  }).index('by_projectId', ['projectId']),

  variables: defineTable({
    environmentId: v.id('environments'),
    name: v.string(), // Plain text name for search
    encryptedValue: v.string(), // AES-256-GCM encrypted value
    iv: v.string(), // IV for this specific value
    authTag: v.string(), // AuthTag for this specific value
  }).index('by_environmentId', ['environmentId']),

  sharedSecrets: defineTable({
    projectId: v.id('projects'),
    environmentId: v.id('environments'),
    createdBy: v.id('users'),
    encryptedPasscode: v.string(), // Passcode encrypted with Project Key
    passcodeIv: v.string(), // IV for encryptedPasscode
    passcodeAuthTag: v.string(), // AuthTag for encryptedPasscode
    encryptedPayload: v.string(), // Secrets encrypted with Share Key
    encryptedShareKey: v.string(), // Share Key encrypted with Passcode
    passcodeSalt: v.string(), // Salt for share passcode derivation
    iv: v.string(), // IV for Share Key
    authTag: v.string(), // AuthTag for Share Key
    payloadIv: v.string(), // IV for Payload
    payloadAuthTag: v.string(), // AuthTag for Payload
    expiresAt: v.optional(v.number()),
    isIndefinite: v.boolean(),
    isDisabled: v.boolean(), // Disable without deleting
    views: v.number(),
  })
    .index('by_projectId', ['projectId'])
    .index('by_createdBy', ['createdBy'])
    .index('by_expiry', ['expiresAt']),
})

