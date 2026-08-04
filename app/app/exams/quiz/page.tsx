import type { Metadata } from "next";
import { requirePageUser } from "@/features/auth/page-session";
import { adaptiveQuiz } from "@/features/exams/history-service";
import { AdaptiveQuiz } from "./AdaptiveQuiz";

export const metadata: Metadata = { title: "Adaptive quiz" };

export default async function AdaptiveQuizPage() {
  const user = await requirePageUser();
  const quiz = await adaptiveQuiz(user.id, undefined, 5);
  return <AdaptiveQuiz quiz={JSON.parse(JSON.stringify(quiz))} />;
}
