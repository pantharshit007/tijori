import { httpRouter } from "convex/server";
import { verifyWebhook } from "@clerk/backend/webhooks";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { getConvexWebhookEnv } from "./lib/env";

const http = httpRouter();

function buildTokenIdentifierCandidates(clerkUserId: string, issuerDomain: string): string[] {
  const trimmedIssuer = issuerDomain.trim().replace(/\/+$/, "");
  return [`${trimmedIssuer}|${clerkUserId}`, `${trimmedIssuer}/|${clerkUserId}`];
}

http.route({
  path: "/webhooks/clerk",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const { CLERK_JWT_ISSUER_DOMAIN, CLERK_WEBHOOK_SIGNING_SECRET } = getConvexWebhookEnv();
      const evt = await verifyWebhook(request, {
        signingSecret: CLERK_WEBHOOK_SIGNING_SECRET,
      });

      if (evt.type !== "user.deleted") {
        return new Response("Ignored", { status: 200 });
      }

      const clerkUserId = evt.data.id;
      if (!clerkUserId) {
        return new Response("Missing user id in webhook payload", { status: 400 });
      }
      const tokenIdentifierCandidates = buildTokenIdentifierCandidates(
        clerkUserId,
        CLERK_JWT_ISSUER_DOMAIN
      );

      for (const tokenIdentifier of tokenIdentifierCandidates) {
        const result = await ctx.runMutation(internal.users.deleteAccountByTokenIdentifier, {
          tokenIdentifier,
        });

        if (result.success) {
          return new Response("User deleted", { status: 200 });
        }
      }

      // Return success for idempotency when user data is already deleted or never synced.
      return new Response("User not found, nothing to delete", { status: 200 });
    } catch (error) {
      console.error("Error handling Clerk webhook:", error);
      return new Response("Webhook error", { status: 400 });
    }
  }),
});

export default http;
