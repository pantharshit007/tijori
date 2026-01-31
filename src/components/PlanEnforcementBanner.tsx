import { useQuery } from "convex/react";
import { AlertTriangle, Clock, X } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useState } from "react";

/**
 * Plan Enforcement Banner
 * Shows a warning when user exceeds plan limits after a downgrade.
 * Auto-hides when mutations (deleteEnvironment, removeMember, etc.) clear the flag.
 */
export function PlanEnforcementBanner() {
  const enforcementStatus = useQuery(api.users.getPlanEnforcementStatus);
  const [isDismissed, setIsDismissed] = useState(false);

  // Don't render if loading, no data, or not exceeding limits
  if (!enforcementStatus || !enforcementStatus.exceedsPlanLimits || isDismissed) {
    return null;
  }

  const { daysRemaining, currentUsage, limits, tierName } = enforcementStatus;

  if (!currentUsage || !limits) {
    return null;
  }

  // Build a list of exceeded limits
  const violations: string[] = [];
  if (currentUsage.projects > limits.maxProjects) {
    violations.push(`${currentUsage.projects} projects (limit: ${limits.maxProjects})`);
  }
  if (currentUsage.projectsExceedingEnvLimits > 0) {
    violations.push(
      `${currentUsage.projectsExceedingEnvLimits} project(s) exceeding environment limit (${limits.maxEnvironmentsPerProject} per project)`
    );
  }
  if (currentUsage.projectsExceedingMemberLimits > 0) {
    violations.push(
      `${currentUsage.projectsExceedingMemberLimits} project(s) exceeding member limit (${limits.maxMembersPerProject} per project)`
    );
  }
  if (currentUsage.projectsExceedingSecretLimits > 0) {
    violations.push(
      `${currentUsage.projectsExceedingSecretLimits} project(s) exceeding shared secrets limit (${limits.maxSharedSecretsPerProject} per project)`
    );
  }

  return (
    <Alert
      variant="destructive"
      className="mb-4 border-dashed border-yellow-500 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 dark:border-yellow-600 dark:bg-yellow-900/20"
    >
      <AlertTriangle className="h-5 w-5" />
      <AlertTitle className="flex items-center justify-between">
        <span className="flex items-center gap-2">
          Plan Limit Exceeded
          <span className="inline-flex items-center gap-1 text-sm font-normal bg-yellow-500/20 px-2 py-0.5 rounded">
            <Clock className="h-3 w-3" />
            {daysRemaining} day{daysRemaining !== 1 ? "s" : ""} remaining
          </span>
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 -mr-2 hover:bg-yellow-500/20"
          onClick={() => setIsDismissed(true)}
        >
          <X className="h-4 w-4" />
        </Button>
      </AlertTitle>
      <AlertDescription className="mt-2 space-y-2">
        <p>
          Your <strong>{tierName}</strong> plan has the following limits that you're currently
          exceeding:
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm">
          {violations.map((violation, i) => (
            <li key={i}>{violation}</li>
          ))}
        </ul>
        <p className="text-sm">
          Please delete excess projects, environments, members, or shared secrets to stay within
          your plan limits. After <strong>{daysRemaining} days</strong>, excess resources will be
          automatically removed based on least recently used criteria.
        </p>
        <p className="text-xs text-muted-foreground mt-2 italic">
          This banner will automatically disappear once you're within your plan limits.
        </p>
      </AlertDescription>
    </Alert>
  );
}
