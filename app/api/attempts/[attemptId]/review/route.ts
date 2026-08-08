import { requireUser } from "@/features/auth/session";
import { retryAttemptReview } from "@/features/exams/attempt-service";
import { apiError, noStoreJson } from "@/lib/http";

export async function POST(
  _request: Request,
  context: { params: Promise<{ attemptId: string }> },
) {
  try {
    const user = await requireUser();
    const { attemptId } = await context.params;
    return noStoreJson(await retryAttemptReview(Number(attemptId), user.id), { status: 202 });
  } catch (error) {
    return apiError(error);
  }
}
