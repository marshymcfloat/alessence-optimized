import { requireUser } from "@/features/auth/session";
import { submitAttempt } from "@/features/exams/attempt-service";
import { submitAttemptSchema } from "@/features/exams/contracts";
import { apiError, noStoreJson } from "@/lib/http";

export const maxDuration = 300;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; attemptId: string }> },
) {
  try {
    const user = await requireUser();
    const { id, attemptId } = await context.params;
    const input = submitAttemptSchema.parse(await request.json());
    return noStoreJson(
      await submitAttempt(Number(id), Number(attemptId), user.id, input.answers),
    );
  } catch (error) {
    return apiError(error);
  }
}
