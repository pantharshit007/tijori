import {
  index,
  pgTableCreator,
  text,
  uuid,
  varchar,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/**
 * Multi-project schema feature of Drizzle ORM - prefix all tables with "tijori_"
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator((name) => `tijori_${name}`);

// ============================================================================
// PROJECTS TABLE
// ============================================================================
/**
 * Projects are the top-level entity (like organizations).
 * Each project contains encrypted environment sections and is protected by a 6-digit passcode.
 *
 * Security design:
 * - `encryptedPasscode`: The 6-digit passcode encrypted with the master key
 *   (allows passcode recovery using master key)
 * - `masterKeyHash`: Hash of the master key for verification
 *   (master key itself is never stored, only its hash for validation)
 * - `passcodeSalt`: Salt used for passcode-based encryption of env variables
 */
export const projects = createTable(
  "project",
  (d) => ({
    id: d.uuid().primaryKey().defaultRandom(),
    name: d.varchar({ length: 256 }).notNull(),
    description: d.text(),

    // Security fields
    encryptedPasscode: d.text().notNull(), // Passcode encrypted with master key
    masterKeyHash: d.text().notNull(), // Hash of master key for verification
    passcodeSalt: d.text().notNull(), // Salt for passcode-based encryption
    iv: d.text().notNull(), // Initialization vector for AES-256-GCM
    authTag: d.text().notNull(), // Authentication tag for AES-256-GCM

    // Timestamps
    createdAt: d.timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: d
      .timestamp({ withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date()),
  }),
  (t) => [index("project_name_idx").on(t.name)],
);

// ============================================================================
// ENVIRONMENTS TABLE
// ============================================================================
/**
 * Environments are sections within a project (e.g., "dev", "prod", "staging").
 * Each environment contains a collection of encrypted environment variables.
 */
export const environments = createTable(
  "environment",
  (d) => ({
    id: d.uuid().primaryKey().defaultRandom(),
    projectId: d
      .uuid()
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: d.varchar({ length: 50 }).notNull(), // e.g., "dev", "prod", "staging"
    description: d.text(),

    // Timestamps
    createdAt: d.timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: d
      .timestamp({ withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date()),
  }),
  (t) => [
    index("environment_project_idx").on(t.projectId),
    index("environment_name_idx").on(t.projectId, t.name),
  ],
);

// ============================================================================
// ENVIRONMENT VARIABLES TABLE
// ============================================================================
/**
 * Environment variables store encrypted key-value pairs.
 *
 * Storage design:
 * - `name`: The variable name (stored in plain text for searchability)
 * - `encryptedValue`: The variable value encrypted using the project's passcode
 *
 * Client-side decryption flow:
 * 1. User enters 6-digit passcode
 * 2. Passcode is used to derive decryption key (with passcodeSalt from project)
 * 3. encryptedValue is decrypted on the client
 */
export const environmentVariables = createTable(
  "environment_variable",
  (d) => ({
    id: d.uuid().primaryKey().defaultRandom(),
    environmentId: d
      .uuid()
      .notNull()
      .references(() => environments.id, { onDelete: "cascade" }),

    name: d.varchar({ length: 256 }).notNull(), // Variable name (plain text)
    encryptedValue: d.text().notNull(), // Encrypted variable value

    // Timestamps
    createdAt: d.timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: d
      .timestamp({ withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date()),
  }),
  (t) => [
    index("env_var_environment_idx").on(t.environmentId),
    index("env_var_name_idx").on(t.environmentId, t.name),
  ],
);

// ============================================================================
// USERS TABLE
// ============================================================================
/**
 * Users table to store profile information.
 * The `id` should match the Supabase Auth User ID.
 */
export const users = createTable("user", (d) => ({
  id: d.uuid().primaryKey().notNull(), // Matches Supabase Auth ID
  name: d.varchar({ length: 255 }),
  email: d.varchar({ length: 255 }).notNull().unique(),
  image: d.text(),

  // Timestamps
  createdAt: d.timestamp({ withTimezone: true }).defaultNow().notNull(),
  updatedAt: d
    .timestamp({ withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date()),
}));

// ============================================================================
// PROJECT MEMBERS TABLE
// ============================================================================
/**
 * Link table between Users and Projects.
 * Defines the role of a user in a project.
 */
export const projectMembers = createTable(
  "project_member",
  (d) => ({
    id: d.uuid().primaryKey().defaultRandom(),
    projectId: d
      .uuid()
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: d
      .uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: d.varchar({ length: 50 }).notNull().default("member"), // 'owner', 'admin', 'member'

    // Timestamps
    createdAt: d.timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: d
      .timestamp({ withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date()),
  }),
  (t) => [
    index("project_member_project_idx").on(t.projectId),
    index("project_member_user_idx").on(t.userId),
    // Ensure a user is added to a project only once
    uniqueIndex("project_member_unique_idx").on(t.projectId, t.userId),
  ],
);

// ============================================================================
// SHARED SECRETS TABLE
// ============================================================================
/**
 * Shared secrets allow secure sharing of environment variables via a URL + Passcode.
 *
 * Security design (Zero-Knowledge):
 * 1. Secrets are encrypted with a random "share key"
 * 2. The share key is encrypted with a passcode-derived key (via KDF)
 * 3. Both encrypted blobs are stored in the database
 * 4. The URL only contains the share_id (no secrets)
 * 5. Recipient enters passcode → decrypts share key → decrypts secrets
 *
 * The server NEVER sees the plaintext secrets or the passcode.
 */
export const sharedSecrets = createTable(
  "shared_secret",
  (d) => ({
    id: d.uuid().primaryKey().defaultRandom(),
    projectId: d
      .uuid()
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    environmentId: d
      .uuid()
      .notNull()
      .references(() => environments.id, { onDelete: "cascade" }),
    createdBy: d
      .uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Encrypted data
    encryptedPayload: d.text().notNull(), // Secrets encrypted with share key
    encryptedShareKey: d.text().notNull(), // Share key encrypted with passcode
    passcodeSalt: d.text().notNull(), // Salt for passcode-based KDF
    iv: d.text().notNull(), // IV for share key encryption
    authTag: d.text().notNull(), // Auth tag for share key encryption
    payloadIv: d.text().notNull(), // IV for payload encryption
    payloadAuthTag: d.text().notNull(), // Auth tag for payload encryption

    // Metadata
    description: d.text(),

    // Access controls
    expiresAt: d.timestamp({ withTimezone: true }), // Optional expiration
    lastAccessedAt: d.timestamp({ withTimezone: true }), // Last access timestamp

    // Timestamps
    createdAt: d.timestamp({ withTimezone: true }).defaultNow().notNull(),
  }),
  (t) => [
    index("shared_secret_project_idx").on(t.projectId),
    index("shared_secret_environment_idx").on(t.environmentId),
    index("shared_secret_created_by_idx").on(t.createdBy),
  ],
);

// ============================================================================
// RELATIONS
// ============================================================================
export const projectsRelations = relations(projects, ({ many }) => ({
  environments: many(environments),
  members: many(projectMembers),
  sharedSecrets: many(sharedSecrets),
}));

export const environmentsRelations = relations(
  environments,
  ({ one, many }) => ({
    project: one(projects, {
      fields: [environments.projectId],
      references: [projects.id],
    }),
    variables: many(environmentVariables),
    sharedSecrets: many(sharedSecrets),
  }),
);

export const environmentVariablesRelations = relations(
  environmentVariables,
  ({ one }) => ({
    environment: one(environments, {
      fields: [environmentVariables.environmentId],
      references: [environments.id],
    }),
  }),
);

export const usersRelations = relations(users, ({ many }) => ({
  projectMemberships: many(projectMembers),
  createdSharedSecrets: many(sharedSecrets),
}));

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(projects, {
    fields: [projectMembers.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [projectMembers.userId],
    references: [users.id],
  }),
}));

export const sharedSecretsRelations = relations(sharedSecrets, ({ one }) => ({
  project: one(projects, {
    fields: [sharedSecrets.projectId],
    references: [projects.id],
  }),
  environment: one(environments, {
    fields: [sharedSecrets.environmentId],
    references: [environments.id],
  }),
  creator: one(users, {
    fields: [sharedSecrets.createdBy],
    references: [users.id],
  }),
}));
