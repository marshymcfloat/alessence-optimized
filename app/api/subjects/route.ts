import { requireUser } from "@/features/auth/session";
import { subjectInputSchema } from "@/features/frontend/contracts";
import { createSubject, listSubjects } from "@/features/subjects/service";
import { apiError, noStoreJson } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const includeArchived =
      new URL(request.url).searchParams.get("includeArchived") === "true";
    return noStoreJson({ subjects: await listSubjects(user.id, includeArchived) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = subjectInputSchema.parse(await request.json());
    return noStoreJson({ subject: await createSubject(user.id, input.title) }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
