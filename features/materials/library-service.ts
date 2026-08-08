import "server-only";
import { del } from "@vercel/blob";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { ApiError } from "@/lib/http";
import { academicYearForPeriod, type StudyPeriod } from "@/lib/study-period";

export async function listMaterials(userId: string, subjectId?: number, period: StudyPeriod = "current") {
  const academicYear = academicYearForPeriod(period);
  const materials = await db.file.findMany({
    where: { userId, ...(subjectId ? { subjectId } : {}), ...(academicYear ? { academicYear } : {}) },
    orderBy: { createdAt: "desc" },
    include: {
      subject: { select: { id: true, title: true } },
      _count: { select: { exams: true } },
    },
  });
  return materials.map((material) => ({
    id: material.id,
    name: material.name,
    size: material.size,
    type: material.type,
    ingestionStatus: material.ingestionStatus,
    ingestionError: material.ingestionError,
    indexedAt: material.indexedAt?.toISOString() ?? null,
    createdAt: material.createdAt.toISOString(),
    subject: material.subject,
    examCount: material._count.exams,
  }));
}

export async function deleteMaterial(id: number, userId: string) {
  const material = await db.file.findFirst({
    where: { id, userId },
    include: {
      exams: {
        where: { generations: { some: { status: { in: ["QUEUED", "PLANNING", "RETRIEVING", "GENERATING", "VALIDATING", "REPAIRING"] } } } },
        select: { id: true },
      },
    },
  });
  if (!material) throw new ApiError(404, "Material not found.");
  if (material.exams.length) {
    throw new ApiError(409, "This material is being used by an active generation.");
  }
  await db.file.delete({ where: { id } });
  await del(material.fileUrl, { token: env().BLOB_READ_WRITE_TOKEN }).catch(() => undefined);
}
