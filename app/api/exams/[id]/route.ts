import { requireUser } from "@/features/auth/session";
import { deleteExam, getExam } from "@/features/exams/service";
import { apiError, noStoreJson } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    return noStoreJson({ exam: await getExam(Number(id), user.id) });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    await deleteExam(Number(id), user.id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return apiError(error);
  }
}
