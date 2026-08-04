import { requireUser } from "@/features/auth/session";
import { comparison } from "@/features/exams/history-service";
import { apiError, noStoreJson } from "@/lib/http";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    return noStoreJson({ attempts: await comparison(Number(id), user.id) });
  } catch (error) {
    return apiError(error);
  }
}
