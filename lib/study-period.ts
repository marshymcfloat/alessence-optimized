export const studyPeriods = ["current", "second-year", "all"] as const;
export type StudyPeriod = (typeof studyPeriods)[number];

export function parseStudyPeriod(value?: string): StudyPeriod {
  return studyPeriods.includes(value as StudyPeriod) ? value as StudyPeriod : "current";
}

export function academicYearForPeriod(period: StudyPeriod) {
  if (period === "current") return "THIRD_YEAR";
  if (period === "second-year") return "SECOND_YEAR";
  return undefined;
}

export function studyPeriodLabel(period: StudyPeriod) {
  if (period === "current") return "3rd Year";
  if (period === "second-year") return "2nd Year";
  return "All years";
}
