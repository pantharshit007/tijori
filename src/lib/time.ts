/**
 * Format a timestamp as relative time (e.g., "2 hours ago", "just now")
 * ex: 2 hours ago
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const isFuture = diff < 0;
  const absDiff = Math.abs(diff);

  const seconds = Math.floor(absDiff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  const getFormat = (value: number, unit: string) => {
    if (isFuture) return `in ${value}${unit}`;
    return `${value}${unit} ago`;
  };

  if (seconds < 60) return isFuture ? "just now" : "just now";
  if (minutes < 60) return getFormat(minutes, "m");
  if (hours < 24) return getFormat(hours, "h");
  if (days < 7) return getFormat(days, "d");
  if (weeks < 4) return getFormat(weeks, "w");
  if (months < 12) return getFormat(months, "mo");
  return getFormat(years, "y");
}

/**
 * Format a timestamp as a readable date string
 * ex: yyyy-mm-dd
 */
export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format a timestamp as a readable date and time string
 * ex: yyyy-mm-dd hh:mm
 */
export function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
