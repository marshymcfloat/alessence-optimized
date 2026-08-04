import { requireUser } from "@/features/auth/session";
import { wrongAnswers } from "@/features/exams/history-service";
import { apiError, noStoreJson } from "@/lib/http";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const groups = await wrongAnswers(Number(id), user.id);
    const totalWrongAnswers = groups.reduce(
      (sum, group) => sum + group.totalWrongAttempts,
      0,
    );
    return noStoreJson({
      groups,
      statistics: {
        uniqueWrongQuestions: groups.length,
        totalWrongAnswers,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
