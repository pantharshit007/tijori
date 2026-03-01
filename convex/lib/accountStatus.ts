export type AccountStatus = "ACTIVE" | "DEACTIVATED" | "DELETION_QUEUED";

export function isUserBlocked(user: {
  accountStatus?: AccountStatus;
  isDeactivated?: boolean;
}): boolean {
  return (
    user.accountStatus === "DEACTIVATED" ||
    user.accountStatus === "DELETION_QUEUED" ||
    Boolean(user.isDeactivated)
  );
}

export function isUserDeactivated(user: {
  accountStatus?: AccountStatus;
  isDeactivated?: boolean;
}): boolean {
  return user.accountStatus === "DEACTIVATED" || Boolean(user.isDeactivated);
}
