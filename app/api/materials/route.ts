import { requireUser } from "@/features/auth/session";
import { ingestFiles } from "@/features/materials/service";
import { listMaterials } from "@/features/materials/library-service";
import { apiError, noStoreJson } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const value = new URL(request.url).searchParams.get("subjectId");
    return noStoreJson({
      materials: await listMaterials(user.id, value ? Number(value) : undefined),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const form = await request.formData();
    const subjectId = Number(form.get("subjectId"));
    const files = form.getAll("files").filter((value): value is File => value instanceof File);
    const materials = await ingestFiles(files, user.id, subjectId);
    return noStoreJson({ materials }, { status: 202 });
  } catch (error) {
    return apiError(error);
  }
}
