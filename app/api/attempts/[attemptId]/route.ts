import { requireUser } from "@/features/auth/session";
import { attemptDetails, attemptReviewState } from "@/features/exams/history-service";
import { apiError, noStoreJson } from "@/lib/http";

export async function GET(
  _request: Request,
  context: { params: Promise<{ attemptId: string }> },
) {
  try {
    const user = await requireUser();
    const { attemptId } = await context.params;
    const id = Number(attemptId);
    const review = await attemptReviewState(id, user.id);
    if (review.status !== "COMPLETED") return noStoreJson({ status: review.status }, { status: 202 });
    return noStoreJson({ status: review.status, attempt: await attemptDetails(id, user.id) });
  } catch (error) {
    return apiError(error);
  }
}
