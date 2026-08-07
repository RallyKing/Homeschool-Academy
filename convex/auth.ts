import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import type { DataModel } from "./_generated/dataModel";

const roleFromParams = (
  role: unknown,
): "superAdmin" | "parent" | "teacher" | "student" => {
  if (
    role === "superAdmin" ||
    role === "parent" ||
    role === "teacher" ||
    role === "student"
  ) {
    return role;
  }
  return "parent";
};

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password<DataModel>({
      profile(params) {
        return {
          email: params.email as string,
          name: (params.name as string | undefined) ?? undefined,
          role: roleFromParams(params.role),
          createdAt: Date.now(),
        };
      },
    }),
  ],
});
