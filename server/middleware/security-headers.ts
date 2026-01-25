/**
 * Security Headers Middleware
 *
 * Adds security headers to all responses to protect against common web vulnerabilities.
 * This middleware runs on the server for every request.
 */
import { defineEventHandler, setResponseHeaders } from "h3";

export default defineEventHandler((event) => {
  // Get the request path
  const path = event.path || "";

  // Skip middleware for static assets (they're handled by CDN/bundler)
  if (
    path.startsWith("/_build/") ||
    path.startsWith("/assets/") ||
    path.endsWith(".js") ||
    path.endsWith(".css") ||
    path.endsWith(".map")
  ) {
    return;
  }

  // Define Content Security Policy
  // Note: 'unsafe-inline' is needed for CSS-in-JS and inline styles from Radix UI
  // In production, consider using nonces for stricter CSP
  const cspDirectives = [
    // Default to self
    "default-src 'self'",

    // Scripts: self + Clerk auth
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk.accounts.dev https://*.clerk.accounts.dev",

    // Styles: self + inline (for Tailwind/Radix) + Google Fonts + JSDelivr
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",

    // Images: self + Clerk avatars + data URIs
    "img-src 'self' data: blob: https://*.clerk.com https://*.clerk.accounts.dev https://img.clerk.com",

    // Fonts: self + Google Fonts + JSDelivr
    "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net",

    // Connect: self + Convex + Clerk
    "connect-src 'self' https://*.convex.cloud wss://*.convex.cloud https://clerk.accounts.dev https://*.clerk.accounts.dev",

    // Frame ancestors: none (prevent clickjacking)
    "frame-ancestors 'none'",

    // Form actions: self only
    "form-action 'self'",

    // Base URI: self only
    "base-uri 'self'",

    // Object/embed: none
    "object-src 'none'",

    // Upgrade insecure requests in production
    "upgrade-insecure-requests",
  ];

  const csp = cspDirectives.join("; ");

  // Set security headers
  setResponseHeaders(event, {
    // Content Security Policy
    "Content-Security-Policy": csp,

    // Prevent MIME type sniffing
    "X-Content-Type-Options": "nosniff",

    // Prevent clickjacking
    "X-Frame-Options": "DENY",

    // Enable XSS filter (legacy, but doesn't hurt)
    "X-XSS-Protection": "1; mode=block",

    // Control referrer information
    "Referrer-Policy": "strict-origin-when-cross-origin",

    // Permissions Policy (formerly Feature-Policy)
    "Permissions-Policy":
      "camera=(), microphone=(), geolocation=(), interest-cohort=()",

    // HSTS - enforce HTTPS (only in production)
    // Uncomment in production after verifying HTTPS setup
    // 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  });
});
