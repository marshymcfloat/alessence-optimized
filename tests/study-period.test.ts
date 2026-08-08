import { describe, expect, it } from "vitest";
import { academicYearForPeriod, parseStudyPeriod } from "@/lib/study-period";

describe("study periods", () => {
  it("defaults invalid and missing values to the current semester", () => {
    expect(parseStudyPeriod()).toBe("current");
    expect(parseStudyPeriod("legacy")).toBe("current");
  });

  it("maps the current workspace to third year", () => {
    expect(academicYearForPeriod("current")).toBe("THIRD_YEAR");
  });

  it("does not constrain all history", () => {
    expect(academicYearForPeriod("all")).toBeUndefined();
  });
});
