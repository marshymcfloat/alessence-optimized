import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/http";

export async function listSubjects(userId: string, includeArchived = false) {
  const subjects = await db.subject.findMany({
    where: { userId, ...(includeArchived ? {} : { archived: false }) },
    orderBy: { title: "asc" },
    include: { _count: { select: { files: true, exams: true } } },
  });
  return subjects.map((subject) => ({
    id: subject.id,
    title: subject.title,
    archived: subject.archived,
    materialCount: subject._count.files,
    examCount: subject._count.exams,
  }));
}

export async function createSubject(userId: string, title: string) {
  try {
    return await db.subject.create({
      data: { userId, title },
      select: { id: true, title: true, archived: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ApiError(409, "A subject with this name already exists.");
    }
    throw error;
  }
}

export async function renameSubject(id: number, userId: string, title: string) {
  const result = await db.subject.updateMany({ where: { id, userId }, data: { title } });
  if (!result.count) throw new ApiError(404, "Subject not found.");
  return db.subject.findUniqueOrThrow({
    where: { id },
    select: { id: true, title: true, archived: true },
  });
}

export async function archiveSubject(id: number, userId: string) {
  const result = await db.subject.updateMany({
    where: { id, userId },
    data: { archived: true },
  });
  if (!result.count) throw new ApiError(404, "Subject not found.");
}
