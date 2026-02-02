import type { Id } from "../../convex/_generated/dataModel";
import { Tier } from "./role-limits";

export interface Environment {
  _id: Id<"environments">;
  _creationTime: number;
  name: string;
  updatedAt: number;
  projectId: Id<"projects">;
  description?: string;
  updatedBy: Id<"users">;
  updaterName: string;
  updaterImage: string;
}

export interface Variable {
  _id: Id<"variables">;
  _creationTime: number;
  name: string;
  encryptedValue: string;
  iv: string;
  authTag: string;
  environmentId: Id<"environments">;
  createdBy: Id<"users">;
  updatedAt: number;
  creatorName?: string;
  creatorImage?: string;
}

export interface SharedVariable {
  name: string;
  value: string;
}

export type ProjectPasscodeUpdate = {
  projectId: Id<"projects">;
  passcodeHash: string;
  encryptedPasscode: string;
  passcodeSalt: string;
  iv: string;
  authTag: string;
};

export interface SharedSecret {
  _id: Id<"sharedSecrets">;
  _creationTime: number;
  projectId: Id<"projects">;
  environmentId: Id<"environments">;
  projectName: string;
  environmentName: string;
  name?: string;
  encryptedPasscode: string;
  passcodeIv: string;
  passcodeAuthTag: string;
  encryptedPayload: string;
  encryptedShareKey: string;
  passcodeSalt: string;
  iv: string;
  authTag: string;
  payloadIv: string;
  payloadAuthTag: string;
  expiresAt?: number;
  isIndefinite: boolean;
  isDisabled: boolean;
  views: number;
  isExpired: boolean;
  canManage?: boolean;
  isCreator?: boolean;
  isOwner?: boolean;
  creatorName?: string;
  creatorImage?: string;
}

export interface EnvironmentVariablesProps {
  environment: Environment;
  derivedKey: CryptoKey | null;
  userRole: "owner" | "admin" | "member";
  ownerTier: Tier;
}

export interface ParsedVariable {
  name: string;
  value: string;
  error?: string;
}

export interface BulkEditVariable {
  id: string;
  originalName: string;
  name: string;
  value: string;
  isNew?: boolean;
  toDelete?: boolean;
}
