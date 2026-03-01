import { useUser } from "@clerk/tanstack-react-start";
import { ConvexError } from "convex/values";
import { useMutation } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";

import type { StoreUserStatus } from "@/lib/types";

/**
 * Hook to sync Clerk user to Convex database.
 * Call this in a component that's rendered when the user is signed in.
 *
 * Returns `status` to distinguish between normal sync, deactivated accounts,
 * and accounts pending deletion so the UI can show the correct screen.
 */
export function useStoreUserEffect() {
  const { isLoaded, isSignedIn, user } = useUser();
  const storeUser = useMutation(api.users.store);
  const hasStoredRef = useRef(false);
  const [status, setStatus] = useState<StoreUserStatus>("idle");

  useEffect(() => {
    // Only run once per session when user is signed in
    if (!isLoaded || !isSignedIn || hasStoredRef.current) {
      return;
    }

    // Get the primary email
    const email = user?.primaryEmailAddress?.emailAddress;
    if (!email) {
      console.warn("User has no email address");
      return;
    }

    // Sync user to Convex
    storeUser({
      name: user.fullName || user.firstName || undefined,
      email,
      image: user.imageUrl || undefined,
    })
      .then(() => {
        hasStoredRef.current = true;
        setStatus("synced");
      })
      .catch((err) => {
        if (err instanceof ConvexError) {
          const data = err.data as { type?: string } | undefined;
          if (data?.type === "DELETION_IN_PROGRESS") {
            setStatus("deletion_in_progress");
            return;
          }
          if (data?.type === "USER_DEACTIVATED") {
            setStatus("deactivated");
            return;
          }
        }
        console.error("Failed to sync user to Convex:", err);
        setStatus("error");
      });
  }, [isLoaded, isSignedIn, user, storeUser]);

  return { isLoaded, isSignedIn, status };
}
