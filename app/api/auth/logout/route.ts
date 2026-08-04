import { clearSession } from "@/features/auth/session";
import { noStoreJson } from "@/lib/http";

export async function POST() {
  await clearSession();
  return noStoreJson({ ok: true });
}
