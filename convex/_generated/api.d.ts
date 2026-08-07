/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ResendOTPPasswordReset from "../ResendOTPPasswordReset.js";
import type * as academies from "../academies.js";
import type * as admin from "../admin.js";
import type * as ai from "../ai.js";
import type * as ai_badgeCraft from "../ai/badgeCraft.js";
import type * as ai_badgeProposals from "../ai/badgeProposals.js";
import type * as ai_capabilities from "../ai/capabilities.js";
import type * as ai_childPersonalize from "../ai/childPersonalize.js";
import type * as ai_context from "../ai/context.js";
import type * as ai_courseAssist from "../ai/courseAssist.js";
import type * as ai_familyOptimize from "../ai/familyOptimize.js";
import type * as ai_guardrails from "../ai/guardrails.js";
import type * as ai_mocks from "../ai/mocks.js";
import type * as ai_provider from "../ai/provider.js";
import type * as ai_types from "../ai/types.js";
import type * as alerts from "../alerts.js";
import type * as auth from "../auth.js";
import type * as chores from "../chores.js";
import type * as courses from "../courses.js";
import type * as families from "../families.js";
import type * as gamification from "../gamification.js";
import type * as http from "../http.js";
import type * as knowledgeBase from "../knowledgeBase.js";
import type * as lib_aiCore from "../lib/aiCore.js";
import type * as lib_alerts from "../lib/alerts.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_gamificationCore from "../lib/gamificationCore.js";
import type * as lib_slugs from "../lib/slugs.js";
import type * as lib_socialCore from "../lib/socialCore.js";
import type * as lib_validators from "../lib/validators.js";
import type * as logs from "../logs.js";
import type * as productUpdates from "../productUpdates.js";
import type * as schedules from "../schedules.js";
import type * as social from "../social.js";
import type * as students from "../students.js";
import type * as subjects from "../subjects.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ResendOTPPasswordReset: typeof ResendOTPPasswordReset;
  academies: typeof academies;
  admin: typeof admin;
  ai: typeof ai;
  "ai/badgeCraft": typeof ai_badgeCraft;
  "ai/badgeProposals": typeof ai_badgeProposals;
  "ai/capabilities": typeof ai_capabilities;
  "ai/childPersonalize": typeof ai_childPersonalize;
  "ai/context": typeof ai_context;
  "ai/courseAssist": typeof ai_courseAssist;
  "ai/familyOptimize": typeof ai_familyOptimize;
  "ai/guardrails": typeof ai_guardrails;
  "ai/mocks": typeof ai_mocks;
  "ai/provider": typeof ai_provider;
  "ai/types": typeof ai_types;
  alerts: typeof alerts;
  auth: typeof auth;
  chores: typeof chores;
  courses: typeof courses;
  families: typeof families;
  gamification: typeof gamification;
  http: typeof http;
  knowledgeBase: typeof knowledgeBase;
  "lib/aiCore": typeof lib_aiCore;
  "lib/alerts": typeof lib_alerts;
  "lib/auth": typeof lib_auth;
  "lib/gamificationCore": typeof lib_gamificationCore;
  "lib/slugs": typeof lib_slugs;
  "lib/socialCore": typeof lib_socialCore;
  "lib/validators": typeof lib_validators;
  logs: typeof logs;
  productUpdates: typeof productUpdates;
  schedules: typeof schedules;
  social: typeof social;
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
