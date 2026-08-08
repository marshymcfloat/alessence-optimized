import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { isLowTextPdf, sectionsFromPlainText } from "@/features/materials/extraction";

describe("structure-aware extraction", () => {
  it("recognizes heading-like TXT sections", () => {
    const sections = sectionsFromPlainText("VAT EXEMPTIONS\n\nTransactions expressly exempt from VAT.\n\nESTATE TAX\n\nEstate tax rules apply separately.");
    expect(sections.map((section) => section.sectionTitle)).toEqual(["VAT EXEMPTIONS", "ESTATE TAX"]);
  });

  it("detects image-only or nearly empty PDFs", () => {
    expect(isLowTextPdf("page 1", 10)).toBe(true);
    expect(isLowTextPdf("substantial readable text ".repeat(20), 2)).toBe(false);
  });
});
