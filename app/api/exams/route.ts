import { createExamJsonSchema } from "@/features/exams/contracts";
import {
  createExam,
  listExams,
  parseCreateExamForm,
} from "@/features/exams/service";
import { requireUser } from "@/features/auth/session";
import { apiError, noStoreJson } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    rateLimit(`exam-create:${user.id}`, 5, 60 * 60 * 1_000);
    const form = await request.formData();
    const input = createExamJsonSchema.parse(parseCreateExamForm(form));
    const files = form
      .getAll("newFiles")
      .filter((value): value is File => value instanceof File);
    const result = await createExam(input, user.id, files);
    return noStoreJson(result, { status: 202 });
  } catch (error) {
    return apiError(error);
  }
}

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const subject = new URL(request.url).searchParams.get("subjectId");
    const exams = await listExams(user.id, subject ? Number(subject) : undefined);
    return noStoreJson({ exams });
  } catch (error) {
    return apiError(error);
  }
}
