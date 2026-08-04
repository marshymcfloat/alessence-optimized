import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/http";

const COOKIE = "alessence_session";
const secret = () => new TextEncoder().encode(env().SESSION_SECRET);

export async function createSession(userId: string) {
  const token = await new SignJWT({ email: env().ALLOWED_USER_EMAIL })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function requireUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) throw new ApiError(401, "Authentication required.", "UNAUTHORIZED");
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (
      typeof payload.sub !== "string" ||
      payload.email !== env().ALLOWED_USER_EMAIL
    ) {
      throw new Error("Invalid account");
    }
    const user = await db.user.findFirst({
      where: { id: payload.sub, email: env().ALLOWED_USER_EMAIL },
      select: { id: true, email: true, name: true },
    });
    if (!user) throw new Error("Account not found");
    return user;
  } catch {
    throw new ApiError(401, "Session expired or invalid.", "UNAUTHORIZED");
  }
}
