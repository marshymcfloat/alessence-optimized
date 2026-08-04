import { requireUser } from "@/features/auth/session";
import { startAttempt } from "@/features/exams/attempt-service";
import { apiError, noStoreJson } from "@/lib/http";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    return noStoreJson(await startAttempt(Number(id), user.id), { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
