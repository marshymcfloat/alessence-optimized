import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { requireUser } from "@/features/auth/session";

export const requirePageUser = cache(async function requirePageUser() {
  try {
    return await requireUser();
  } catch {
    redirect("/login");
  }
});
