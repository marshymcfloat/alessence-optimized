import { requireUser } from "@/features/auth/session";
import { getProgressSummary } from "@/features/progress/service";
import { apiError, noStoreJson } from "@/lib/http";

export async function GET() {
  try {
    const user = await requireUser();
    return noStoreJson(await getProgressSummary(user.id));
  } catch (error) {
    return apiError(error);
  }
}
