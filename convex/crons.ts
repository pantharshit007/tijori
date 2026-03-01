import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "process user deletion queue biweekly",
  { hours: 24 * 14 },
  internal.users.processQueuedDeletionJobs,
  {}
);

export default crons;
