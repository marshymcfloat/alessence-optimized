import { requireUser } from "@/features/auth/session";
import { deleteMaterial } from "@/features/materials/library-service";
import { apiError } from "@/lib/http";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    await deleteMaterial(Number(id), user.id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return apiError(error);
  }
}
