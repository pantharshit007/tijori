/**
 * Component that syncs the authenticated user to Convex.
 * Renders children only after user is loaded.
 * Exposes `status` from the store hook so parent can handle special states.
 */
import type { StoreUserStatus } from "@/lib/types";
import { useStoreUserEffect } from "@/hooks/use-store-user";

export function AuthenticatedLayout({
  children,
  setUserSyncStatus,
}: {
  children: React.ReactNode;
  setUserSyncStatus?: (status: StoreUserStatus) => void;
}) {
  const { isLoaded, status } = useStoreUserEffect();

  if (setUserSyncStatus && status !== "idle") {
    setUserSyncStatus(status);
  }

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
