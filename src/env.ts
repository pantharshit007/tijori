import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";
import { FALLBACK_SUPPORT_EMAIL } from "./lib/constants";

export const env = createEnv({
  clientPrefix: "VITE_",
  client: {
    VITE_CONVEX_URL: z.string().url(),
    VITE_CLERK_PUBLISHABLE_KEY: z.string().min(1),
    VITE_SUPPORT_EMAIL: z.email().optional().default(FALLBACK_SUPPORT_EMAIL),
  },
  runtimeEnv: import.meta.env,
  emptyStringAsUndefined: true,
});
