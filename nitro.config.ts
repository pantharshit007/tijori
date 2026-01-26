import { defineNitroConfig } from "nitro/config";

export default defineNitroConfig({
  // Scan server/ directory for middleware and routes
  serverAssets: [],

  // Enable source maps for development
  sourcemap: process.env.NODE_ENV !== "production",

  // Route rules for security headers (production)
  routeRules: {},
});
