import { requireUser } from "@/features/auth/session";
import { subjectInputSchema } from "@/features/frontend/contracts";
import { archiveSubject, renameSubject } from "@/features/subjects/service";
import { apiError, noStoreJson } from "@/lib/http";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const input = subjectInputSchema.parse(await request.json());
    return noStoreJson({
      subject: await renameSubject(Number(id), user.id, input.title),
    });
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
    await archiveSubject(Number(id), user.id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return apiError(error);
  }
}
