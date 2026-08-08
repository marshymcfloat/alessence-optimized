import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import {
  backfillMaterialIndexes,
  backfillComputationEvidence,
  generateExam,
  ingestMaterial,
  reindexMaterial,
  reviewAttempt,
  updateMastery,
} from "@/inngest/functions";

export const runtime = "nodejs";
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    generateExam,
    ingestMaterial,
    reindexMaterial,
    backfillMaterialIndexes,
    backfillComputationEvidence,
    reviewAttempt,
    updateMastery,
  ],
});
