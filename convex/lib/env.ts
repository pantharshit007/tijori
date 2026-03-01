import { z } from "zod";

const authEnvSchema = z.object({
  CLERK_JWT_ISSUER_DOMAIN: z
    .string()
    .min(
      1,
      "CLERK_JWT_ISSUER_DOMAIN is required. Run: bunx convex env set CLERK_JWT_ISSUER_DOMAIN 'https://your-instance.clerk.accounts.dev'"
    ),
});

const webhookEnvSchema = authEnvSchema.extend({
  CLERK_WEBHOOK_SIGNING_SECRET: z
    .string()
    .min(
      1,
      "CLERK_WEBHOOK_SIGNING_SECRET is required. Run: bunx convex env set CLERK_WEBHOOK_SIGNING_SECRET 'whsec_...'"
    ),
});

let cachedAuthEnv: z.infer<typeof authEnvSchema> | null = null;
let cachedWebhookEnv: z.infer<typeof webhookEnvSchema> | null = null;

export function getConvexAuthEnv() {
  if (cachedAuthEnv) return cachedAuthEnv;

  cachedAuthEnv = authEnvSchema.parse({
    CLERK_JWT_ISSUER_DOMAIN: process.env.CLERK_JWT_ISSUER_DOMAIN,
  });

  return cachedAuthEnv;
}

export function getConvexWebhookEnv() {
  if (cachedWebhookEnv) return cachedWebhookEnv;

  cachedWebhookEnv = webhookEnvSchema.parse({
    CLERK_JWT_ISSUER_DOMAIN: process.env.CLERK_JWT_ISSUER_DOMAIN,
    CLERK_WEBHOOK_SIGNING_SECRET: process.env.CLERK_WEBHOOK_SIGNING_SECRET,
  });

  return cachedWebhookEnv;
}
