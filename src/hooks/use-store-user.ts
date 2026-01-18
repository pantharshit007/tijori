import { useUser } from '@clerk/tanstack-react-start'
import { useMutation } from 'convex/react'
import { useEffect, useRef } from 'react'
import { api } from '../../convex/_generated/api'

/**
 * Hook to sync Clerk user to Convex database.
 * Call this in a component that's rendered when the user is signed in.
 */
export function useStoreUserEffect() {
  const { isLoaded, isSignedIn, user } = useUser()
  const storeUser = useMutation(api.users.store)
  const hasStoredRef = useRef(false)

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
        console.log("User synced to Convex");
      })
      .catch((err) => {
        console.error("Failed to sync user to Convex:", err);
      });
  }, [isLoaded, isSignedIn, user, storeUser]);

  return { isLoaded, isSignedIn };
}
