import { Id } from "convex/_generated/dataModel";
import { ConvexError } from "convex/values";

/**
 * Standard error types for the application.
 */
export type ErrorType =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "USER_DEACTIVATED"
  | "LIMIT_REACHED"
  | "CONFLICT"
  | "INTERNAL_ERROR";

/**
 * Numeric HTTP-like status codes.
 */
export type ErrorCode = 400 | 401 | 403 | 404 | 409 | 429 | 500;

export interface ErrorContext {
  user_id?: Id<"users"> | string;
  project_id?: string;
  environment_id?: string;
}

/**
 * Throws a structured ConvexError that can be easily parsed by the frontend.
 * @param message - A user-friendly error message.
 * @param type - The semantic type of error.
 * @param code - The numeric status code.
 * @param context - Optional identifiers for logging (user, project, env).
 */
export function throwError(
  message: string,
  type: ErrorType,
  code: ErrorCode,
  context?: ErrorContext
): never {
  const payload = { code, type, message, ...context };

  // Log detailed info on the server
  console.warn(`[${type}:${code}]`, context ? JSON.stringify(payload, null, 2) : "");

  throw new ConvexError({ message, type, code });
}

/**
 * Validates that a string is within a maximum length.
 * @param val - The string to check.
 * @param max - Maximum allowed length.
 * @param fieldName - Name of the field for the error message.
 */
export function validateLength(val: string | undefined, max: number, fieldName: string) {
  if (val && val.length > max) {
    throwError(`${fieldName} is too long (max ${max} characters)`, "BAD_REQUEST", 400);
  }
}
