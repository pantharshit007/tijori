import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

export const env = createEnv({
  clientPrefix: 'VITE_',
  client: {
    VITE_CONVEX_URL: z.string().url(),
    VITE_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  },
  server: {
    CONVEX_DEPLOYMENT: z.string().min(1),
    CONVEX_URL: z.string().url(),
    CLERK_SECRET_KEY: z.string().min(1),
    CLERK_JWT_ISSUER_DOMAIN: z.string().min(1),
  },
  runtimeEnv: import.meta.env,
  emptyStringAsUndefined: true,
})
