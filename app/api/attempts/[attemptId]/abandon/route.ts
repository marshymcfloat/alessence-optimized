import { requireUser } from "@/features/auth/session";
import { abandonAttempt } from "@/features/exams/attempt-service";
import { apiError, noStoreJson } from "@/lib/http";

export async function POST(
  _request: Request,
  context: { params: Promise<{ attemptId: string }> },
) {
  try {
    const user = await requireUser();
    const { attemptId } = await context.params;
    await abandonAttempt(Number(attemptId), user.id);
    return noStoreJson({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
