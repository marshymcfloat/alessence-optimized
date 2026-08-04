import { requireUser } from "@/features/auth/session";
import { attemptDetails } from "@/features/exams/history-service";
import { apiError, noStoreJson } from "@/lib/http";

export async function GET(
  _request: Request,
  context: { params: Promise<{ attemptId: string }> },
) {
  try {
    const user = await requireUser();
    const { attemptId } = await context.params;
    return noStoreJson({ attempt: await attemptDetails(Number(attemptId), user.id) });
  } catch (error) {
    return apiError(error);
  }
}
