import { ConvexError } from "convex/values";

/**
 * Extracts a user-friendly error message from any error.
 * Handles ConvexError specially to extract structured data.
 *
 * @param err - The caught error (can be any type)
 * @param fallback - Default message if no specific error can be extracted
 * @returns A user-friendly error message string
 */
export function getErrorMessage(err: unknown, fallback: string = "Unexpected error"): string {
  if (err instanceof ConvexError) {
    // ConvexError stores structured data in .data
    const data = err.data;

    if (typeof data === "string") {
      return data;
    }

    if (data && typeof data === "object") {
      if ("message" in data) {
        return String((data as { message: unknown }).message);
      }
      // Fallback for other object structures
      return JSON.stringify(data);
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
