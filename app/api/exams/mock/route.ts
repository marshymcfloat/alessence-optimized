import { requireUser } from "@/features/auth/session";
import { mockExamSchema } from "@/features/exams/contracts";
import { createExam } from "@/features/exams/service";
import { apiError, noStoreJson } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    rateLimit(`exam-create:${user.id}`, 5, 60 * 60 * 1_000);
    const input = mockExamSchema.parse(await request.json());
    const result = await createExam(
      {
        description: input.title ?? "Philippine board-style mock examination",
        requestedItems: 70,
        subjectId: input.subjectId,
        questionTypes: ["MULTIPLE_CHOICE"],
        existingFileIds: input.existingFileIds,
        isPracticeMode: false,
        emphasizeWeakTopics: input.emphasizeWeakTopics,
        timeLimit: 180,
        allowModelKnowledge: input.allowModelKnowledge,
      },
      user.id,
    );
    await (await import("@/lib/db")).db.exam.update({
      where: { id: result.id },
      data: { isMock: true },
    });
    return noStoreJson(result, { status: 202 });
  } catch (error) {
    return apiError(error);
  }
}
