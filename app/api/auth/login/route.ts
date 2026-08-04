import { compare } from "bcryptjs";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { apiError, ApiError, noStoreJson } from "@/lib/http";
import { loginSchema } from "@/features/auth/schemas";
import { createSession } from "@/features/auth/session";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
    rateLimit(`login:${forwarded}`, 5, 15 * 60 * 1_000);
    const input = loginSchema.parse(await request.json());
    if (input.email !== env().ALLOWED_USER_EMAIL) {
      throw new ApiError(401, "Invalid credentials.", "INVALID_CREDENTIALS");
    }
    const user = await db.user.findUnique({ where: { email: input.email } });
    if (!user || !(await compare(input.password, user.hashedPassword))) {
      throw new ApiError(401, "Invalid credentials.", "INVALID_CREDENTIALS");
    }
    await createSession(user.id);
    return noStoreJson({ user: { id: user.id, email: user.email, name: user.name } });
  } catch (error) {
    return apiError(error);
  }
}
