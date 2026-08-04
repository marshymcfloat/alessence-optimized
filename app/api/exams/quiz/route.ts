import { requireUser } from "@/features/auth/session";
import { adaptiveQuiz, gradeAdaptiveQuiz } from "@/features/exams/history-service";
import { apiError, noStoreJson } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const params = new URL(request.url).searchParams;
    const subjectId = params.get("subjectId");
    const count = params.get("count");
    return noStoreJson(
      await adaptiveQuiz(
        user.id,
        subjectId ? Number(subjectId) : undefined,
        count ? Number(count) : 5,
      ),
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = await request.json() as {
      answers?: Array<{ questionId: number; userAnswer: string }>;
    };
    if (!Array.isArray(input.answers) || input.answers.length > 25) {
      return noStoreJson(
        { error: { code: "VALIDATION_ERROR", message: "Answers are invalid." } },
        { status: 400 },
      );
    }
    return noStoreJson(await gradeAdaptiveQuiz(user.id, input.answers));
  } catch (error) {
    return apiError(error);
  }
}
