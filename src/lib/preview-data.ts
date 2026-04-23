/**
 * Mock data for the landing page dashboard preview component.
 * This data is only used for the interactive mockup, not for any real app logic.
 */

export const PREVIEW_VARIABLES = [
  {
    name: "DATABASE_URL",
    env: "PRODUCTION",
    date: "Apr 18, 2026",
    value: "postgres://prod:****@db.acme.io",
  },
  {
    name: "JWT_SECRET",
    env: "PRODUCTION",
    date: "Apr 17, 2026",
    value: "sk_live_a8f2…x9k1",
  },
  {
    name: "STRIPE_KEY",
    env: "STAGING",
    date: "Apr 16, 2026",
    value: "pk_test_51Abc…",
  },
  {
    name: "REDIS_HOST",
    env: "DEVELOPMENT",
    date: "Apr 15, 2026",
    value: "redis://10.0.0.12:6379",
  },
] as const;

export const PREVIEW_PROJECTS = [
  {
    name: "Acme Platform",
    role: "owner",
    description: "Core infrastructure secrets",
    updated: "Updated 2h ago",
  },
  {
    name: "Frontend App",
    role: "admin",
    description: "Client-side configuration",
    updated: "Updated 1d ago",
  },
  {
    name: "Microservices",
    role: "member",
    description: "Internal service keys",
    updated: "Updated 3d ago",
  },
] as const;

export const PREVIEW_SHARED = [
  {
    label: "API Keys share",
    envProject: "Production / Acme Platform",
    createdBy: "Jane",
    expiry: "in 23h",
    views: 3,
    status: "Active" as const,
  },
  {
    label: "Staging DB creds",
    envProject: "Staging / Frontend App",
    createdBy: "Alex",
    expiry: "in 6d",
    views: 0,
    status: "Active" as const,
  },
] as const;
