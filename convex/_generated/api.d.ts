/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as academies from "../academies.js";
import type * as admin from "../admin.js";
import type * as ai from "../ai.js";
import type * as auth from "../auth.js";
import type * as courses from "../courses.js";
import type * as families from "../families.js";
import type * as http from "../http.js";
import type * as logs from "../logs.js";
import type * as schedules from "../schedules.js";
import type * as students from "../students.js";
import type * as subjects from "../subjects.js";
import type * as users from "../users.js";

declare const fullApi: ApiFromModules<{
  academies: typeof academies;
  admin: typeof admin;
  ai: typeof ai;
  auth: typeof auth;
  courses: typeof courses;
  families: typeof families;
  http: typeof http;
  logs: typeof logs;
  schedules: typeof schedules;
  students: typeof students;
  subjects: typeof subjects;
  users: typeof users;
}>;

export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
