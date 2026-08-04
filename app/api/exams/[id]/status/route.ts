import { requireUser } from "@/features/auth/session";
import { db } from "@/lib/db";
import { apiError, ApiError, noStoreJson } from "@/lib/http";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const exam = await db.exam.findFirst({
      where: { id: Number(id), userId: user.id },
      select: {
        id: true,
        status: true,
        generations: {
          orderBy: { version: "desc" },
          take: 1,
          select: {
            id: true,
            version: true,
            status: true,
            progress: true,
            groundingMode: true,
            failureCode: true,
            failureMessage: true,
          },
        },
      },
    });
    if (!exam) throw new ApiError(404, "Exam not found.", "EXAM_NOT_FOUND");
    return noStoreJson(exam);
  } catch (error) {
    return apiError(error);
  }
}
