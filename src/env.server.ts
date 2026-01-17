import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

export const env = createEnv({
  server: {
    CONVEX_DEPLOYMENT: z.string().min(1),
    CONVEX_URL: z.url(),
    CLERK_SECRET_KEY: z.string().min(1),
    CLERK_JWT_ISSUER_DOMAIN: z.string().min(1),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
})
