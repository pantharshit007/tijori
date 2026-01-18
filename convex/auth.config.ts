const domain = process.env.CLERK_JWT_ISSUER_DOMAIN;
if (!domain) {
  throw new Error("Missing CLERK_JWT_ISSUER_DOMAIN");
}

export default {
  providers: [
    {
      domain,
      applicationID: "convex",
    },
  ],
};
