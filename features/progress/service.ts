import "server-only";
import { db } from "@/lib/db";

export async function getProgressSummary(userId: string) {
  const [examCount, readyExams, materialCount, attempts, wrongTopics] =
    await Promise.all([
      db.exam.count({ where: { userId } }),
      db.exam.count({ where: { userId, status: "READY" } }),
      db.file.count({ where: { userId } }),
      db.examAttempt.findMany({
        where: { userId, status: "COMPLETED", score: { not: null } },
        orderBy: { completedAt: "desc" },
        include: { exam: { include: { subject: { select: { title: true } } } } },
      }),
      db.userAnswer.groupBy({
        by: ["questionId"],
        where: { isCorrect: false, attempt: { userId }, question: { topicLabel: { not: null } } },
        _count: { questionId: true },
        orderBy: { _count: { questionId: "desc" } },
        take: 12,
      }),
    ]);
  const questions = wrongTopics.length
    ? await db.question.findMany({
        where: { id: { in: wrongTopics.map((item) => item.questionId) } },
        select: { id: true, topicLabel: true },
      })
    : [];
  const labels = new Map(questions.map((question) => [question.id, question.topicLabel]));
  const topicCounts = new Map<string, number>();
  wrongTopics.forEach((item) => {
    const label = labels.get(item.questionId);
    if (label) topicCounts.set(label, (topicCounts.get(label) ?? 0) + item._count.questionId);
  });
  return {
    examCount,
    completedAttempts: attempts.length,
    averageScore: attempts.length
      ? attempts.reduce((sum, attempt) => sum + (attempt.score ?? 0), 0) / attempts.length
      : 0,
    readyExams,
    materialCount,
    recentAttempts: attempts.slice(0, 6).map((attempt) => ({
      id: attempt.id,
      examId: attempt.examId,
      examTitle: attempt.exam.description,
      subjectTitle: attempt.exam.subject.title,
      score: attempt.score ?? 0,
      completedAt: attempt.completedAt!.toISOString(),
    })),
    weakTopics: [...topicCounts.entries()]
      .map(([topic, misses]) => ({ topic, misses }))
      .sort((a, b) => b.misses - a.misses)
      .slice(0, 5),
  };
}
