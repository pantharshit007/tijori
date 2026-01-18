import type { Id } from "../../convex/_generated/dataModel";

export interface Environment {
  _id: Id<"environments">;
  _creationTime: number;
  name: string;
  updatedAt: number;
  projectId: Id<"projects">;
  description?: string;
}

export interface Variable {
  _id: Id<"variables">;
  _creationTime: number;
  name: string;
  encryptedValue: string;
  iv: string;
  authTag: string;
  environmentId: Id<"environments">;
}

export interface SharedVariable {
  name: string;
  value: string;
}

export interface SharedSecret {
  _id: Id<"sharedSecrets">;
  _creationTime: number;
  projectId: Id<"projects">;
  environmentId: Id<"environments">;
  projectName: string;
  environmentName: string;
  passcode: string;
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
}
