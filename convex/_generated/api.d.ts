/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as crons from "../crons.js";
import type * as environments from "../environments.js";
import type * as http from "../http.js";
import type * as lib_accountStatus from "../lib/accountStatus.js";
import type * as lib_env from "../lib/env.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_roleLimits from "../lib/roleLimits.js";
import type * as projects from "../projects.js";
import type * as sharedSecrets from "../sharedSecrets.js";
import type * as users from "../users.js";
import type * as variables from "../variables.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  crons: typeof crons;
  environments: typeof environments;
  http: typeof http;
  "lib/accountStatus": typeof lib_accountStatus;
  "lib/env": typeof lib_env;
  "lib/errors": typeof lib_errors;
  "lib/roleLimits": typeof lib_roleLimits;
  projects: typeof projects;
  sharedSecrets: typeof sharedSecrets;
  users: typeof users;
  variables: typeof variables;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
