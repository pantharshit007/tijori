import { defineNitroConfig } from "nitro/config";

export default defineNitroConfig({
  // Scan server/ directory for middleware and routes
  serverAssets: [],
  
  // Enable source maps for development
  sourcemap: process.env.NODE_ENV !== "production",

  // Route rules for security headers (production)
  routeRules: {
    "/**": {
      headers: {
        // Prevent MIME type sniffing
        "X-Content-Type-Options": "nosniff",
        // Prevent clickjacking
        "X-Frame-Options": "DENY",
        // Enable XSS filter
        "X-XSS-Protection": "1; mode=block",
        // Control referrer information
        "Referrer-Policy": "strict-origin-when-cross-origin",
        // Permissions Policy
        "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
      },
    },
  },
});
