import { useStoreUserEffect } from '@/hooks/use-store-user'

/**
 * Component that syncs the authenticated user to Convex.
 * Renders children only after user is loaded.
 */
export function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { isLoaded } = useStoreUserEffect()

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return <>{children}</>
}
