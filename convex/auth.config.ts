import { env } from '../src/env.server'

export default {
  providers: [
    {
      domain: env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: 'convex',
    },
  ],
}
