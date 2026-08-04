import { requireUser } from "@/features/auth/session";
import { retryGeneration } from "@/features/exams/service";
import { apiError, noStoreJson } from "@/lib/http";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    return noStoreJson(await retryGeneration(Number(id), user.id), { status: 202 });
  } catch (error) {
    return apiError(error);
  }
}
