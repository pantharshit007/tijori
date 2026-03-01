import { getConvexAuthEnv } from "./lib/env";

const { CLERK_JWT_ISSUER_DOMAIN: domain } = getConvexAuthEnv();

export default {
  providers: [
    {
      domain,
      applicationID: "convex",
    },
  ],
};
