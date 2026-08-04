import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/features/auth/page-session";
import { getAttemptForTaking } from "@/features/exams/attempt-service";
import { ExamRunner } from "./ExamRunner";

export const metadata: Metadata = { title: "Take exam" };

export default async function TakeExamPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ attempt?: string }>;
}) {
  const user = await requirePageUser();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const attemptId = Number(query.attempt);
  if (!attemptId) notFound();
  const attempt = await getAttemptForTaking(attemptId, user.id);
  if (attempt.exam.id !== Number(id)) notFound();
  return <ExamRunner attempt={JSON.parse(JSON.stringify(attempt))} />;
}
