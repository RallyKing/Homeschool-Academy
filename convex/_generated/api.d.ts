/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as academies from "../academies.js";
import type * as admin from "../admin.js";
import type * as ai from "../ai.js";
import type * as alerts from "../alerts.js";
import type * as auth from "../auth.js";
import type * as chores from "../chores.js";
import type * as courses from "../courses.js";
import type * as families from "../families.js";
import type * as gamification from "../gamification.js";
import type * as http from "../http.js";
import type * as knowledgeBase from "../knowledgeBase.js";
import type * as lib_alerts from "../lib/alerts.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_gamificationCore from "../lib/gamificationCore.js";
import type * as lib_slugs from "../lib/slugs.js";
import type * as lib_validators from "../lib/validators.js";
import type * as logs from "../logs.js";
import type * as productUpdates from "../productUpdates.js";
import type * as schedules from "../schedules.js";
import type * as students from "../students.js";
import type * as subjects from "../subjects.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  academies: typeof academies;
  admin: typeof admin;
  ai: typeof ai;
  alerts: typeof alerts;
  auth: typeof auth;
  chores: typeof chores;
  courses: typeof courses;
  families: typeof families;
  gamification: typeof gamification;
  http: typeof http;
  knowledgeBase: typeof knowledgeBase;
  "lib/alerts": typeof lib_alerts;
  "lib/auth": typeof lib_auth;
  "lib/gamificationCore": typeof lib_gamificationCore;
  "lib/slugs": typeof lib_slugs;
  "lib/validators": typeof lib_validators;
  logs: typeof logs;
  productUpdates: typeof productUpdates;
  schedules: typeof schedules;
  students: typeof students;
  subjects: typeof subjects;
  users: typeof users;
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
