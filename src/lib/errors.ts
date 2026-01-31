import { ConvexError } from "convex/values";

/**
 * Extracts a user-friendly error message from any error.
 * Handles ConvexError specially to extract structured data.
 *
 * @param err - The caught error (can be any type)
 * @param fallback - Default message if no specific error can be extracted
 * @returns A user-friendly error message string
 */
export function getErrorMessage(err: unknown, fallback: string = "An error occurred"): string {
  if (err instanceof ConvexError) {
    // ConvexError stores structured data in .data
    if (typeof err.data === "string") {
      return err.data;
    }
    if (err.data && typeof err.data === "object" && "message" in err.data) {
      return String((err.data as { message: unknown }).message);
    }
  }

  if (err instanceof Error) {
    return err.message || fallback;
  }

  if (typeof err === "string") {
    return err;
  }

  return fallback;
}
